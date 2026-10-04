# TokenTrail Security Architecture & Verification

This document outlines the security controls, authentication mechanisms, data privacy policies, and compliance verification for TokenTrail.

---

## 1. Threat Model & Security Posture

TokenTrail is designed as a zero-overhead, multi-tenant observability platform where telemetry from AI applications is transmitted to a central ingestion engine and viewed through an authenticated dashboard.

### Core Attack Vectors & Mitigations

| Threat | Attack Vector | TokenTrail Mitigation |
| :--- | :--- | :--- |
| **API Key Theft** | Database dump or unauthorized read | Keys are hashed with SHA-256 (`key_hash`). The raw key is shown only once at creation and never stored. |
| **Supabase PostgREST Exfiltration** | Direct access via Supabase public anon key | Row-Level Security (RLS) is enabled on all tables without public policies. PostgREST rejects anon queries. |
| **Cross-Tenant Data Leakage** | User accessing traces of another project | Every trace, span, and analytics query is strictly filtered by `project_id` owned by the authenticated Clerk user. |
| **Sensitive Prompt Logging** | Telemetry leaking passwords, PII, or tokens | Client-side `capture_content=False` omission, custom regex redaction hooks, and strict header omission. |
| **Denial of Service (DoS)** | Giant batch ingestion flood | 2 MB maximum payload limit and 300 req/min per-key sliding-window rate limiting on `/v1/ingest`. |
| **Unauthorized Cron Execution** | Invoking `/internal/run-jobs` | Constant-time bearer token validation against `INTERNAL_JOBS_TOKEN`. |

---

## 2. Security Checklist & Verification

### ✅ 1. Cryptographically Secure API Keys
* **Generation**: Keys are generated using Python's `secrets.token_urlsafe(32)` prefixed with `tt_live_`.
* **Storage**: Keys are hashed using `hashlib.sha256(raw_key.encode()).hexdigest()` and stored in `api_keys.key_hash`.
* **Prefix Display**: Only `key_prefix` (first 8 characters, e.g. `tt_live_a1b2...`) is stored in plaintext for dashboard display.
* **Revocation**: Keys can be immediately revoked by setting `revoked_at = utcnow()`.

### ✅ 2. Client-Side Content Privacy & Redaction
* **`capture_content=False`**: The Python SDK supports disabling input/output content capture entirely. When set to `False`, only token counts, model names, latency, and TTFT are transmitted.
* **Redaction Hooks**: Developers can provide custom redaction callables to sanitize PII, secrets, or credit card numbers before any span is enqueued.

### ✅ 3. SDK Log Safety
* The SDK's background sender logs warnings only to standard logging channels.
* API keys and Authorization headers are never printed in exception tracebacks or logs.

### ✅ 4. Ingestion Rate Limiting & Payload Bounds
* **Payload Bound**: `/v1/ingest` validates incoming request size and returns `413 Request Entity Too Large` if payload exceeds 2 MB.
* **Rate Limiting**: In-memory sliding-window limiter enforces a 300 requests/minute ceiling per API key, returning `429 Too Many Requests` with `Retry-After: 60`.

### ✅ 5. Multi-Tenant Project Isolation
* All telemetry queries in `app/services/analytics.py` require an explicit `project_id`.
* The authenticated Clerk user's identity is verified against `projects.owner_user_id` before querying project telemetry.

### ✅ 6. Strict CORS & Secure Headers
* **CORS**: Wildcard `*` origins are rejected in production mode. Only explicit frontend domains configured in `CORS_ORIGINS` are accepted.
* **Headers Injected**:
  * `X-Content-Type-Options: nosniff`
  * `X-Frame-Options: DENY`
  * `Referrer-Policy: strict-origin-when-cross-origin`
  * `Strict-Transport-Security: max-age=31536000; includeSubDomains` (Production)

### ✅ 7. Supabase Row Level Security (RLS)
* Row Level Security is enabled on all PostgreSQL tables:
  * `users`
  * `projects`
  * `api_keys`
  * `traces`
  * `spans`
  * `model_prices`
  * `alert_rules`
  * `alert_events`
* No public access policies are granted, ensuring Supabase's auto-generated PostgREST REST API cannot expose any rows to the anonymous public key (`sb_publishable_...`). The TokenTrail backend connects directly using internal database credentials.

### ✅ 8. Data Retention & Privacy Warning
* **Automated Retention**: Project owners can configure `retention_days` (default 30 days). The background job at `/internal/run-jobs` deletes expired spans and traces.
* **Notice to Developers**: Prompts sent to LLMs frequently contain confidential context. Developers are encouraged to use `capture_content=False` in compliance-sensitive environments.

### ✅ 9. Zero-Secrets Git History
* All `.env.*` files are strictly excluded from version control via `.gitignore`.
* Only template files (`.env.example`) with dummy values are tracked.
