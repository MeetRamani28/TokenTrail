# TokenTrail Python SDK (`tokentrail`)

Official zero-overhead, fail-safe Python SDK for the TokenTrail LLM Observability platform.

## Features
- **Strict Zero-Disruption Policy**: Background queue worker; drops gracefully if queue is full.
- **Context-Aware Spans**: Nested sync & async span propagation using Python `contextvars`.
- **Automatic Retries**: Exponential backoff with jitter on transient network/server failures.
- **Privacy & Redaction**: Built-in `capture_content=False` and custom redact functions.
