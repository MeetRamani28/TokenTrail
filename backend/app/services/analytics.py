import math
from collections import defaultdict
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import Span, Trace
from app.schemas.analytics import (
    ModelUsageSummary,
    OverviewResponse,
    SpanWaterfallItem,
    TimeseriesPoint,
    TimeseriesResponse,
    TraceDetailResponse,
    TraceListResponse,
    TraceSummaryItem,
)


def calculate_percentile(data: list[float], percentile: float) -> float | None:
    """Calculates linear interpolation percentile (equivalent to NumPy/Postgres percentile_cont)."""
    if not data:
        return None
    sorted_data = sorted(data)
    if len(sorted_data) == 1:
        return float(sorted_data[0])
    k = (len(sorted_data) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(sorted_data[int(k)])
    d0 = sorted_data[int(f)] * (c - k)
    d1 = sorted_data[int(c)] * (k - f)
    return float(d0 + d1)


class AnalyticsService:
    @staticmethod
    async def get_overview(
        db: AsyncSession,
        project_id: str,
        from_time: datetime | None = None,
        to_time: datetime | None = None,
    ) -> OverviewResponse:
        query = select(Trace).where(Trace.project_id == project_id)
        if from_time:
            query = query.where(Trace.started_at >= from_time)
        if to_time:
            query = query.where(Trace.started_at <= to_time)

        result = await db.execute(query)
        traces = result.scalars().all()

        if not traces:
            return OverviewResponse()

        total_requests = len(traces)
        total_tokens = sum(t.total_tokens for t in traces)
        total_cost = sum(t.total_cost for t in traces)
        error_count = sum(1 for t in traces if t.status == "error")
        error_rate = round((error_count / total_requests) * 100.0, 2)

        # Cross-aggregate directly from Spans so that costs/tokens are never lost
        # even if traces were created prior to child span completion
        span_agg_query = select(
            func.coalesce(func.sum(Span.cost), 0.0),
            func.coalesce(func.sum(Span.prompt_tokens + Span.completion_tokens), 0),
        ).where(Span.project_id == project_id)
        if from_time:
            span_agg_query = span_agg_query.where(Span.started_at >= from_time)
        if to_time:
            span_agg_query = span_agg_query.where(Span.started_at <= to_time)

        span_agg_res = await db.execute(span_agg_query)
        span_row = span_agg_res.first()
        spans_cost = float(span_row[0]) if span_row else 0.0
        spans_tokens = int(span_row[1]) if span_row else 0

        authoritative_cost = max(total_cost, spans_cost)
        authoritative_tokens = max(total_tokens, spans_tokens)

        # Extract positive durations from traces
        latencies: list[float] = [
            (t.ended_at - t.started_at).total_seconds() * 1000.0
            for t in traces
            if t.ended_at and t.started_at and (t.ended_at - t.started_at).total_seconds() > 0
        ]

        # If trace intervals are 0 (e.g. legacy traces), extract durations directly from spans
        if not latencies:
            span_dur_query = select(Span.duration_ms).where(
                Span.project_id == project_id,
                Span.duration_ms.is_not(None),
                Span.duration_ms > 0,
            )
            if from_time:
                span_dur_query = span_dur_query.where(Span.started_at >= from_time)
            if to_time:
                span_dur_query = span_dur_query.where(Span.started_at <= to_time)
            dur_res = await db.execute(span_dur_query)
            latencies = [
                float(row[0]) for row in dur_res.all() if row[0] is not None and row[0] > 0
            ]

        avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None
        p50_raw = calculate_percentile(latencies, 50.0) if latencies else None
        p50_latency = round(p50_raw, 2) if p50_raw is not None else None

        p95_raw = calculate_percentile(latencies, 95.0) if latencies else None
        p95_latency = round(p95_raw, 2) if p95_raw is not None else None

        return OverviewResponse(
            total_requests=total_requests,
            total_tokens=authoritative_tokens,
            total_cost=round(authoritative_cost, 6),
            error_rate=error_rate,
            avg_latency_ms=avg_latency,
            p50_latency_ms=p50_latency,
            p95_latency_ms=p95_latency,
        )

    @staticmethod
    async def get_timeseries(
        db: AsyncSession,
        project_id: str,
        metric: Literal["requests", "tokens", "cost", "latency"] = "requests",
        interval: Literal["1h", "1d"] = "1h",
        from_time: datetime | None = None,
        to_time: datetime | None = None,
        group_by: Literal["none", "model", "status"] = "none",
    ) -> TimeseriesResponse:
        # If grouped by model, query spans joined with trace
        if group_by == "model":
            span_query = (
                select(Span)
                .where(
                    Span.project_id == project_id,
                    Span.type == "llm",
                    Span.model.is_not(None),
                )
                .order_by(Span.started_at.asc())
            )
            if from_time:
                span_query = span_query.where(Span.started_at >= from_time)
            if to_time:
                span_query = span_query.where(Span.started_at <= to_time)

            span_result = await db.execute(span_query)
            spans = span_result.scalars().all()

            # Group points: (bucket_ts, model) -> list of values
            buckets: dict[tuple[datetime, str], list[float]] = defaultdict(list)
            for s in spans:
                model_name = s.model or "unknown"
                ts = s.started_at
                if interval == "1h":
                    bucket = ts.replace(minute=0, second=0, microsecond=0)
                else:
                    bucket = ts.replace(hour=0, minute=0, second=0, microsecond=0)

                if metric == "requests":
                    buckets[(bucket, model_name)].append(1.0)
                elif metric == "tokens":
                    buckets[(bucket, model_name)].append(
                        float(s.prompt_tokens + s.completion_tokens)
                    )
                elif metric == "cost":
                    buckets[(bucket, model_name)].append(float(s.cost))
                elif metric == "latency":
                    if s.duration_ms is not None:
                        buckets[(bucket, model_name)].append(float(s.duration_ms))

            points: list[TimeseriesPoint] = []
            for (bucket_ts, grp), values in sorted(buckets.items(), key=lambda x: x[0][0]):
                if metric == "latency":
                    val = sum(values) / len(values) if values else 0.0
                else:
                    val = sum(values)
                points.append(
                    TimeseriesPoint(
                        timestamp=bucket_ts,
                        value=round(val, 6 if metric == "cost" else 2),
                        group=grp,
                    )
                )
            return TimeseriesResponse(metric=metric, interval=interval, points=points)

        # Standard trace-level bucketing (none or status)
        trace_query = (
            select(Trace).where(Trace.project_id == project_id).order_by(Trace.started_at.asc())
        )
        if from_time:
            trace_query = trace_query.where(Trace.started_at >= from_time)
        if to_time:
            trace_query = trace_query.where(Trace.started_at <= to_time)

        trace_result = await db.execute(trace_query)
        traces = trace_result.scalars().all()

        trace_buckets: dict[tuple[datetime, str | None], list[float]] = defaultdict(list)
        for t in traces:
            ts = t.started_at
            if interval == "1h":
                bucket = ts.replace(minute=0, second=0, microsecond=0)
            else:
                bucket = ts.replace(hour=0, minute=0, second=0, microsecond=0)

            status_grp: str | None = t.status if group_by == "status" else None

            if metric == "requests":
                trace_buckets[(bucket, status_grp)].append(1.0)
            elif metric == "tokens":
                trace_buckets[(bucket, status_grp)].append(float(t.total_tokens))
            elif metric == "cost":
                trace_buckets[(bucket, status_grp)].append(float(t.total_cost))
            elif metric == "latency":
                if t.ended_at and t.started_at:
                    dur = (t.ended_at - t.started_at).total_seconds() * 1000.0
                    if dur >= 0:
                        trace_buckets[(bucket, status_grp)].append(dur)

        trace_points: list[TimeseriesPoint] = []
        for (bucket_ts, group_name), values in sorted(trace_buckets.items(), key=lambda x: x[0][0]):
            if metric == "latency":
                val = sum(values) / len(values) if values else 0.0
            else:
                val = sum(values)
            trace_points.append(
                TimeseriesPoint(
                    timestamp=bucket_ts,
                    value=round(val, 6 if metric == "cost" else 2),
                    group=group_name,
                )
            )

        return TimeseriesResponse(metric=metric, interval=interval, points=trace_points)

    @staticmethod
    async def get_traces(
        db: AsyncSession,
        project_id: str,
        limit: int = 20,
        offset: int = 0,
        status: str | None = None,
        model: str | None = None,
        tag: str | None = None,
        min_latency_ms: float | None = None,
        max_latency_ms: float | None = None,
        from_time: datetime | None = None,
        to_time: datetime | None = None,
    ) -> TraceListResponse:
        query = (
            select(Trace).options(selectinload(Trace.spans)).where(Trace.project_id == project_id)
        )

        if status:
            query = query.where(Trace.status == status)
        if from_time:
            query = query.where(Trace.started_at >= from_time)
        if to_time:
            query = query.where(Trace.started_at <= to_time)

        query = query.order_by(Trace.started_at.desc())
        result = await db.execute(query)
        all_traces = result.scalars().all()

        filtered_traces: list[TraceSummaryItem] = []
        for t in all_traces:
            # Tag filter
            if tag and tag not in (t.tags or []):
                continue

            # Model filter
            models_used = sorted(list({s.model for s in t.spans if s.model}))
            if model and model not in models_used:
                continue

            # Duration calculation
            dur_ms: float | None = None
            if t.ended_at and t.started_at:
                dur_ms = round((t.ended_at - t.started_at).total_seconds() * 1000.0, 2)

            if min_latency_ms is not None and (dur_ms is None or dur_ms < min_latency_ms):
                continue
            if max_latency_ms is not None and (dur_ms is None or dur_ms > max_latency_ms):
                continue

            filtered_traces.append(
                TraceSummaryItem(
                    trace_id=t.trace_id,
                    name=t.name,
                    started_at=t.started_at,
                    duration_ms=dur_ms,
                    status=t.status,
                    total_tokens=t.total_tokens,
                    total_cost=round(t.total_cost, 6),
                    span_count=len(t.spans),
                    models=models_used,
                    tags=t.tags or [],
                )
            )

        total_count = len(filtered_traces)
        paged_traces = filtered_traces[offset : offset + limit]
        has_more = (offset + limit) < total_count

        return TraceListResponse(
            traces=paged_traces,
            total_count=total_count,
            has_more=has_more,
        )

    @staticmethod
    async def get_trace_detail(
        db: AsyncSession,
        project_id: str,
        trace_id: str,
    ) -> TraceDetailResponse | None:
        trace_stmt = select(Trace).where(
            Trace.trace_id == trace_id,
            Trace.project_id == project_id,
        )
        res = await db.execute(trace_stmt)
        trace = res.scalar_one_or_none()
        if not trace:
            return None

        # Fetch child spans ordered chronologically
        spans_stmt = (
            select(Span)
            .where(Span.trace_id == trace_id, Span.project_id == project_id)
            .order_by(Span.started_at.asc())
        )
        span_res = await db.execute(spans_stmt)
        spans = span_res.scalars().all()

        dur_ms = None
        if trace.ended_at and trace.started_at:
            dur_ms = round((trace.ended_at - trace.started_at).total_seconds() * 1000.0, 2)

        waterfall_spans: list[SpanWaterfallItem] = []
        for s in spans:
            offset_ms = round(
                max(0.0, (s.started_at - trace.started_at).total_seconds() * 1000.0), 2
            )
            waterfall_spans.append(
                SpanWaterfallItem(
                    span_id=s.span_id,
                    trace_id=s.trace_id,
                    parent_span_id=s.parent_span_id,
                    name=s.name,
                    type=s.type,
                    started_at=s.started_at,
                    ended_at=s.ended_at,
                    duration_ms=round(s.duration_ms, 2) if s.duration_ms is not None else None,
                    ttft_ms=round(s.ttft_ms, 2) if s.ttft_ms is not None else None,
                    status=s.status,
                    error_type=s.error_type,
                    error_message=s.error_message,
                    model=s.model,
                    provider=s.provider,
                    prompt_tokens=s.prompt_tokens,
                    completion_tokens=s.completion_tokens,
                    cost=round(s.cost, 6),
                    cost_is_estimated=s.cost_is_estimated,
                    input=s.input,
                    output=s.output,
                    metadata=s.metadata_ or {},
                    offset_ms=offset_ms,
                )
            )

        return TraceDetailResponse(
            trace_id=trace.trace_id,
            name=trace.name,
            started_at=trace.started_at,
            ended_at=trace.ended_at,
            duration_ms=dur_ms,
            status=trace.status,
            total_tokens=trace.total_tokens,
            total_cost=round(trace.total_cost, 6),
            user_id=trace.user_id,
            session_id=trace.session_id,
            tags=trace.tags or [],
            metadata=trace.metadata_ or {},
            spans=waterfall_spans,
        )

    @staticmethod
    async def get_models_breakdown(
        db: AsyncSession,
        project_id: str,
        from_time: datetime | None = None,
        to_time: datetime | None = None,
    ) -> list[ModelUsageSummary]:
        query = select(Span).where(
            Span.project_id == project_id,
            Span.type == "llm",
            Span.model.is_not(None),
        )
        if from_time:
            query = query.where(Span.started_at >= from_time)
        if to_time:
            query = query.where(Span.started_at <= to_time)

        result = await db.execute(query)
        spans = result.scalars().all()

        model_groups: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "provider": None,
                "total_calls": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_cost": 0.0,
                "latencies": [],
            }
        )

        for s in spans:
            model_name = s.model or "unknown"
            g = model_groups[model_name]
            if not g["provider"] and s.provider:
                g["provider"] = s.provider
            g["total_calls"] += 1
            g["prompt_tokens"] += s.prompt_tokens
            g["completion_tokens"] += s.completion_tokens
            g["total_cost"] += s.cost
            if s.duration_ms is not None:
                g["latencies"].append(s.duration_ms)

        summaries: list[ModelUsageSummary] = []
        for model_name, data in sorted(
            model_groups.items(), key=lambda x: x[1]["total_cost"], reverse=True
        ):
            lats = data["latencies"]
            avg_lat = round(sum(lats) / len(lats), 2) if lats else None
            p95_raw = calculate_percentile(lats, 95.0) if lats else None
            p95_lat = round(p95_raw, 2) if p95_raw is not None else None

            summaries.append(
                ModelUsageSummary(
                    model=model_name,
                    provider=data["provider"],
                    total_calls=data["total_calls"],
                    prompt_tokens=data["prompt_tokens"],
                    completion_tokens=data["completion_tokens"],
                    total_tokens=data["prompt_tokens"] + data["completion_tokens"],
                    total_cost=round(data["total_cost"], 6),
                    avg_latency_ms=avg_lat,
                    p95_latency_ms=p95_lat,
                )
            )

        return summaries
