"""TokenTrail Smoke Test

Validates that TokenTrail functions correctly in both development (SQLite)
and production (PostgreSQL) modes.

Usage:
    # Test development mode:
    uv run python smoke_test.py

    # Test production mode:
    $env:APP_ENV="production"; uv run python smoke_test.py
"""

import asyncio
import sys
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select, text

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal, engine
from app.models.models import ApiKey, Project, Span, Trace, User


async def run_smoke_test() -> None:
    settings = get_settings()
    print("==================================================")
    print(f" TokenTrail Smoke Test: [{settings.APP_ENV.upper()} MODE]")
    print(f" Target Database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    print("==================================================")

    # 1. Test engine connectivity
    print("[1/5] Testing database connectivity...")
    async with engine.connect() as conn:
        dialect = conn.dialect.name
        res = await conn.execute(text("SELECT 1;"))
        assert res.scalar() == 1
        print(f"      Connected successfully! Dialect: {dialect}")

    # 2. Test schema and tables existence
    print("[2/5] Verifying required tables...")
    async with AsyncSessionLocal() as session:
        for model, name in [
            (User, "users"),
            (Project, "projects"),
            (ApiKey, "api_keys"),
            (Trace, "traces"),
            (Span, "spans"),
        ]:
            query = select(model).limit(1)
            await session.execute(query)
            print(f"      Table '{name}' verified.")

    # 3. Test multi-tenant trace and span ingestion
    print("[3/5] Testing trace and span write operation...")
    smoke_id = f"smoke_{uuid.uuid4().hex[:8]}"
    test_user_id = f"u_{smoke_id}"
    test_proj_id = f"p_{smoke_id}"
    test_trace_id = f"tr_{smoke_id}"
    test_span_id = f"sp_{smoke_id}"

    async with AsyncSessionLocal() as session:
        # Create test user & project
        user = User(id=test_user_id, clerk_user_id=f"clerk_{smoke_id}")
        project = Project(id=test_proj_id, owner_user_id=user.id, name="Smoke Test Project")
        session.add_all([user, project])
        await session.flush()

        # Create trace
        now = datetime.now(UTC)
        trace = Trace(
            trace_id=test_trace_id,
            project_id=project.id,
            name="smoke_test_trace",
            started_at=now,
            ended_at=now,
            status="ok",
            total_tokens=150,
            total_cost=0.0001,
        )
        session.add(trace)
        await session.flush()

        # Create span
        span = Span(
            span_id=test_span_id,
            trace_id=trace.trace_id,
            project_id=project.id,
            name="smoke_llm_call",
            type="llm",
            started_at=now,
            ended_at=now,
            duration_ms=45.2,
            ttft_ms=12.0,
            status="ok",
            model="llama-3.3-70b-versatile",
            prompt_tokens=100,
            completion_tokens=50,
            cost=0.0001,
        )
        session.add(span)
        await session.commit()
        print("      Inserted test trace and span.")

    # 4. Test query and relationship resolution
    print("[4/5] Reading back telemetry data...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Trace).where(Trace.trace_id == test_trace_id))
        fetched_trace = result.scalar_one_or_none()
        assert fetched_trace is not None, "Failed to retrieve written trace"
        assert fetched_trace.total_tokens == 150, f"Token mismatch: {fetched_trace.total_tokens}"
        print(f"      Verified trace readback: {fetched_trace.trace_id} ({fetched_trace.total_tokens} tokens)")

    # 5. Clean up smoke artifacts
    print("[5/5] Cleaning up test artifacts...")
    async with AsyncSessionLocal() as session:
        await session.execute(delete(User).where(User.id == test_user_id))
        await session.commit()
        print("      Cleaned up smoke test user, project, trace, and span.")

    print("\n>>> SMOKE TEST PASSED SUCCESSFULLY! <<<\n")


if __name__ == "__main__":
    try:
        asyncio.run(run_smoke_test())
        sys.exit(0)
    except Exception as e:
        print(f"\n[FAILED] Smoke test encountered an error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
