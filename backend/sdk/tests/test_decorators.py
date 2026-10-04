import pytest
from tokentrail import TokenTrail, trace


def test_sync_trace_decorator_success() -> None:
    tt = TokenTrail(api_key="tt_mock_key")

    with tt.span("parent_context"):

        @trace(name="calculate_math", type="tool", tags=["math"])
        def add(a: int, b: int) -> int:
            return a + b

        result = add(5, 7)
        assert result == 12

    # Should have parent_context and calculate_math
    spans = tt.queue.get_batch(10, timeout=0.0)
    math_span = next(s for s in spans if s.name == "calculate_math")
    assert math_span.status == "ok"
    assert math_span.metadata.get("tags") == ["math"]


def test_sync_trace_decorator_exception_reraise() -> None:
    tt = TokenTrail(api_key="tt_mock_key")

    class CustomDomainError(RuntimeError):
        pass

    with tt.span("parent_context"):

        @trace(name="failing_operation")
        def risky_fn() -> None:
            raise CustomDomainError("Something went catastrophically wrong")

        with pytest.raises(CustomDomainError, match="Something went catastrophically wrong"):
            risky_fn()

    spans = tt.queue.get_batch(10, timeout=0.0)
    fail_span = next(s for s in spans if s.name == "failing_operation")
    assert fail_span.status == "error"
    assert fail_span.error_type == "CustomDomainError"
    assert "Something went catastrophically wrong" in (fail_span.error_message or "")


@pytest.mark.asyncio
async def test_async_trace_decorator() -> None:
    tt = TokenTrail(api_key="tt_mock_key")

    with tt.span("async_parent"):

        @trace(name="fetch_remote_data", type="retrieval")
        async def fetch() -> str:
            return "remote_payload"

        res = await fetch()
        assert res == "remote_payload"

    spans = tt.queue.get_batch(10, timeout=0.0)
    fetch_span = next(s for s in spans if s.name == "fetch_remote_data")
    assert fetch_span.status == "ok"
