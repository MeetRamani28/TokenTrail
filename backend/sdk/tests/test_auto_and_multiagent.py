import asyncio

import pytest
from tokentrail import TokenTrail, agent, tool
from tokentrail.context import get_current_span_id, get_current_trace_id
from tokentrail.decorators import set_default_client


def test_multi_agent_nested_waterfall():
    """Verifies that @agent -> @tool -> child span hierarchy is properly nested."""
    tt = TokenTrail(api_key="tt_mock_key", endpoint="http://localhost:8000", flush_interval=60.0)
    tt.sender.shutdown()
    set_default_client(tt)

    recorded_traces = []
    recorded_parents = []

    @agent(name="OrchestratorAgent", role="planner")
    def run_orchestrator(query: str):
        recorded_traces.append(get_current_trace_id())
        return execute_subagent(query)

    @agent(name="WorkerAgent", role="executor")
    def execute_subagent(query: str):
        recorded_traces.append(get_current_trace_id())
        return call_tool()

    @tool(name="DatabaseSearch")
    def call_tool():
        recorded_traces.append(get_current_trace_id())
        with tt.span("sql_query", type="db") as db_span:
            recorded_parents.append(db_span.parent_span_id)
            return "ok"

    result = run_orchestrator("Find user stats")
    assert result == "ok"

    # All spans must share the exact same root trace_id!
    assert len(recorded_traces) == 3
    assert recorded_traces[0] == recorded_traces[1] == recorded_traces[2]
    assert recorded_traces[0] is not None

    # Database query must have a parent span id (the tool!)
    assert len(recorded_parents) == 1
    assert recorded_parents[0] is not None


@pytest.mark.asyncio
async def test_async_multi_agent_pipeline():
    """Verifies async agent and tool pipeline with nested context propagation."""
    tt = TokenTrail(api_key="tt_mock_key", endpoint="http://localhost:8000", flush_interval=60.0)
    tt.sender.shutdown()
    set_default_client(tt)

    @agent(name="AsyncResearchAgent")
    async def async_agent():
        root_trace = get_current_trace_id()
        agent_span = get_current_span_id()

        @tool(name="WebScraper")
        async def scrape():
            assert get_current_trace_id() == root_trace
            assert get_current_span_id() != agent_span
            await asyncio.sleep(0.01)
            return "scraped_data"

        return await scrape()

    res = await async_agent()
    assert res == "scraped_data"


def test_client_agent_and_tool_context_managers():
    """Verifies tt.agent() and tt.tool() context manager helpers."""
    tt = TokenTrail(api_key="tt_mock_key", endpoint="http://localhost:8000", flush_interval=60.0)
    tt.sender.shutdown()

    with tt.agent("PlannerAgent", role="lead") as a:
        assert a.type == "agent"
        assert a.metadata.get("role") == "lead"
        root_trace = a.trace_id

        with tt.tool("VectorIndex") as t:
            assert t.type == "tool"
            assert t.trace_id == root_trace
            assert t.parent_span_id == a.span_id
