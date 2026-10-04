from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clerk_auth import AuthContext, get_current_auth
from app.core.db import get_db
from app.schemas.analytics import (
    ModelUsageSummary,
    OverviewResponse,
    TimeseriesResponse,
    TraceDetailResponse,
    TraceListResponse,
)
from app.services.analytics import AnalyticsService

router = APIRouter(prefix="/api", tags=["Analytics"])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    from_time: Annotated[datetime | None, Query(description="Start time (ISO 8601)")] = None,
    to_time: Annotated[datetime | None, Query(description="End time (ISO 8601)")] = None,
) -> OverviewResponse:
    """Fetch high-level overview metrics for the current project."""
    return await AnalyticsService.get_overview(
        db=db,
        project_id=auth.project.id,
        from_time=from_time,
        to_time=to_time,
    )


@router.get("/timeseries", response_model=TimeseriesResponse)
async def get_timeseries(
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    metric: Annotated[
        Literal["requests", "tokens", "cost", "latency"],
        Query(description="Metric to plot"),
    ] = "requests",
    interval: Annotated[
        Literal["1h", "1d"],
        Query(description="Time interval bucket size"),
    ] = "1h",
    group_by: Annotated[
        Literal["none", "model", "status"],
        Query(description="Group series by"),
    ] = "none",
    from_time: Annotated[datetime | None, Query()] = None,
    to_time: Annotated[datetime | None, Query()] = None,
) -> TimeseriesResponse:
    """Fetch time series data points for charts."""
    return await AnalyticsService.get_timeseries(
        db=db,
        project_id=auth.project.id,
        metric=metric,
        interval=interval,
        from_time=from_time,
        to_time=to_time,
        group_by=group_by,
    )


@router.get("/traces", response_model=TraceListResponse)
async def list_traces(
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    model: Annotated[str | None, Query()] = None,
    tag: Annotated[str | None, Query()] = None,
    min_latency_ms: Annotated[float | None, Query(ge=0)] = None,
    max_latency_ms: Annotated[float | None, Query(ge=0)] = None,
    from_time: Annotated[datetime | None, Query()] = None,
    to_time: Annotated[datetime | None, Query()] = None,
) -> TraceListResponse:
    """List paginated traces with filtering support."""
    return await AnalyticsService.get_traces(
        db=db,
        project_id=auth.project.id,
        limit=limit,
        offset=offset,
        status=status_filter,
        model=model,
        tag=tag,
        min_latency_ms=min_latency_ms,
        max_latency_ms=max_latency_ms,
        from_time=from_time,
        to_time=to_time,
    )


@router.get("/traces/{trace_id}", response_model=TraceDetailResponse)
async def get_trace_detail(
    trace_id: str,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TraceDetailResponse:
    """Get full details and span waterfall for a specific trace."""
    trace = await AnalyticsService.get_trace_detail(
        db=db,
        project_id=auth.project.id,
        trace_id=trace_id,
    )
    if not trace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trace '{trace_id}' not found in active project",
        )
    return trace


@router.get("/models", response_model=list[ModelUsageSummary])
async def list_models_usage(
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    from_time: Annotated[datetime | None, Query()] = None,
    to_time: Annotated[datetime | None, Query()] = None,
) -> list[ModelUsageSummary]:
    """Fetch usage and cost summary broken down by model."""
    return await AnalyticsService.get_models_breakdown(
        db=db,
        project_id=auth.project.id,
        from_time=from_time,
        to_time=to_time,
    )
