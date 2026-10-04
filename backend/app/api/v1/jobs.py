from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.schemas.alert import JobsRunResponse
from app.services.alerts import AlertService
from app.services.retention import RetentionService

settings = get_settings()
router = APIRouter(prefix="/internal", tags=["Internal Jobs"])
security = HTTPBearer()


@router.post("/run-jobs", response_model=JobsRunResponse)
async def run_internal_jobs(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JobsRunResponse:
    """Trigger background maintenance jobs: data retention purge and alert rules evaluation.

    Protected by INTERNAL_JOBS_TOKEN bearer authentication.
    """
    if not credentials or credentials.credentials != settings.INTERNAL_JOBS_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal jobs authorization token",
        )

    # 1. Run retention cleanup
    traces_del, spans_del = await RetentionService.run_retention_purge(db)

    # 2. Run alert rules evaluation
    alert_summaries = await AlertService.evaluate_all_rules(db)
    fired_count = sum(1 for a in alert_summaries if a.fired)

    return JobsRunResponse(
        status="ok",
        traces_deleted=traces_del,
        spans_deleted=spans_del,
        alerts_evaluated=len(alert_summaries),
        alerts_fired=fired_count,
        alert_details=alert_summaries,
    )
