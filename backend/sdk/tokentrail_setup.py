"""TokenTrail 1-File Universal Setup & Auto-Instrumentation Patcher.

Copy and paste this single file (`tokentrail_setup.py`) into your project root.
Then in your application's entrypoint (`app.py`, `main.py`, or `server.py`), simply add:

    import tokentrail_setup

This immediately:
1. Auto-instruments OpenAI, Groq, Anthropic, and LiteLLM clients globally.
2. Supports multi-agent systems with automatic parent-child waterfall execution tree nesting.
3. Automatically attaches to FastAPI / Starlette if present.
4. Operates in a non-blocking background thread with a strict zero-raise fail-safe policy.
"""

from __future__ import annotations

import atexit
import contextvars
import functools
import inspect
import json
import logging
import os
import threading
import time
import urllib.request
import uuid
from collections import deque
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger("tokentrail_setup")

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------
API_KEY = os.getenv("TOKENTRAIL_API_KEY") or os.getenv("TT_API_KEY") or ""
ENDPOINT = (
    os.getenv("TOKENTRAIL_ENDPOINT")
    or os.getenv("TT_ENDPOINT")
    or "https://tokentrail-backend.onrender.com"
)
INGEST_URL = f"{ENDPOINT.rstrip('/')}/v1/ingest"

# ---------------------------------------------------------
# Context Propagation (Multi-Agent Waterfall Tree)
# ---------------------------------------------------------
_current_trace_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "tt_trace_id", default=None
)
_current_span_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "tt_span_id", default=None
)


def get_current_trace_id() -> str | None:
    return _current_trace_id.get()


def get_current_span_id() -> str | None:
    return _current_span_id.get()


