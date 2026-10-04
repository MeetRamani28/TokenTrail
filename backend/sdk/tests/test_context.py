import asyncio

import pytest
from tokentrail import TokenTrail


def test_sync_nested_spans() -> None:
    tt = TokenTrail(api_key="tt_mock_key", endpoint="http://localhost:8000")

    with tt.span("root_span", type="chain") as root:
        assert root.parent_span_id is None
        root_trace_id = root.trace_id

        with tt.span("child_span_1", type="retrieval") as child1:
            assert child1.trace_id == root_trace_id
            assert child1.parent_span_id == root.span_id

            with tt.span("grandchild_span", type="llm") as grandchild:
                assert grandchild.trace_id == root_trace_id
                assert grandchild.parent_span_id == child1.span_id

        with tt.span("child_span_2", type="llm") as child2:
            assert child2.trace_id == root_trace_id
            assert child2.parent_span_id == root.span_id

    # Queue should contain 4 spans
    assert tt.queue.qsize() == 4
    spans = tt.queue.get_batch(10, timeout=0.0)
    names = [s.name for s in spans]
    # Children finalize and enqueue before parent exits
    assert "grandchild_span" in names
    assert "child_span_1" in names
    assert "child_span_2" in names
    assert "root_span" in names


@pytest.mark.asyncio
async def test_async_nested_spans() -> None:
    tt = TokenTrail(api_key="tt_mock_key", endpoint="http://localhost:8000")

    async with tt.span("async_root", type="chain") as root:
        root_trace = root.trace_id

        async def subtask(task_name: str) -> None:
            async with tt.span(task_name, type="tool") as child:
                assert child.trace_id == root_trace
                assert child.parent_span_id == root.span_id
                await asyncio.sleep(0.01)

        await asyncio.gather(subtask("task_a"), subtask("task_b"))

    assert tt.queue.qsize() == 3
