from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import execute_upsert
from app.models.models import Span, Trace
from app.schemas.ingest import IngestBatchRequest
from app.services.cost import calculate_cost


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
    """Idempotently ingests a batch of spans and associated trace metadata."""
    if not batch.spans:
        return 0, 0

    # 1. Precompute costs and group trace metrics from spans
    trace_aggregates: dict[str, dict[str, Any]] = {}
    enriched_spans: list[dict[str, Any]] = []

    for span_item in batch.spans:
        t_id = span_item.trace_id
        started = ensure_utc(span_item.started_at)
        ended = ensure_utc(span_item.ended_at)

        prompt_tokens = span_item.prompt_tokens
        completion_tokens = span_item.completion_tokens
        is_estimated = span_item.cost_is_estimated

        # Fallback token estimation if tokens were 0 but text was sent for an LLM span
        if span_item.type == "llm" and prompt_tokens == 0 and span_item.input:
            prompt_tokens = max(1, len(span_item.input) // 4)
            is_estimated = True
        if span_item.type == "llm" and completion_tokens == 0 and span_item.output:
            completion_tokens = max(1, len(span_item.output) // 4)
            is_estimated = True

        tokens = prompt_tokens + completion_tokens
        cost = span_item.cost
        is_error = span_item.status == "error"

        duration_ms = span_item.duration_ms
        if (duration_ms is None or duration_ms <= 0) and started and ended:
            diff = (ended - started).total_seconds() * 1000.0
            if diff > 0:
                duration_ms = diff

        # Calculate cost dynamically if not already provided
        if (
            cost == 0.0
            and span_item.model
            and (prompt_tokens > 0 or completion_tokens > 0)
        ):
            computed_cost, est = await calculate_cost(
                session=session,
                model=span_item.model,
                provider=span_item.provider,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                timestamp=started,
            )
            cost = computed_cost
            if est:
                is_estimated = True

        enriched_spans.append(
            {
                "span_id": span_item.span_id,
                "trace_id": span_item.trace_id,
                "parent_span_id": span_item.parent_span_id,
                "project_id": project_id,
                "name": span_item.name,
                "type": span_item.type,
                "started_at": started,
                "ended_at": ended,
                "duration_ms": duration_ms,
                "ttft_ms": span_item.ttft_ms,
                "status": span_item.status,
                "error_type": span_item.error_type,
                "error_message": span_item.error_message,
                "model": span_item.model,
                "provider": span_item.provider,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "cost": cost,
                "cost_is_estimated": is_estimated,
                "input": span_item.input,
                "output": span_item.output,
                "metadata": span_item.metadata,
            }
        )

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
            if started and agg["started_at"] and started < agg["started_at"]:
                agg["started_at"] = started
            if ended and (agg["ended_at"] is None or ended > agg["ended_at"]):
                agg["ended_at"] = ended
            agg["total_tokens"] += tokens
            agg["total_cost"] += cost
            if is_error:
                agg["status"] = "error"
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

    # 3. Upsert traces
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

    # 4. Upsert spans
    await execute_upsert(
        session=session,
        model=Span,
        values=enriched_spans,
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
    return len(enriched_spans), len(trace_records)
