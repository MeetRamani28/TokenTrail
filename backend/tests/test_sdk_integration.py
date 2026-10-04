import asyncio
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tokentrail import TokenTrail

from app.core.db import get_db
from app.main import app
from app.models.models import Span, Trace


@pytest.mark.asyncio
async def test_sdk_nested_trace_end_to_end(
    test_setup: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    """Verifies that an SDK-traced workflow produces accurate nested traces in the database."""
    api_key = test_setup["active_raw_key"]
    loop = asyncio.get_running_loop()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async_client = AsyncClient(transport=transport, base_url="http://test")

    def sync_dispatch(request: httpx.Request) -> httpx.Response:
        future = asyncio.run_coroutine_threadsafe(
            async_client.post(
                request.url.path,
                content=request.content,
                headers=dict(request.headers),
            ),
            loop,
        )
        res = future.result(timeout=5.0)
        return httpx.Response(
            status_code=res.status_code,
            content=res.content,
            headers=dict(res.headers),
        )

    mock_client = httpx.Client(
        transport=httpx.MockTransport(sync_dispatch),
        headers={"X-API-Key": api_key, "Content-Type": "application/json"},
    )

    tt = TokenTrail(api_key=api_key, endpoint="http://test", flush_interval=0.05)
    tt.sender._client = mock_client
    tt.sender.ingest_url = "http://test/v1/ingest"

    # Execute a nested agentic workflow
    with tt.span("research_assistant", type="chain") as root_span:
        with tt.span("document_retrieval", type="retrieval") as ret_span:
            ret_span.set_tokens(prompt=50, completion=0)
            ret_span.set_input("Query: quantum computing overview")
            ret_span.set_output("Found 3 documents")

        with tt.span("generate_synthesis", type="llm") as llm_span:
            llm_span.set_model("llama-3.3-70b-versatile", provider="groq")
            llm_span.set_tokens(prompt=200, completion=100)
            llm_span.set_cost(0.00025)
            llm_span.set_input("Synthesize documents...")
            llm_span.set_output("Summary of quantum computing...")

    # Await queue drainage without blocking the asyncio event loop
    start = time.monotonic()
    tt.flush(timeout=0.1)
    while (tt.queue.qsize() > 0 or tt.sender.is_sending) and (time.monotonic() - start) < 3.0:
        await asyncio.sleep(0.02)

    # Verify Trace in DB
    trace_res = await db_session.execute(select(Trace).where(Trace.trace_id == root_span.trace_id))
    trace = trace_res.scalar_one_or_none()
    assert trace is not None
    assert trace.status == "ok"
    assert trace.total_tokens == 350  # 50 + 200 + 100
    assert trace.total_cost == pytest.approx(0.00025)

    # Verify Spans in DB
    spans_res = await db_session.execute(
        select(Span).where(Span.trace_id == root_span.trace_id).order_by(Span.started_at)
    )
    db_spans = spans_res.scalars().all()
    assert len(db_spans) == 3

    span_by_name = {s.name: s for s in db_spans}
    root = span_by_name["research_assistant"]
    retrieval = span_by_name["document_retrieval"]
    llm = span_by_name["generate_synthesis"]

    assert root.parent_span_id is None
    assert retrieval.parent_span_id == root.span_id
    assert llm.parent_span_id == root.span_id
    assert llm.model == "llama-3.3-70b-versatile"
    assert llm.provider == "groq"

    await async_client.aclose()
    app.dependency_overrides.clear()
