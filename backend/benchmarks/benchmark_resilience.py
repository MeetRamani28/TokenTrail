"""Benchmark SDK Resilience & Idempotency

Tests:
1. Backend-down resilience (zero host exceptions when backend is unreachable)
2. Bounded-queue overflow handling (drops tracked, no host crashes)
3. Ingestion idempotency (resending spans 10x yields 0 duplicate rows in Postgres)

Saves raw results to backend/benchmarks/raw/resilience.json.
"""

import asyncio
import json
import os
import platform
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

# Add paths to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
SDK_DIR = BACKEND_DIR / "sdk" / "src"
if str(SDK_DIR) not in sys.path:
    sys.path.insert(0, str(SDK_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from tokentrail import TokenTrail

# Ensure production environment for Postgres checks
os.environ["APP_ENV"] = "production"

from sqlalchemy import delete, func, select

from app.core.db import AsyncSessionLocal, execute_upsert
from app.models.models import Project, Span, Trace, User


def test_backend_down() -> dict[str, float | int | str]:
    print("[1/3] Testing Backend-Down Resilience...")
    # Point to non-existent endpoint
    tt = TokenTrail(
        api_key="tt_live_offline_test",
        endpoint="http://127.0.0.1:59999",
        batch_size=5,
        flush_interval=0.1,
        max_retries=1,
    )

    host_exceptions = 0
    total_calls = 50
    t0 = time.time()

    for i in range(total_calls):
        try:
            with tt.span(f"offline_call_{i}", type="llm"):
                # Simulating application logic
                _ = i * 42
        except Exception as e:
            host_exceptions += 1
            print(f"ERROR: Host experienced exception: {e}")

    # Allow background sender to attempt delivery and exhaust retries
    time.sleep(2.0)
    tt.shutdown(timeout=2.0)
    elapsed = time.time() - t0

    failed_sends = tt.failed_sends_count
    print(
        f"      Calls: {total_calls}, Host Exceptions: {host_exceptions}, Sender Failures: {failed_sends}"
    )
    assert host_exceptions == 0, f"Expected 0 host exceptions, got {host_exceptions}"

    return {
        "calls": total_calls,
        "host_exceptions": host_exceptions,
        "sender_failures": failed_sends,
        "elapsed_seconds": round(elapsed, 2),
        "status": "PASS",
    }


def test_queue_overflow() -> dict[str, int | str]:
    print("[2/3] Testing Queue Overflow & Drop Counter...")
    max_queue = 50
    total_spans = 250

    tt = TokenTrail(
        api_key="tt_live_overflow_test",
        endpoint="http://127.0.0.1:59999",
        max_queue_size=max_queue,
        batch_size=50,
        flush_interval=100.0,  # Do not flush
    )

    host_exceptions = 0
    for i in range(total_spans):
        try:
            with tt.span(f"overflow_{i}", type="tool"):
                pass
        except Exception:
            host_exceptions += 1

    dropped = tt.dropped_spans_count
    tt.shutdown(timeout=0.1)

    expected_drops = total_spans - max_queue
    print(
        f"      Enqueued: {total_spans}, Max Queue: {max_queue}, Dropped: {dropped}, Host Exceptions: {host_exceptions}"
    )
    assert host_exceptions == 0, "Host experienced an error during overflow"
    assert dropped >= expected_drops, f"Expected at least {expected_drops} drops, got {dropped}"

    return {
        "enqueued": total_spans,
        "max_queue_size": max_queue,
        "dropped_spans": dropped,
        "host_exceptions": host_exceptions,
        "status": "PASS",
    }


async def test_idempotency_postgres() -> dict[str, int | str]:
    print("[3/3] Testing Idempotency on Supabase PostgreSQL...")
    run_id = uuid.uuid4().hex[:8]
    user_id = f"u_idem_{run_id}"
    project_id = f"p_idem_{run_id}"
    trace_id = f"tr_idem_{run_id}"
    span_id = f"sp_idem_{run_id}"

    async with AsyncSessionLocal() as session:
        # Seed test project
        u = User(id=user_id, clerk_user_id=f"clerk_{run_id}")
        p = Project(id=project_id, owner_user_id=u.id, name="Idempotency Test")
        session.add_all([u, p])
        await session.commit()

    now = datetime.now(UTC)
    trace_values = [
        {
            "trace_id": trace_id,
            "project_id": project_id,
            "name": "idempotent_trace",
            "started_at": now,
            "ended_at": now,
            "status": "ok",
            "total_tokens": 100,
            "total_cost": 0.001,
            "user_id": None,
            "session_id": None,
            "tags": [],
            "metadata": {},
        }
    ]

    span_values = [
        {
            "span_id": span_id,
            "trace_id": trace_id,
            "parent_span_id": None,
            "project_id": project_id,
            "name": "idempotent_span",
            "type": "llm",
            "started_at": now,
            "ended_at": now,
            "duration_ms": 25.0,
            "ttft_ms": 10.0,
            "status": "ok",
            "error_type": None,
            "error_message": None,
            "model": "llama-3.3-70b-versatile",
            "provider": "groq",
            "prompt_tokens": 70,
            "completion_tokens": 30,
            "cost": 0.001,
            "cost_is_estimated": False,
            "input": "test prompt",
            "output": "test completion",
            "metadata": {},
        }
    ]

    # Ingest the exact same trace and span 10 times consecutively
    resend_count = 10
    async with AsyncSessionLocal() as session:
        for _ in range(resend_count):
            await execute_upsert(
                session=session,
                model=Trace,
                values=trace_values,
                index_elements=["trace_id"],
            )
            await execute_upsert(
                session=session,
                model=Span,
                values=span_values,
                index_elements=["span_id"],
            )
            await session.commit()

    # Query Postgres to count actual rows
    async with AsyncSessionLocal() as session:
        t_count = await session.scalar(
            select(func.count()).select_from(Trace).where(Trace.project_id == project_id)
        )
        s_count = await session.scalar(
            select(func.count()).select_from(Span).where(Span.project_id == project_id)
        )

        # Cleanup
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()

    duplicates = (t_count - 1) + (s_count - 1)
    print(
        f"      Resent {resend_count} times -> Database row count: Traces={t_count}, Spans={s_count} (Duplicates={duplicates})"
    )
    assert duplicates == 0, f"Expected 0 duplicates, got {duplicates}"

    return {
        "resend_iterations": resend_count,
        "database_traces": int(t_count),
        "database_spans": int(s_count),
        "duplicates_detected": duplicates,
        "status": "PASS",
    }


def main() -> None:
    print("==================================================")
    print(" TokenTrail SDK Resilience & Idempotency Benchmark")
    print("==================================================")

    res_down = test_backend_down()
    res_overflow = test_queue_overflow()
    res_idem = asyncio.run(test_idempotency_postgres())

    print("--------------------------------------------------")
    print("All Resilience & Idempotency Benchmarks PASSED!")
    print("==================================================")

    raw_dir = BACKEND_DIR / "benchmarks" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_file = raw_dir / "resilience.json"

    data = {
        "timestamp": time.time(),
        "platform": platform.platform(),
        "python_version": sys.version,
        "backend_down_resilience": res_down,
        "queue_overflow": res_overflow,
        "postgres_idempotency": res_idem,
    }
    with open(raw_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Raw results written to: {raw_file}")


if __name__ == "__main__":
    main()
