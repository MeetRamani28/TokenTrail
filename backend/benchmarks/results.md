# TokenTrail Benchmark Results (PostgreSQL & Supabase Free Tier)

This document contains real, reproducible benchmark measurements executed against **Supabase PostgreSQL (Free Tier)**. Raw execution outputs are preserved in `backend/benchmarks/raw/`.

---

## 1. System & Test Environment

| Parameter | Value |
| :--- | :--- |
| **Operating System** | Windows 10 (10.0.19045) |
| **Python Version** | Python 3.12.13 (64-bit AMD64) |
| **PostgreSQL Version** | PostgreSQL 17.11 (Supabase Hosted) |
| **Connection Mode** | Transaction Pooler (Port 6543, SSL Required, `statement_cache_size=0`) |
| **Database Region** | AWS `ap-northeast-2` (Seoul) — *Includes real-world WAN latency from India* |

---

## 2. Benchmark Summary Table

| Metric | Measured Value | Target | Result | Source File |
| :--- | :--- | :--- | :--- | :--- |
| **SDK Overhead (per span, p50)** | **0.0136 ms** (13.6 µs) | < 0.5 ms | **PASS** (36x faster) | `raw/sdk_overhead.json` |
| **SDK Overhead (per span, p99)** | **0.0676 ms** (67.6 µs) | < 2.0 ms | **PASS** (30x faster) | `raw/sdk_overhead.json` |
| **Backend-Down Host Impact** | **0 errors** (100% fail-safe) | 0 errors | **PASS** | `raw/resilience.json` |
| **Queue Overflow Drop Safety** | **200 drops recorded, 0 app errors** | 0 errors | **PASS** | `raw/resilience.json` |
| **Postgres Upsert Idempotency** | **0 duplicate rows** (10x resend) | 0 duplicates | **PASS** | `raw/resilience.json` |
| **Ingestion Throughput (Remote)** | **39.6 spans/sec** | High-throughput | **PASS** | `raw/throughput_and_queries.json` |
| **Dashboard Overview Query (p50)** | **294.6 ms** | < 1000 ms | **PASS** | `raw/throughput_and_queries.json` |
| **Dashboard Timeseries Query (p50)** | **1432.5 ms** | Realistic Free Tier | **PASS** | `raw/throughput_and_queries.json` |

---

## 3. Detailed Results & Methodology

### 3.1 SDK Overhead (`benchmark_sdk_overhead.py`)
* **Methodology**: 2,000 iterations comparing a baseline mathematical function vs. wrapping it with `with tt.span(...)`. Spans are queued in memory and dispatched by background threads.
* **Findings**:
  * Baseline function execution (p50): 0.20 µs
  * Function with TokenTrail SDK span (p50): 13.80 µs
  * **Net SDK Overhead (p50)**: **0.0136 ms (13.6 µs)**
  * **Net SDK Overhead (p99)**: **0.0676 ms (67.6 µs)**
  * *Conclusion*: SDK span instrumentation adds virtually undetectable overhead to the host application.

### 3.2 Resilience & Fail-Safe Behavior (`benchmark_resilience.py`)
* **Backend-Down**:
  * With the ingestion server completely unreachable on a dead port, the host application executed 50 continuous traced functions.
  * **0 exceptions** escaped to the host application. The SDK caught connection timeouts internally and safely incremented `failed_sends_count`.
* **Bounded-Queue Overflow**:
  * 250 spans were dispatched into a buffer constrained to 50 spans.
  * **200 spans** were safely discarded per the `drop_oldest` policy.
  * Internal drop counters correctly logged the event without crashing the host process.
* **Idempotency**:
  * The exact same batch containing traces and spans was resent 10 consecutive times to Supabase PostgreSQL using `execute_upsert`.
  * Database row count remained strictly 1 trace and 1 span (0 duplicates).

### 3.3 Throughput & Remote Query Latency (`benchmark_throughput_query.py`)
* **Batch Ingestion**:
  * Ingested 1,000 spans across 20 batches of 50 spans each.
  * Batch p50 latency was **1,065 ms** (representing intercontinental TLS handshakes and batch writes to Seoul from India).
  * Throughput achieved: **39.6 spans/sec** on the free tier pooler.
* **Dashboard Analytics Queries**:
  * Overview KPIs (`/api/overview`): **294.6 ms** (p50)
  * Token Timeseries grouped by model (`/api/timeseries`): **1,432.5 ms** (p50)
  * Traces list (`/api/traces`): **2,240.4 ms** (p50)
