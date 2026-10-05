"""Benchmark Ingestion Throughput & Dashboard Queries on Supabase PostgreSQL

Measures:
1. Ingestion Throughput (spans/sec and p95 batch ingestion latency)
2. Dashboard Query Latency (/overview, /timeseries, /traces) on remote Supabase Postgres.

Saves raw results to backend/benchmarks/raw/throughput_and_queries.json.
"""

import asyncio
import json
import math
import os
import platform
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

# Add backend and SDK to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure production environment
os.environ["APP_ENV"] = "production"

from sqlalchemy import delete

from app.core.db import AsyncSessionLocal, execute_upsert
from app.models.models import Project, Span, Trace, User
from app.services.analytics import AnalyticsService


def calculate_percentile(data: list[float], p: float) -> float:
    if not data:
        return 0.0
    sorted_d = sorted(data)
    idx = (len(sorted_d) - 1) * (p / 100.0)
    floor_idx = math.floor(idx)
    ceil_idx = math.ceil(idx)
    if floor_idx == ceil_idx:
        return sorted_d[int(idx)]
    d0 = sorted_d[int(floor_idx)] * (ceil_idx - idx)
    d1 = sorted_d[int(ceil_idx)] * (idx - floor_idx)
    return d0 + d1


async def run_throughput_and_query_benchmarks() -> None:
    print("==================================================")
    print(" TokenTrail PostgreSQL Throughput & Query Benchmark")
    print(" Target: Supabase Free-Tier Remote PostgreSQL")
    print("==================================================")

    run_id = uuid.uuid4().hex[:8]
    user_id = f"u_tp_{run_id}"
    project_id = f"p_tp_{run_id}"

    # 1. Setup benchmark project
    async with AsyncSessionLocal() as session:
        u = User(id=user_id, clerk_user_id=f"clerk_{run_id}")
        p = Project(id=project_id, owner_user_id=u.id, name="Benchmark Project")
        session.add_all([u, p])
        await session.commit()

    print("[1/2] Benchmarking Ingestion Throughput (Batch Upserts)...")
    batch_count = 20
    spans_per_batch = 50
    total_spans = batch_count * spans_per_batch
    batch_latencies_ms: list[float] = []

    now = datetime.now(UTC)

    t_start = time.perf_counter()
    async with AsyncSessionLocal() as session:
        for b in range(batch_count):
            t_batch_id = f"tr_tp_{run_id}_{b}"
            trace_val = [
                {
                    "trace_id": t_batch_id,
                    "project_id": project_id,
                    "name": f"benchmark_batch_{b}",
                    "started_at": now,
                    "ended_at": now,
                    "status": "ok",
                    "total_tokens": spans_per_batch * 150,
                    "total_cost": round(spans_per_batch * 0.0001, 6),
                    "user_id": None,
                    "session_id": None,
                    "tags": ["benchmark"],
                    "metadata": {},
                }
            ]

            span_vals = [
                {
                    "span_id": f"sp_tp_{run_id}_{b}_{s}",
                    "trace_id": t_batch_id,
                    "parent_span_id": None,
                    "project_id": project_id,
                    "name": f"span_{s}",
                    "type": "llm",
                    "started_at": now,
                    "ended_at": now,
                    "duration_ms": 30.0 + s,
                    "ttft_ms": 10.0,
                    "status": "ok",
                    "error_type": None,
                    "error_message": None,
                    "model": "llama-3.3-70b-versatile" if s % 2 == 0 else "mixtral-8x7b-32768",
                    "provider": "groq",
                    "prompt_tokens": 100,
                    "completion_tokens": 50,
                    "cost": 0.0001,
                    "cost_is_estimated": False,
                    "input": None,
                    "output": None,
                    "metadata": {},
                }
                for s in range(spans_per_batch)
            ]

            b_t0 = time.perf_counter()
            await execute_upsert(session, Trace, trace_val, ["trace_id"])
            await execute_upsert(session, Span, span_vals, ["span_id"])
            await session.commit()
            b_t1 = time.perf_counter()
            batch_latencies_ms.append((b_t1 - b_t0) * 1000.0)

    total_time = time.perf_counter() - t_start
    throughput_spans_sec = total_spans / total_time
    p50_batch_ms = calculate_percentile(batch_latencies_ms, 50.0)
    p95_batch_ms = calculate_percentile(batch_latencies_ms, 95.0)

    print(f"      Ingested:           {total_spans} spans across {batch_count} batches")
    print(f"      Total Time:         {total_time:.2f}s")
    print(f"      Throughput:         {throughput_spans_sec:.1f} spans/sec")
    print(f"      Batch Latency (p50): {p50_batch_ms:.2f} ms")
    print(f"      Batch Latency (p95): {p95_batch_ms:.2f} ms")

    # 2. Benchmark Dashboard Queries
    print("[2/2] Benchmarking Analytics Service Queries...")
    query_iterations = 10
    overview_times: list[float] = []
    timeseries_times: list[float] = []
    traces_times: list[float] = []

    async with AsyncSessionLocal() as session:
        for _ in range(query_iterations):
            # Overview
            q_t0 = time.perf_counter()
            _ = await AnalyticsService.get_overview(session, project_id)
            overview_times.append((time.perf_counter() - q_t0) * 1000.0)

            # Timeseries
            q_t0 = time.perf_counter()
            _ = await AnalyticsService.get_timeseries(
                session, project_id, metric="tokens", interval="1h", group_by="model"
            )
            timeseries_times.append((time.perf_counter() - q_t0) * 1000.0)

            # Traces list
            q_t0 = time.perf_counter()
            _ = await AnalyticsService.get_traces(session, project_id, limit=20, offset=0)
            traces_times.append((time.perf_counter() - q_t0) * 1000.0)

        # Cleanup
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()

    ov_p50 = calculate_percentile(overview_times, 50.0)
    ov_p95 = calculate_percentile(overview_times, 95.0)
    ts_p50 = calculate_percentile(timeseries_times, 50.0)
    ts_p95 = calculate_percentile(timeseries_times, 95.0)
    tr_p50 = calculate_percentile(traces_times, 50.0)
    tr_p95 = calculate_percentile(traces_times, 95.0)

    print(f"      Overview Query (p50):   {ov_p50:.2f} ms | (p95): {ov_p95:.2f} ms")
    print(f"      Timeseries Query (p50): {ts_p50:.2f} ms | (p95): {ts_p95:.2f} ms")
    print(f"      Traces Query (p50):     {tr_p50:.2f} ms | (p95): {tr_p95:.2f} ms")
    print("==================================================")

    # Save raw outputs
    raw_dir = BACKEND_DIR / "benchmarks" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_file = raw_dir / "throughput_and_queries.json"

    data = {
        "timestamp": time.time(),
        "database": "Supabase PostgreSQL (Free Tier)",
        "platform": platform.platform(),
        "python_version": sys.version,
        "ingestion_benchmark": {
            "total_spans": total_spans,
            "batch_count": batch_count,
            "spans_per_batch": spans_per_batch,
            "elapsed_seconds": round(total_time, 2),
            "throughput_spans_per_sec": round(throughput_spans_sec, 2),
            "p50_batch_latency_ms": round(p50_batch_ms, 2),
            "p95_batch_latency_ms": round(p95_batch_ms, 2),
        },
        "query_benchmark": {
            "iterations": query_iterations,
            "overview_p50_ms": round(ov_p50, 2),
            "overview_p95_ms": round(ov_p95, 2),
            "timeseries_p50_ms": round(ts_p50, 2),
            "timeseries_p95_ms": round(ts_p95, 2),
            "traces_p50_ms": round(tr_p50, 2),
            "traces_p95_ms": round(tr_p95, 2),
        },
        "status": "PASS",
    }
    with open(raw_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Raw results written to: {raw_file}")


if __name__ == "__main__":
    asyncio.run(run_throughput_and_query_benchmarks())
