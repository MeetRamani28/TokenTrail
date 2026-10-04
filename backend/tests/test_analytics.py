from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Project, Span, Trace, User


@pytest.mark.asyncio
async def test_overview_empty_project(client: AsyncClient, test_setup: dict[str, Any]) -> None:
    """Empty project should return zeroed overview metrics without error."""
    resp = await client.get("/api/overview", headers={"Authorization": "Bearer test_token"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_requests"] == 0
    assert data["total_tokens"] == 0
    assert data["total_cost"] == 0.0
    assert data["error_rate"] == 0.0
    assert data["p50_latency_ms"] is None
    assert data["p95_latency_ms"] is None


@pytest.mark.asyncio
async def test_overview_aggregations_and_percentiles(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Tests overview aggregations: totals, error rate, p50, p95 across 5 traces."""
    project = test_setup["project"]
    base_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)

    # Create 5 traces with latencies: 100ms, 200ms, 300ms, 400ms, 1000ms (1 error)
    latencies = [0.1, 0.2, 0.3, 0.4, 1.0]  # in seconds
    for i, lat in enumerate(latencies):
        started = base_time + timedelta(minutes=i * 10)
        ended = started + timedelta(seconds=lat)
        t = Trace(
            trace_id=f"tr_overview_{i}",
            project_id=project.id,
            name=f"trace_{i}",
            started_at=started,
            ended_at=ended,
            status="error" if i == 4 else "ok",
            total_tokens=100 * (i + 1),
            total_cost=0.005 * (i + 1),
            tags=["prod", "api"],
        )
        db_session.add(t)

    await db_session.commit()

    resp = await client.get("/api/overview", headers={"Authorization": "Bearer test_token"})
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_requests"] == 5
    # Total tokens: 100 + 200 + 300 + 400 + 500 = 1500
    assert data["total_tokens"] == 1500
    # Total cost: 0.005 * (1 + 2 + 3 + 4 + 5) = 0.075
    assert round(data["total_cost"], 4) == 0.075
    # Error rate: 1 out of 5 = 20.0%
    assert data["error_rate"] == 20.0

    # Latencies in ms: [100, 200, 300, 400, 1000]
    # avg: (100+200+300+400+1000)/5 = 400.0
    assert data["avg_latency_ms"] == 400.0
    # p50 median: 300.0 ms
    assert data["p50_latency_ms"] == 300.0
    # p95: 4 * 0.95 = 3.8 -> 400 + 0.8 * 600 = 880.0
    assert data["p95_latency_ms"] is not None
    assert data["p95_latency_ms"] > 400.0


@pytest.mark.asyncio
async def test_timeseries_endpoints(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Verifies timeseries metrics (requests, tokens, cost, latency) and groupings."""
    project = test_setup["project"]
    t1 = datetime(2026, 1, 1, 10, 15, 0, tzinfo=UTC)
    t2 = datetime(2026, 1, 1, 10, 45, 0, tzinfo=UTC)
    t3 = datetime(2026, 1, 1, 11, 20, 0, tzinfo=UTC)

    # 3 traces across two 1-hour buckets (10:00 and 11:00)
    traces = [
        Trace(
            trace_id="tr_ts_1",
            project_id=project.id,
            name="call1",
            started_at=t1,
            ended_at=t1 + timedelta(seconds=0.2),
            status="ok",
            total_tokens=100,
            total_cost=0.002,
        ),
        Trace(
            trace_id="tr_ts_2",
            project_id=project.id,
            name="call2",
            started_at=t2,
            ended_at=t2 + timedelta(seconds=0.4),
            status="error",
            total_tokens=200,
            total_cost=0.004,
        ),
        Trace(
            trace_id="tr_ts_3",
            project_id=project.id,
            name="call3",
            started_at=t3,
            ended_at=t3 + timedelta(seconds=0.6),
            status="ok",
            total_tokens=300,
            total_cost=0.006,
        ),
    ]
    for tr in traces:
        db_session.add(tr)

    # Spans for model grouping
    spans = [
        Span(
            span_id="sp_ts_1",
            trace_id="tr_ts_1",
            project_id=project.id,
            name="llm_call",
            type="llm",
            started_at=t1,
            ended_at=t1 + timedelta(seconds=0.2),
            duration_ms=200.0,
            status="ok",
            model="llama-3.3-70b-versatile",
            prompt_tokens=80,
            completion_tokens=20,
            cost=0.002,
        ),
        Span(
            span_id="sp_ts_2",
            trace_id="tr_ts_2",
            project_id=project.id,
            name="llm_call",
            type="llm",
            started_at=t2,
            ended_at=t2 + timedelta(seconds=0.4),
            duration_ms=400.0,
            status="error",
            model="mixtral-8x7b-32768",
            prompt_tokens=150,
            completion_tokens=50,
            cost=0.004,
        ),
    ]
    for sp in spans:
        db_session.add(sp)

    await db_session.commit()

    # 1. Total requests timeseries (ungrouped)
    resp = await client.get(
        "/api/timeseries?metric=requests&interval=1h",
        headers={"Authorization": "Bearer test_token"},
    )
    assert resp.status_code == 200
    pts = resp.json()["points"]
    assert len(pts) == 2
    assert pts[0]["value"] == 2.0  # 10:00 bucket
    assert pts[1]["value"] == 1.0  # 11:00 bucket

    # 2. Total cost timeseries
    resp_cost = await client.get(
        "/api/timeseries?metric=cost&interval=1h",
        headers={"Authorization": "Bearer test_token"},
    )
    assert resp_cost.status_code == 200
    pts_cost = resp_cost.json()["points"]
    assert pts_cost[0]["value"] == 0.006  # 0.002 + 0.004

    # 3. Timeseries grouped by model
    resp_model = await client.get(
        "/api/timeseries?metric=tokens&interval=1h&group_by=model",
        headers={"Authorization": "Bearer test_token"},
    )
    assert resp_model.status_code == 200
    pts_model = resp_model.json()["points"]
    assert len(pts_model) == 2
    groups = {p["group"]: p["value"] for p in pts_model}
    assert groups["llama-3.3-70b-versatile"] == 100.0
    assert groups["mixtral-8x7b-32768"] == 200.0


@pytest.mark.asyncio
async def test_traces_list_and_filters(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Tests trace search, pagination, status filter, model filter, tag filter, and latency filter."""
    project = test_setup["project"]
    base_time = datetime(2026, 1, 1, 15, 0, 0, tzinfo=UTC)

    # Trace 1: fast ok trace
    t1 = Trace(
        trace_id="tr_filter_1",
        project_id=project.id,
        name="chat_flow",
        started_at=base_time,
        ended_at=base_time + timedelta(milliseconds=150),
        status="ok",
        total_tokens=50,
        total_cost=0.001,
        tags=["prod", "chat"],
    )
    s1 = Span(
        span_id="sp_filter_1",
        trace_id="tr_filter_1",
        project_id=project.id,
        name="llm_step",
        type="llm",
        started_at=base_time,
        ended_at=base_time + timedelta(milliseconds=150),
        duration_ms=150.0,
        model="llama-3.3-70b-versatile",
    )

    # Trace 2: slow error trace
    t2 = Trace(
        trace_id="tr_filter_2",
        project_id=project.id,
        name="rag_search",
        started_at=base_time + timedelta(minutes=5),
        ended_at=base_time + timedelta(minutes=5, milliseconds=850),
        status="error",
        total_tokens=250,
        total_cost=0.005,
        tags=["staging", "search"],
    )
    s2 = Span(
        span_id="sp_filter_2",
        trace_id="tr_filter_2",
        project_id=project.id,
        name="llm_step",
        type="llm",
        started_at=base_time + timedelta(minutes=5),
        ended_at=base_time + timedelta(minutes=5, milliseconds=850),
        duration_ms=850.0,
        model="gemma2-9b-it",
    )

    db_session.add_all([t1, s1, t2, s2])
    await db_session.commit()

    # 1. Filter by status=error
    resp_err = await client.get(
        "/api/traces?status=error", headers={"Authorization": "Bearer test_token"}
    )
    assert resp_err.status_code == 200
    res = resp_err.json()
    assert res["total_count"] == 1
    assert res["traces"][0]["trace_id"] == "tr_filter_2"

    # 2. Filter by model
    resp_mod = await client.get(
        "/api/traces?model=llama-3.3-70b-versatile",
        headers={"Authorization": "Bearer test_token"},
    )
    assert resp_mod.status_code == 200
    assert resp_mod.json()["total_count"] == 1
    assert resp_mod.json()["traces"][0]["trace_id"] == "tr_filter_1"

    # 3. Filter by tag
    resp_tag = await client.get(
        "/api/traces?tag=chat", headers={"Authorization": "Bearer test_token"}
    )
    assert resp_tag.status_code == 200
    assert resp_tag.json()["total_count"] == 1
    assert resp_tag.json()["traces"][0]["trace_id"] == "tr_filter_1"

    # 4. Filter by latency
    resp_lat = await client.get(
        "/api/traces?min_latency_ms=500", headers={"Authorization": "Bearer test_token"}
    )
    assert resp_lat.status_code == 200
    assert resp_lat.json()["total_count"] == 1
    assert resp_lat.json()["traces"][0]["trace_id"] == "tr_filter_2"

    # 5. Pagination
    resp_page = await client.get(
        "/api/traces?limit=1&offset=0", headers={"Authorization": "Bearer test_token"}
    )
    assert resp_page.status_code == 200
    assert len(resp_page.json()["traces"]) == 1
    assert resp_page.json()["has_more"] is True


@pytest.mark.asyncio
async def test_trace_detail_and_waterfall(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Verifies detailed trace inspection with hierarchical spans and relative waterfall offsets."""
    project = test_setup["project"]
    t0 = datetime(2026, 1, 1, 16, 0, 0, tzinfo=UTC)

    # Trace
    tr = Trace(
        trace_id="tr_waterfall_root",
        project_id=project.id,
        name="agent_execution",
        started_at=t0,
        ended_at=t0 + timedelta(milliseconds=1200),
        status="ok",
        total_tokens=150,
        total_cost=0.003,
        user_id="end_user_42",
        session_id="sess_abc",
        tags=["agent", "research"],
    )
    db_session.add(tr)

    # Root span
    s_root = Span(
        span_id="sp_wf_root",
        trace_id=tr.trace_id,
        project_id=project.id,
        name="agent_workflow",
        type="chain",
        started_at=t0,
        ended_at=t0 + timedelta(milliseconds=1200),
        duration_ms=1200.0,
    )
    # Child span 1 (starts at t0 + 100ms)
    s_c1 = Span(
        span_id="sp_wf_retrieval",
        trace_id=tr.trace_id,
        parent_span_id="sp_wf_root",
        project_id=project.id,
        name="vector_search",
        type="retrieval",
        started_at=t0 + timedelta(milliseconds=100),
        ended_at=t0 + timedelta(milliseconds=300),
        duration_ms=200.0,
    )
    # Child span 2 (starts at t0 + 350ms)
    s_c2 = Span(
        span_id="sp_wf_llm",
        trace_id=tr.trace_id,
        parent_span_id="sp_wf_root",
        project_id=project.id,
        name="llm_generate",
        type="llm",
        started_at=t0 + timedelta(milliseconds=350),
        ended_at=t0 + timedelta(milliseconds=1150),
        duration_ms=800.0,
        ttft_ms=120.0,
        model="llama-3.3-70b-versatile",
        provider="groq",
        prompt_tokens=100,
        completion_tokens=50,
        cost=0.003,
        input="user query",
        output="agent response",
    )
    db_session.add_all([s_root, s_c1, s_c2])
    await db_session.commit()

    resp = await client.get(
        f"/api/traces/{tr.trace_id}", headers={"Authorization": "Bearer test_token"}
    )
    assert resp.status_code == 200
    detail = resp.json()

    assert detail["trace_id"] == "tr_waterfall_root"
    assert detail["user_id"] == "end_user_42"
    assert detail["session_id"] == "sess_abc"
    assert detail["duration_ms"] == 1200.0
    assert len(detail["spans"]) == 3

    # Check waterfall relative offsets
    spans_map = {s["span_id"]: s for s in detail["spans"]}
    assert spans_map["sp_wf_root"]["offset_ms"] == 0.0
    assert spans_map["sp_wf_retrieval"]["offset_ms"] == 100.0
    assert spans_map["sp_wf_retrieval"]["parent_span_id"] == "sp_wf_root"
    assert spans_map["sp_wf_llm"]["offset_ms"] == 350.0
    assert spans_map["sp_wf_llm"]["ttft_ms"] == 120.0
    assert spans_map["sp_wf_llm"]["model"] == "llama-3.3-70b-versatile"

    # Non-existent trace returns 404
    resp_404 = await client.get(
        "/api/traces/non_existent_id", headers={"Authorization": "Bearer test_token"}
    )
    assert resp_404.status_code == 404


@pytest.mark.asyncio
async def test_models_breakdown(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Verifies aggregate usage statistics grouped by model."""
    project = test_setup["project"]
    t0 = datetime(2026, 1, 1, 18, 0, 0, tzinfo=UTC)

    # Insert dummy traces to satisfy FK
    tr = Trace(
        trace_id="tr_models_dummy",
        project_id=project.id,
        name="test",
        started_at=t0,
        ended_at=t0,
    )
    db_session.add(tr)

    # 2 calls to llama-3.3-70b-versatile, 1 call to gemma2-9b-it
    spans = [
        Span(
            span_id="sp_m1",
            trace_id=tr.trace_id,
            project_id=project.id,
            name="call1",
            type="llm",
            started_at=t0,
            duration_ms=200.0,
            model="llama-3.3-70b-versatile",
            provider="groq",
            prompt_tokens=100,
            completion_tokens=50,
            cost=0.002,
        ),
        Span(
            span_id="sp_m2",
            trace_id=tr.trace_id,
            project_id=project.id,
            name="call2",
            type="llm",
            started_at=t0 + timedelta(minutes=1),
            duration_ms=400.0,
            model="llama-3.3-70b-versatile",
            provider="groq",
            prompt_tokens=200,
            completion_tokens=100,
            cost=0.004,
        ),
        Span(
            span_id="sp_m3",
            trace_id=tr.trace_id,
            project_id=project.id,
            name="call3",
            type="llm",
            started_at=t0 + timedelta(minutes=2),
            duration_ms=100.0,
            model="gemma2-9b-it",
            provider="groq",
            prompt_tokens=50,
            completion_tokens=25,
            cost=0.0005,
        ),
    ]
    db_session.add_all(spans)
    await db_session.commit()

    resp = await client.get("/api/models", headers={"Authorization": "Bearer test_token"})
    assert resp.status_code == 200
    models_data = resp.json()
    assert len(models_data) == 2

    m_map = {m["model"]: m for m in models_data}
    llama = m_map["llama-3.3-70b-versatile"]
    assert llama["total_calls"] == 2
    assert llama["prompt_tokens"] == 300
    assert llama["completion_tokens"] == 150
    assert llama["total_tokens"] == 450
    assert round(llama["total_cost"], 4) == 0.006
    assert llama["avg_latency_ms"] == 300.0

    gemma = m_map["gemma2-9b-it"]
    assert gemma["total_calls"] == 1
    assert gemma["total_tokens"] == 75


@pytest.mark.asyncio
async def test_strict_cross_project_isolation(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Verifies that User A cannot view User B's metrics, traces, or pass User B's project_id."""
    # 1. Create a second user (Bob) with their own project (Project B)
    user_b = User(clerk_user_id="clerk_bob")
    db_session.add(user_b)
    await db_session.flush()

    project_b = Project(owner_user_id=user_b.id, name="Bob Secret Project")
    db_session.add(project_b)
    await db_session.flush()

    # 2. Add confidential trace to Bob's project
    t_bob = Trace(
        trace_id="tr_bob_secret_42",
        project_id=project_b.id,
        name="confidential_fintech_prompt",
        started_at=datetime.now(UTC),
        ended_at=datetime.now(UTC) + timedelta(milliseconds=500),
        status="ok",
        total_tokens=9999,
        total_cost=123.456,
    )
    db_session.add(t_bob)
    await db_session.commit()

    # 3. User A (test_token / Alice) queries overview
    resp_a_overview = await client.get(
        "/api/overview", headers={"Authorization": "Bearer test_token"}
    )
    assert resp_a_overview.status_code == 200
    assert resp_a_overview.json()["total_tokens"] == 0
    assert resp_a_overview.json()["total_cost"] == 0.0

    # 4. User A attempts to list traces: Bob's trace must NOT appear
    resp_a_traces = await client.get("/api/traces", headers={"Authorization": "Bearer test_token"})
    assert resp_a_traces.status_code == 200
    assert resp_a_traces.json()["total_count"] == 0

    # 5. User A attempts to fetch Bob's trace by ID directly -> 404
    resp_a_direct = await client.get(
        f"/api/traces/{t_bob.trace_id}", headers={"Authorization": "Bearer test_token"}
    )
    assert resp_a_direct.status_code == 404

    # 6. User A tries to spoof X-Project-Id header with Bob's project ID -> 403 Forbidden
    resp_a_spoof = await client.get(
        "/api/overview",
        headers={"Authorization": "Bearer test_token", "X-Project-Id": project_b.id},
    )
    assert resp_a_spoof.status_code == 403
    assert "access denied" in resp_a_spoof.json()["detail"].lower()

    # 7. Bob authenticated with his own token can access his project
    resp_b = await client.get("/api/overview", headers={"Authorization": "Bearer clerk_bob"})
    assert resp_b.status_code == 200
    assert resp_b.json()["total_tokens"] == 9999
    assert resp_b.json()["total_cost"] == 123.456
