import time
from datetime import UTC, datetime

import httpx
from tokentrail import TokenTrail
from tokentrail.queue import BoundedSpanQueue
from tokentrail.types import SpanData


def test_queue_overflow_drop_oldest() -> None:
    """When buffer exceeds max_size with drop_oldest, oldest spans are discarded."""
    queue = BoundedSpanQueue(max_size=5, drop_policy="drop_oldest")
    now = datetime.now(UTC)

    for i in range(15):
        span = SpanData(span_id=f"s_{i}", trace_id="t1", name=f"span_{i}", started_at=now)
        queue.put(span)

    assert queue.qsize() == 5
    assert queue.dropped_count == 10

    # Oldest 0..9 were dropped, 10..14 remain
    remaining = queue.get_batch(10, timeout=0.0)
    remaining_names = [s.name for s in remaining]
    assert remaining_names == [f"span_{i}" for i in range(10, 15)]


def test_queue_overflow_drop_newest() -> None:
    """When buffer exceeds max_size with drop_newest, incoming spans are rejected."""
    queue = BoundedSpanQueue(max_size=5, drop_policy="drop_newest")
    now = datetime.now(UTC)

    for i in range(15):
        span = SpanData(span_id=f"s_{i}", trace_id="t1", name=f"span_{i}", started_at=now)
        queue.put(span)

    assert queue.qsize() == 5
    assert queue.dropped_count == 10

    # Newest 5..14 were dropped, initial 0..4 remain
    remaining = queue.get_batch(10, timeout=0.0)
    remaining_names = [s.name for s in remaining]
    assert remaining_names == [f"span_{i}" for i in range(5)]


def test_backend_down_zero_host_impact() -> None:
    """If backend is completely offline (connection refused), host application runs with 0 errors."""
    # Pointing to an unused local port
    tt = TokenTrail(
        api_key="tt_mock",
        endpoint="http://127.0.0.1:59123",
        flush_interval=0.05,
        base_delay=0.01,
    )
    tt.sender._client.timeout = httpx.Timeout(0.1)

    # Host app performs critical logic
    host_results = []
    for i in range(20):
        with tt.span(f"critical_op_{i}"):
            host_results.append(i * 2)

    assert len(host_results) == 20
    assert host_results[0] == 0
    assert host_results[-1] == 38

    # Drain with flush
    tt.flush(timeout=2.0)
    assert tt.failed_sends_count > 0


def test_backend_500_internal_error_zero_host_impact() -> None:
    """If backend returns 500 error, sender handles it cleanly without crashing host application."""

    def mock_500_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"detail": "Database connection pool exhausted"})

    mock_transport = httpx.MockTransport(mock_500_handler)

    tt = TokenTrail(api_key="tt_mock", flush_interval=0.05, base_delay=0.01)
    tt.sender._client = httpx.Client(
        transport=mock_transport,
        headers={"X-API-Key": "tt_mock"},
    )

    for i in range(10):
        with tt.span(f"op_{i}"):
            pass

    tt.flush(timeout=2.0)
    assert tt.failed_sends_count > 0


def test_backend_timeout_zero_host_latency() -> None:
    """If backend requests take long to respond, host application thread is never blocked."""

    def slow_handler(request: httpx.Request) -> httpx.Response:
        time.sleep(1.0)
        return httpx.Response(200, json={"status": "ok", "accepted_spans": 1})

    mock_transport = httpx.MockTransport(slow_handler)

    tt = TokenTrail(api_key="tt_mock", flush_interval=0.1)
    tt.sender._client = httpx.Client(
        transport=mock_transport,
        timeout=0.1,
        headers={"X-API-Key": "tt_mock"},
    )

    start = time.monotonic()
    # Host execution
    for i in range(10):
        with tt.span(f"fast_host_op_{i}"):
            pass
    elapsed = time.monotonic() - start

    # 10 spans should take a few milliseconds in host thread, not 10 * 1.0s
    assert elapsed < 0.2
