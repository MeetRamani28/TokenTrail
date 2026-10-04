# TokenTrail ⚡

> Lightweight, zero-overhead LLM observability and cost-tracking engine built for production AI agents and applications.

---

## 1. What is TokenTrail?
TokenTrail is a self-hostable, developer-friendly LLM observability platform built with free tiers and free tools. It offers:
- **Fail-Safe Python SDK** (`tokentrail`): Non-blocking tracing for sync/async functions, LLM completions, and streaming responses with bounded-queue buffering.
- **FastAPI Ingestion Engine**: High-throughput, idempotent trace ingestion with dynamic model pricing and retention management.
- **Modern Dashboard**: Next-gen UI built with React, Vite, Tailwind CSS v4, Redux Toolkit, and TanStack Query with waterfall trace timelines and real-time cost analytics.

---

## 2. Why TokenTrail? (Honest Comparison)

| Feature | TokenTrail | Langfuse / LangSmith / Phoenix |
|---|---|---|
| **Deployment Footprint** | Single process (no Docker/Redis needed, runs on free tiers) | Multi-container Docker/K8s setup, Postgres + ClickHouse/Redis |
| **SDK Host Safety** | Bounded in-memory queue, background worker, strict zero-raise policy | Varies; some SDKs block or drop silently without local metrics |
| **Cost Engine** | Fully editable runtime database pricing (`model_prices`) | Hardcoded or remote catalog synced |
| **What TokenTrail does NOT do** | No complex prompt playgrounds, no LLM-as-a-judge eval pipelines, no multi-tenant enterprise SSO (designed lean) | Full enterprise prompt versioning, eval suites, RBAC |

---

## 3. Quickstart (Without Docker)

### Run Locally

#### Development Mode (SQLite + Hot Reload)
```bash
# 1. Backend
cd backend
uv run python run.py dev

# 2. Frontend
cd frontend
npm run dev
```

#### Production Mode (Postgres + Optimized Build)
```bash
# 1. Backend
cd backend
uv run python run.py prod

# 2. Frontend
cd frontend
npm run prod:local
```

### SDK Integration in 5 Lines
```python
from tokentrail import TokenTrail

tt = TokenTrail(api_key="tt_...", endpoint="http://localhost:8000")

with tt.span("generate_summary", type="llm") as span:
    # Your LLM call here
    pass
```

---

## 4. Architecture

```
[ Your AI App / Agent ]
        │  (background non-blocking thread)
        ▼
[ TokenTrail Python SDK (tokentrail) ]
        │  (batched HTTP /v1/ingest)
        ▼
[ FastAPI Backend ] ──► [ SQLite (Dev) / Supabase Postgres (Prod) ]
        ▲
        │  (Clerk JWT Auth)
[ React Dashboard (Vite + Tailwind v4 + TanStack) ]
```

- **Non-blocking SDK**: Background thread with bounded buffer; host application never experiences latency or crashes.
- **Idempotency**: Client-generated span IDs ensure duplicate sends are upserted safely without skewing analytics.
- **Free-tier Cron Strategy**: Automated `/internal/run-jobs` trigger prevents serverless cold sleeping and processes alert rules.

---

## 5. Benchmark Results
*Benchmark suite executed on Postgres via Supabase free tier. Raw benchmark outputs are retained in `backend/benchmarks/raw/`.*

| Metric | Measured Value | Target | Status |
|---|---|---|---|
| **SDK Overhead (per span, p50)** | **0.014 ms** (13.6 µs) | < 0.5 ms | ✅ PASS (36x faster) |
| **SDK Overhead (per span, p99)** | **0.068 ms** (67.6 µs) | < 2.0 ms | ✅ PASS (30x faster) |
| **Backend-Down Host Impact** | **0 errors** (100% fail-safe) | 0 errors | ✅ PASS |
| **Queue Overflow Drop Safety** | **200 drops recorded, 0 app errors** | 0 errors | ✅ PASS |
| **PostgreSQL Upsert Idempotency** | **0 duplicate rows** (10x resend) | 0 duplicates | ✅ PASS |
| **Remote Ingestion Throughput** | **39.6 spans/sec** | High-throughput | ✅ PASS |

---

## 6. Privacy & Security
- **Content Redaction**: Support for `capture_content=False` (store only token counts and latency) and custom regex redaction hooks before spans leave your application.
- **Hashed API Keys**: Keys (`tt_...`) are displayed once at creation and stored exclusively as SHA-256 hashes.
- **Row-Level Security**: Supabase tables have RLS enabled with strict backend ownership.

---

## 7. Live Demo & Free-Tier Caveats
- **Live Dashboard**: [Pending Stage C Deployment]
- **API Backend**: [Pending Stage C Deployment]
- **Free-Tier Caveats**: Free Render instances sleep after inactivity resulting in initial ~50s cold-start on wake. Supabase projects have a 500 MB storage cap.

---

## 8. Limitations & Roadmap
- [ ] OpenTelemetry / OTLP GenAI semantic convention ingestion
- [ ] TypeScript / Node.js SDK
- [ ] User feedback and scoring attributes
- [ ] Multi-project role-based access control

---

## 9. Testing & Contributing
See [backend/docs/](backend/docs/) for in-depth architecture and testing documentation.
```bash
# Run backend tests
cd backend && uv run pytest --cov

# Run frontend tests
cd frontend && npm run test:run
```

---

## License
MIT © 2026 Meet Ramani
