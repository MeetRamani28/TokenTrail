from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import execute_upsert
from app.models.models import Span, Trace
from app.schemas.ingest import IngestBatchRequest


def ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


async def ingest_spans_batch(
    session: AsyncSession,
    project_id: str,
    batch: IngestBatchRequest,
) -> tuple[int, int]:
    """Idempotently ingests a batch of spans and associated trace metadata.

    Returns:
        tuple of (accepted_spans_count, accepted_traces_count)
    """
    if not batch.spans:
        return 0, 0

    # 1. Group trace information from spans
    trace_aggregates: dict[str, dict[str, Any]] = {}
    for span_item in batch.spans:
        t_id = span_item.trace_id
        started = ensure_utc(span_item.started_at)
        ended = ensure_utc(span_item.ended_at)
        tokens = span_item.prompt_tokens + span_item.completion_tokens
        cost = span_item.cost
        is_error = span_item.status == "error"

        if t_id not in trace_aggregates:
            trace_aggregates[t_id] = {
                "trace_id": t_id,
                "project_id": project_id,
                "name": span_item.name,
                "started_at": started,
                "ended_at": ended,
                "status": "error" if is_error else "ok",
                "total_tokens": tokens,
                "total_cost": cost,
                "user_id": None,
                "session_id": None,
                "tags": [],
                "metadata": {},
            }
        else:
            agg = trace_aggregates[t_id]
            if started and started < agg["started_at"]:
                agg["started_at"] = started
            if ended and (agg["ended_at"] is None or ended > agg["ended_at"]):
                agg["ended_at"] = ended
            agg["total_tokens"] += tokens
            agg["total_cost"] += cost
            if is_error:
                agg["status"] = "error"
            # Prefer root span name if available
            if span_item.parent_span_id is None:
                agg["name"] = span_item.name

    # 2. Merge explicit trace metadata if provided in the batch
    for trace_item in batch.traces:
        t_id = trace_item.trace_id
        if t_id in trace_aggregates:
            if trace_item.name:
                trace_aggregates[t_id]["name"] = trace_item.name
            if trace_item.user_id:
                trace_aggregates[t_id]["user_id"] = trace_item.user_id
            if trace_item.session_id:
                trace_aggregates[t_id]["session_id"] = trace_item.session_id
            if trace_item.tags:
                trace_aggregates[t_id]["tags"] = trace_item.tags
            if trace_item.metadata:
                trace_aggregates[t_id]["metadata"] = trace_item.metadata
        else:
            # Standalone trace metadata
            trace_aggregates[t_id] = {
                "trace_id": t_id,
                "project_id": project_id,
                "name": trace_item.name or "unnamed_trace",
                "started_at": datetime.now(UTC),
                "ended_at": None,
                "status": "ok",
                "total_tokens": 0,
                "total_cost": 0.0,
                "user_id": trace_item.user_id,
                "session_id": trace_item.session_id,
                "tags": trace_item.tags,
                "metadata": trace_item.metadata,
            }

    trace_records = list(trace_aggregates.values())

    # 3. Upsert traces first so foreign keys are satisfied
    await execute_upsert(
        session=session,
        model=Trace,
        values=trace_records,
        index_elements=["trace_id"],
        update_columns=[
            "ended_at",
            "status",
            "total_tokens",
            "total_cost",
            "user_id",
            "session_id",
            "tags",
            "metadata",
        ],
    )

    # 4. Prepare and upsert spans
    span_records: list[dict[str, Any]] = []
    for s in batch.spans:
        span_records.append(
            {
                "span_id": s.span_id,
                "trace_id": s.trace_id,
                "parent_span_id": s.parent_span_id,
                "project_id": project_id,
                "name": s.name,
                "type": s.type,
                "started_at": ensure_utc(s.started_at),
                "ended_at": ensure_utc(s.ended_at),
                "duration_ms": s.duration_ms,
                "ttft_ms": s.ttft_ms,
                "status": s.status,
                "error_type": s.error_type,
                "error_message": s.error_message,
                "model": s.model,
                "provider": s.provider,
                "prompt_tokens": s.prompt_tokens,
                "completion_tokens": s.completion_tokens,
                "cost": s.cost,
                "cost_is_estimated": s.cost_is_estimated,
                "input": s.input,
                "output": s.output,
                "metadata": s.metadata,
            }
        )

    await execute_upsert(
        session=session,
        model=Span,
        values=span_records,
        index_elements=["span_id"],
        update_columns=[
            "ended_at",
            "duration_ms",
            "ttft_ms",
            "status",
            "error_type",
            "error_message",
            "prompt_tokens",
            "completion_tokens",
            "cost",
            "cost_is_estimated",
            "input",
            "output",
            "metadata",
        ],
    )

    await session.commit()
    return len(span_records), len(trace_records)
