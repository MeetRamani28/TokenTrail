import logging
import os
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from tokentrail.context import (
    get_current_span_id,
    get_current_trace_id,
    set_current_client,
    set_current_span_id,
    set_current_trace_id,
)
from tokentrail.queue import BoundedSpanQueue
from tokentrail.sender import BackgroundSender
from tokentrail.types import DropPolicy, RedactFn, SpanData

logger = logging.getLogger("tokentrail.client")


class SpanContextManager:
    """Hybrid sync/async context manager for spans."""

    def __init__(
        self,
        client: "TokenTrail",
        name: str,
        type_: str = "llm",
        trace_id: str | None = None,
        parent_span_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.client = client
        self.name = name
        self.type = type_
        self.trace_id = trace_id or get_current_trace_id() or f"trace_{uuid.uuid4().hex}"
        self.parent_span_id = parent_span_id or get_current_span_id()
        self.span_id = f"span_{uuid.uuid4().hex}"
        self.metadata = metadata or {}

        self.started_at: datetime | None = None
        self.ended_at: datetime | None = None
        self.duration_ms: float | None = None
        self.ttft_ms: float | None = None
        self.status: str = "ok"
        self.error_type: str | None = None
        self.error_message: str | None = None
        self.model: str | None = None
        self.provider: str | None = None
        self.prompt_tokens: int = 0
        self.completion_tokens: int = 0
        self.cost: float = 0.0
        self.cost_is_estimated: bool = False
        self.input: str | None = None
        self.output: str | None = None

        self._start_time: float = 0.0
        self._tokens: list[Any] = []

    def set_tokens(self, prompt: int = 0, completion: int = 0) -> None:
        self.prompt_tokens = prompt
        self.completion_tokens = completion

    def set_cost(self, cost: float, is_estimated: bool = False) -> None:
        self.cost = cost
        self.cost_is_estimated = is_estimated

    def set_model(self, model: str, provider: str | None = None) -> None:
        self.model = model
        self.provider = provider

    def set_ttft(self, ttft_ms: float) -> None:
        self.ttft_ms = ttft_ms

    def set_input(self, text: str | None) -> None:
        if self.client.capture_content and text is not None:
            self.input = self.client.apply_redact(text)

    def set_output(self, text: str | None) -> None:
        if self.client.capture_content and text is not None:
            self.output = self.client.apply_redact(text)

    def __enter__(self) -> "SpanContextManager":
        try:
            self.started_at = datetime.now(UTC)
            self._start_time = time.monotonic()
            self._tokens.append(set_current_trace_id(self.trace_id))
            self._tokens.append(set_current_span_id(self.span_id))
            self._tokens.append(set_current_client(self.client))
        except Exception as e:
            logger.debug("TokenTrail span enter error: %s", e)
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        try:
            self._finalize(exc_type, exc_val)
        except Exception as e:
            logger.debug("TokenTrail span exit error: %s", e)
        finally:
            self._cleanup_context()

    async def __aenter__(self) -> "SpanContextManager":
        return self.__enter__()

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.__exit__(exc_type, exc_val, exc_tb)

    def _finalize(self, exc_type: Any, exc_val: Any) -> None:
        self.ended_at = datetime.now(UTC)
        self.duration_ms = (time.monotonic() - self._start_time) * 1000.0

        if exc_val is not None:
            self.status = "error"
            self.error_type = exc_type.__name__ if exc_type else "Error"
            self.error_message = str(exc_val)

        if self.started_at is None:
            self.started_at = self.ended_at

        span_data = SpanData(
            span_id=self.span_id,
            trace_id=self.trace_id,
            parent_span_id=self.parent_span_id,
            name=self.name,
            type=self.type,
            started_at=self.started_at,
            ended_at=self.ended_at,
            duration_ms=self.duration_ms,
            ttft_ms=self.ttft_ms,
            status=self.status,  # type: ignore
            error_type=self.error_type,
            error_message=self.error_message,
            model=self.model,
            provider=self.provider,
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
            cost=self.cost,
            cost_is_estimated=self.cost_is_estimated,
            input=self.input if self.client.capture_content else None,
            output=self.output if self.client.capture_content else None,
            metadata=self.metadata,
        )

        self.client._enqueue_span(span_data)

    def _cleanup_context(self) -> None:
        while self._tokens:
            token = self._tokens.pop()
            try:
                if (
                    token.var == set_current_client.__wrapped__
                    if hasattr(set_current_client, "__wrapped__")
                    else True
                ):
                    token.var.reset(token)
            except Exception as e:
                logger.debug("TokenTrail context cleanup error: %s", e)


class TokenTrail:
    """Main client for TokenTrail LLM observability."""

    def __init__(
        self,
        api_key: str | None = None,
        endpoint: str | None = None,
        capture_content: bool = True,
        redact: RedactFn | None = None,
        drop_policy: DropPolicy = "drop_oldest",
        max_queue_size: int = 10_000,
        batch_size: int = 100,
        flush_interval: float = 2.0,
        max_retries: int = 3,
        base_delay: float = 0.5,
    ) -> None:
        self.api_key: str = str(api_key or os.getenv("TOKENTRAIL_API_KEY") or "")
        self.endpoint: str = str(
            endpoint or os.getenv("TOKENTRAIL_ENDPOINT") or "http://localhost:8000"
        )
        self.capture_content = capture_content
        self.redact = redact
        self.drop_policy = drop_policy

        self.queue = BoundedSpanQueue(max_size=max_queue_size, drop_policy=drop_policy)
        self.sender = BackgroundSender(
            api_key=self.api_key,
            endpoint=self.endpoint,
            queue=self.queue,
            batch_size=batch_size,
            flush_interval=flush_interval,
            max_retries=max_retries,
            base_delay=base_delay,
        )

    def apply_redact(self, text: str) -> str:
        """Applies the custom redact function if provided."""
        if not self.redact or not text:
            return text
        try:
            return self.redact(text)
        except Exception as e:
            logger.debug("Custom redact function failed: %s", e)
            return "[REDACTION_ERROR]"

    def span(
        self,
        name: str,
        type: str = "llm",
        trace_id: str | None = None,
        parent_span_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> SpanContextManager:
        """Returns a context manager for tracking a span."""
        return SpanContextManager(
            client=self,
            name=name,
            type_=type,
            trace_id=trace_id,
            parent_span_id=parent_span_id,
            metadata=metadata,
        )

    def wrap_openai(self, client: Any) -> Any:
        """Wraps an OpenAI or OpenAI-compatible client instance (e.g. Groq, OpenRouter)."""
        try:
            from tokentrail.instrumentation.openai import wrap_openai_client

            return wrap_openai_client(self, client)
        except Exception as e:
            logger.debug("Failed to wrap OpenAI client: %s", e)
            return client

    def _enqueue_span(self, span_data: SpanData) -> None:
        try:
            self.queue.put(span_data)
        except Exception as e:
            logger.debug("Failed to enqueue span: %s", e)

    def flush(self, timeout: float = 5.0) -> None:
        """Flushes queued spans synchronously."""
        try:
            self.sender.flush(timeout=timeout)
        except Exception as e:
            logger.debug("TokenTrail flush error: %s", e)

    def shutdown(self, timeout: float = 5.0) -> None:
        """Flushes remaining spans and terminates background sender."""
        try:
            self.sender.shutdown(timeout=timeout)
        except Exception as e:
            logger.debug("TokenTrail shutdown error: %s", e)

    @property
    def dropped_spans_count(self) -> int:
        return self.queue.dropped_count

    @property
    def failed_sends_count(self) -> int:
        return self.sender.failed_sends_count