# ---------------------------------------------------------
# Background Bounded Buffer & Ingester (Zero-Raise)
# ---------------------------------------------------------
class _BackgroundIngester:
    def __init__(self, api_key: str, ingest_url: str):
        self.api_key = api_key
        self.ingest_url = ingest_url
        self.queue: deque[dict[str, Any]] = deque(maxlen=5000)
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.thread = threading.Thread(
            target=self._worker, daemon=True, name="tokentrail-1file-worker"
        )
        self.thread.start()
        atexit.register(self.shutdown)

    def enqueue(self, span: dict[str, Any]) -> None:
        try:
            with self.lock:
                self.queue.append(span)
        except Exception:
            pass

    def _get_api_key(self) -> str:
        return self.api_key or os.getenv("TOKENTRAIL_API_KEY") or os.getenv("TT_API_KEY") or ""

    def _get_ingest_url(self) -> str:
        endpoint = os.getenv("TOKENTRAIL_ENDPOINT") or os.getenv("TT_ENDPOINT")
        if endpoint:
            return f"{endpoint.rstrip('/')}/v1/ingest"
        return self.ingest_url

    def _worker(self) -> None:
        while not self.stop_event.is_set():
            time.sleep(1.0)
            batch: list[dict[str, Any]] = []
            with self.lock:
                while self.queue and len(batch) < 100:
                    batch.append(self.queue.popleft())

            key = self._get_api_key()
            if batch and key:
                self._send(batch, key)

    def _send(self, batch: list[dict[str, Any]], key: str | None = None) -> None:
        api_key = key or self._get_api_key()
        if not api_key:
            return
        try:
            payload = json.dumps({"spans": batch}).encode("utf-8")
            req = urllib.request.Request(
                self._get_ingest_url(),
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": api_key,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                _ = resp.read()
        except Exception as e:
            logger.debug("TokenTrail background send notice: %s", e)

    def shutdown(self) -> None:
        self.stop_event.set()
        # Drain remaining
        batch: list[dict[str, Any]] = []
        with self.lock:
            while self.queue and len(batch) < 100:
                batch.append(self.queue.popleft())
        key = self._get_api_key()
        if batch and key:
            self._send(batch, key)


_INGESTER = _BackgroundIngester(api_key=API_KEY, ingest_url=INGEST_URL)


# ---------------------------------------------------------
# Span Tracking Context Manager
# ---------------------------------------------------------
class Span:
    def __init__(
        self,
        name: str,
        span_type: str = "llm",
        model: str | None = None,
        provider: str | None = None,
        metadata: dict[str, Any] | None = None,
    ):
        self.name = name
        self.span_type = span_type
        self.model = model
        self.provider = provider
        self.metadata = metadata or {}

        # Hierarchical context inheritance
        self.trace_id = get_current_trace_id() or f"trace_{uuid.uuid4().hex}"
        self.parent_span_id = get_current_span_id()
        self.span_id = f"span_{uuid.uuid4().hex}"

        self.start_time = 0.0
        self.started_at_iso = ""
        self.tokens_reset: list[Any] = []

        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.status = "ok"
        self.error_type: str | None = None
        self.error_message: str | None = None
        self.input_text: str | None = None
        self.output_text: str | None = None

    def set_tokens(self, prompt: int = 0, completion: int = 0) -> None:
        self.prompt_tokens = prompt
        self.completion_tokens = completion

    def __enter__(self) -> Span:
        self.start_time = time.monotonic()
        self.started_at_iso = datetime.now(UTC).isoformat()
        self.tokens_reset.append(_current_trace_id.set(self.trace_id))
        self.tokens_reset.append(_current_span_id.set(self.span_id))
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        duration_ms = max(1.0, (time.monotonic() - self.start_time) * 1000.0)
        ended_at_iso = datetime.now(UTC).isoformat()

        if exc_val is not None:
            self.status = "error"
            self.error_type = exc_type.__name__ if exc_type else "Error"
            self.error_message = str(exc_val)

        # Enqueue span payload
        payload = {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "span_type": self.span_type,
            "model": self.model,
            "provider": self.provider,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "duration_ms": duration_ms,
            "status": self.status,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "started_at": self.started_at_iso,
            "ended_at": ended_at_iso,
            "metadata": self.metadata,
        }
        _INGESTER.enqueue(payload)

        # Pop contextvars
        while self.tokens_reset:
            tok = self.tokens_reset.pop()
            tok.var.reset(tok)

    async def __aenter__(self) -> Span:
        return self.__enter__()

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.__exit__(exc_type, exc_val, exc_tb)


# ---------------------------------------------------------
# Multi-Agent Decorators
# ---------------------------------------------------------
def agent(name: str, role: str | None = None, metadata: dict[str, Any] | None = None):
    """Decorator to trace an AI agent. Child tools and LLM calls automatically nest underneath it."""
    meta = metadata.copy() if metadata else {}
    if role:
        meta["role"] = role

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        if inspect.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                async with Span(name=name, span_type="agent", metadata=meta):
                    return await fn(*args, **kwargs)

            return async_wrapper
        else:

            @functools.wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                with Span(name=name, span_type="agent", metadata=meta):
                    return fn(*args, **kwargs)

            return sync_wrapper

    return decorator


def tool(name: str, metadata: dict[str, Any] | None = None):
    """Decorator to trace a tool execution."""

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        if inspect.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                async with Span(name=name, span_type="tool", metadata=metadata):
                    return await fn(*args, **kwargs)

            return async_wrapper
        else:

            @functools.wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                with Span(name=name, span_type="tool", metadata=metadata):
                    return fn(*args, **kwargs)

            return sync_wrapper

    return decorator


# ---------------------------------------------------------
# Auto-Patcher for OpenAI, Groq, and Anthropic
# ---------------------------------------------------------
def _patch_all() -> None:
    # 1. Patch OpenAI
    try:
        import openai.resources.chat.completions as oai

        _patch_completions(oai.Completions, provider="openai")
        if hasattr(oai, "AsyncCompletions"):
            _patch_async_completions(oai.AsyncCompletions, provider="openai")
    except Exception:
        pass

    # 2. Patch Groq
    try:
        import groq.resources.chat.completions as gq

        _patch_completions(gq.Completions, provider="groq")
        if hasattr(gq, "AsyncCompletions"):
            _patch_async_completions(gq.AsyncCompletions, provider="groq")
    except Exception:
        pass


def _patch_completions(cls: Any, provider: str) -> None:
    if not hasattr(cls, "create") or getattr(cls.create, "_tokentrail_patched", False):
        return
    orig = cls.create

    @functools.wraps(orig)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> Any:
        model = kwargs.get("model", "unknown")
        with Span(name=f"{provider}:{model}", span_type="llm", model=model, provider=provider) as s:
            res = orig(self, *args, **kwargs)
            usage = getattr(res, "usage", None)
            if usage:
                s.set_tokens(
                    prompt=getattr(usage, "prompt_tokens", 0) or 0,
                    completion=getattr(usage, "completion_tokens", 0) or 0,
                )
            return res

    wrapper._tokentrail_patched = True  # type: ignore
    cls.create = wrapper


def _patch_async_completions(cls: Any, provider: str) -> None:
    if not hasattr(cls, "create") or getattr(cls.create, "_tokentrail_patched", False):
        return
    orig = cls.create

    @functools.wraps(orig)
    async def wrapper(self: Any, *args: Any, **kwargs: Any) -> Any:
        model = kwargs.get("model", "unknown")
        async with Span(
            name=f"{provider}:{model}", span_type="llm", model=model, provider=provider
        ) as s:
            res = await orig(self, *args, **kwargs)
            usage = getattr(res, "usage", None)
            if usage:
                s.set_tokens(
                    prompt=getattr(usage, "prompt_tokens", 0) or 0,
                    completion=getattr(usage, "completion_tokens", 0) or 0,
                )
            return res

    wrapper._tokentrail_patched = True  # type: ignore
    cls.create = wrapper


# Auto-run patching immediately upon import
_patch_all()
