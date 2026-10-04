from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Span, Trace


@pytest.mark.asyncio
async def test_ingest_spans_success(
    client: AsyncClient,
    test_setup: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    api_key = test_setup["active_raw_key"]
    now = datetime.now(UTC).isoformat()

    payload = {
        "spans": [
            {
                "span_id": "span_root_001",
                "trace_id": "trace_001",
                "parent_span_id": None,
                "name": "chat_completion",
                "type": "llm",
                "started_at": now,
                "ended_at": now,
                "duration_ms": 320.5,
                "ttft_ms": 110.2,
                "status": "ok",
                "model": "llama-3.3-70b-versatile",
                "provider": "groq",
                "prompt_tokens": 150,
                "completion_tokens": 50,
                "cost": 0.00012,
                "cost_is_estimated": False,
                "input": "Hello LLM",
                "output": "Hello User!",
                "metadata": {"source": "unit_test"},
            },
            {
                "span_id": "span_child_002",
                "trace_id": "trace_001",
                "parent_span_id": "span_root_001",
                "name": "vector_search",
                "type": "retrieval",
                "started_at": now,
                "ended_at": now,
                "duration_ms": 45.0,
                "status": "ok",
                "metadata": {"docs_retrieved": 3},
            },
        ],
        "traces": [
            {
                "trace_id": "trace_001",
                "name": "user_query_pipeline",
                "user_id": "user_42",
                "session_id": "session_99",
                "tags": ["prod", "chat"],
            }
        ],
    }

    response = await client.post(
        "/v1/ingest",
        json=payload,
        headers={"X-API-Key": api_key},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["accepted_spans"] == 2
    assert data["accepted_traces"] == 1

    # Verify rows in DB
    trace_res = await db_session.execute(select(Trace).where(Trace.trace_id == "trace_001"))
    trace = trace_res.scalar_one()
    assert trace.name == "user_query_pipeline"
    assert trace.user_id == "user_42"
    assert trace.total_tokens == 200
    assert trace.total_cost == pytest.approx(0.00012)
    assert trace.status == "ok"

    spans_res = await db_session.execute(select(Span).where(Span.trace_id == "trace_001"))
    spans = spans_res.scalars().all()
    assert len(spans) == 2


@pytest.mark.asyncio
async def test_ingest_idempotency(
    client: AsyncClient,
    test_setup: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    """Verifies that sending the exact same batch 10 times stores each span and trace exactly once."""
    api_key = test_setup["active_raw_key"]
    now = datetime.now(UTC).isoformat()

    payload = {
        "spans": [
            {
                "span_id": "span_idempotent_1",
                "trace_id": "trace_idempotent",
                "name": "idempotent_llm_call",
                "type": "llm",
                "started_at": now,
                "ended_at": now,
                "prompt_tokens": 100,
                "completion_tokens": 20,
                "cost": 0.00005,
            }
        ]
    }

    # Send 10 times in succession
    for _ in range(10):
        response = await client.post(
            "/v1/ingest",
            json=payload,
            headers={"X-API-Key": api_key},
        )
        assert response.status_code == 200
        assert response.json()["accepted_spans"] == 1

    # Verify only 1 span and 1 trace exist in the DB
    spans_res = await db_session.execute(select(Span).where(Span.span_id == "span_idempotent_1"))
    spans = spans_res.scalars().all()
    assert len(spans) == 1

    traces_res = await db_session.execute(select(Trace).where(Trace.trace_id == "trace_idempotent"))
    traces = traces_res.scalars().all()
    assert len(traces) == 1


@pytest.mark.asyncio
async def test_ingest_missing_auth(client: AsyncClient) -> None:
    response = await client.post("/v1/ingest", json={"spans": []})
    assert response.status_code == 401
    assert "Missing API key" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ingest_invalid_auth(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/ingest",
        json={"spans": []},
        headers={"X-API-Key": "tt_invalid_nonexistent_key_12345"},
    )
    assert response.status_code == 401
    assert "Invalid or revoked API key" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ingest_revoked_key(
    client: AsyncClient,
    test_setup: dict[str, Any],
) -> None:
    revoked_key = test_setup["revoked_raw_key"]
    response = await client.post(
        "/v1/ingest",
        json={"spans": []},
        headers={"X-API-Key": revoked_key},
    )
    assert response.status_code == 401
    assert "Invalid or revoked API key" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ingest_oversized_batch(
    client: AsyncClient,
    test_setup: dict[str, Any],
) -> None:
    """Verifies that requests exceeding 500 spans are rejected."""
    api_key = test_setup["active_raw_key"]
    now = datetime.now(UTC).isoformat()

    large_spans = [
        {
            "span_id": f"span_{i}",
            "trace_id": "trace_large",
            "name": f"span_{i}",
            "started_at": now,
        }
        for i in range(501)
    ]

    response = await client.post(
        "/v1/ingest",
        json={"spans": large_spans},
        headers={"X-API-Key": api_key},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ingest_invalid_payload(
    client: AsyncClient,
    test_setup: dict[str, Any],
) -> None:
    """Missing required span fields returns 422."""
    api_key = test_setup["active_raw_key"]

    response = await client.post(
        "/v1/ingest",
        json={"spans": [{"name": "missing_span_id_and_trace_id"}]},
        headers={"X-API-Key": api_key},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ingest_trace_error_status_aggregation(
    client: AsyncClient,
    test_setup: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    """If any span is an error, trace status is aggregated as 'error'."""
    api_key = test_setup["active_raw_key"]
    now = datetime.now(UTC).isoformat()

    payload = {
        "spans": [
            {
                "span_id": "span_ok_1",
                "trace_id": "trace_err_agg",
                "name": "step_1",
                "status": "ok",
                "started_at": now,
            },
            {
                "span_id": "span_fail_2",
                "trace_id": "trace_err_agg",
                "name": "step_2",
                "status": "error",
                "error_type": "RateLimitError",
                "error_message": "Rate limit exceeded",
                "started_at": now,
            },
        ]
    }

    response = await client.post(
        "/v1/ingest",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
    )
    assert response.status_code == 200

    trace_res = await db_session.execute(select(Trace).where(Trace.trace_id == "trace_err_agg"))
    trace = trace_res.scalar_one()
    assert trace.status == "error"
