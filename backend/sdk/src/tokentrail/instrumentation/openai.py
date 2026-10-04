import functools
import inspect
import time
from collections.abc import AsyncIterator, Iterator
from typing import Any

from tokentrail.client import TokenTrail
from tokentrail.token_counter import estimate_messages_tokens, estimate_tokens


def detect_provider(client: Any) -> str:
    """Infers provider name from base_url or client type."""
    base_url = str(getattr(client, "base_url", "")).lower()
    if "groq.com" in base_url:
        return "groq"
    if "openrouter" in base_url:
        return "openrouter"
    if "together" in base_url:
        return "together"
    if "anthropic" in base_url:
        return "anthropic"
    if "openai" in base_url:
        return "openai"
    return "openai"


def format_messages_input(messages: list[dict[str, Any]] | None) -> str | None:
    if not messages:
        return None
    parts = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        parts.append(f"{role}: {content}")
    return "\n".join(parts)


def wrap_openai_client(tt: TokenTrail, client: Any) -> Any:
    """Wraps an OpenAI or OpenAI-compatible client instance."""
    if not hasattr(client, "chat") or not hasattr(client.chat, "completions"):
        return client

    original_create = client.chat.completions.create
    provider = detect_provider(client)

    if inspect.iscoroutinefunction(original_create):

        @functools.wraps(original_create)
        async def async_create_wrapper(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "unknown")
            messages = kwargs.get("messages", [])
            is_stream = kwargs.get("stream", False)

            span = tt.span(name="chat_completion", type="llm")
            span.set_model(model=model, provider=provider)
            span.set_input(format_messages_input(messages))
            span.__enter__()

            start_time = time.monotonic()

            try:
                result = await original_create(*args, **kwargs)

                if is_stream:
                    return _wrap_async_stream(tt, span, result, model, messages, start_time)
                else:
                    _finalize_non_streaming_span(span, result, model, messages)
                    return result

            except Exception as exc:
                span.__exit__(type(exc), exc, None)
                raise

        client.chat.completions.create = async_create_wrapper

    else:

        @functools.wraps(original_create)
        def sync_create_wrapper(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "unknown")
            messages = kwargs.get("messages", [])
            is_stream = kwargs.get("stream", False)

            span = tt.span(name="chat_completion", type="llm")
            span.set_model(model=model, provider=provider)
            span.set_input(format_messages_input(messages))
            span.__enter__()

            start_time = time.monotonic()

            try:
                result = original_create(*args, **kwargs)

                if is_stream:
                    return _wrap_sync_stream(tt, span, result, model, messages, start_time)
                else:
                    _finalize_non_streaming_span(span, result, model, messages)
                    return result

            except Exception as exc:
                span.__exit__(type(exc), exc, None)
                raise

        client.chat.completions.create = sync_create_wrapper

    return client


def _finalize_non_streaming_span(
    span: Any,
    response: Any,
    model: str,
    messages: list[dict[str, Any]],
) -> None:
    try:
        # Extract output text
        output_text = None
        if hasattr(response, "choices") and response.choices:
            msg = getattr(response.choices[0], "message", None)
            if msg and hasattr(msg, "content"):
                output_text = msg.content
        span.set_output(output_text)

        # Extract or estimate tokens
        usage = getattr(response, "usage", None)
        if usage:
            prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(usage, "completion_tokens", 0) or 0
            span.set_tokens(prompt=prompt_tokens, completion=completion_tokens)
            span.set_cost(cost=0.0, is_estimated=False)
        else:
            prompt_tokens = estimate_messages_tokens(messages, model=model)
            completion_tokens = estimate_tokens(output_text, model=model)
            span.set_tokens(prompt=prompt_tokens, completion=completion_tokens)
            span.set_cost(cost=0.0, is_estimated=True)
    finally:
        span.__exit__(None, None, None)


def _wrap_sync_stream(
    tt: TokenTrail,
    span: Any,
    stream: Iterator[Any],
    model: str,
    messages: list[dict[str, Any]],
    start_time: float,
) -> Iterator[Any]:
    first_token_time: float | None = None
    accumulated_content: list[str] = []
    final_usage: Any | None = None

    try:
        for chunk in stream:
            if hasattr(chunk, "choices") and chunk.choices:
                delta = getattr(chunk.choices[0], "delta", None)
                content = getattr(delta, "content", None) if delta else None
                if content:
                    if first_token_time is None:
                        first_token_time = time.monotonic()
                        ttft_ms = (first_token_time - start_time) * 1000.0
                        span.set_ttft(ttft_ms)
                    accumulated_content.append(content)

            if hasattr(chunk, "usage") and chunk.usage:
                final_usage = chunk.usage

            yield chunk

        # Stream exhausted successfully
        full_output = "".join(accumulated_content)
        span.set_output(full_output)

        if final_usage:
            prompt_tokens = getattr(final_usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(final_usage, "completion_tokens", 0) or 0
            span.set_tokens(prompt=prompt_tokens, completion=completion_tokens)
            span.set_cost(cost=0.0, is_estimated=False)
        else:
            prompt_tokens = estimate_messages_tokens(messages, model=model)
            completion_tokens = estimate_tokens(full_output, model=model)
            span.set_tokens(prompt=prompt_tokens, completion=completion_tokens)
            span.set_cost(cost=0.0, is_estimated=True)

        span.__exit__(None, None, None)

    except Exception as exc:
        span.__exit__(type(exc), exc, None)
        raise


async def _wrap_async_stream(
    tt: TokenTrail,
    span: Any,
    stream: AsyncIterator[Any],
    model: str,
    messages: list[dict[str, Any]],
    start_time: float,
) -> AsyncIterator[Any]:
    first_token_time: float | None = None
    accumulated_content: list[str] = []
    final_usage: Any | None = None

    try:
        async for chunk in stream:
            if hasattr(chunk, "choices") and chunk.choices:
                delta = getattr(chunk.choices[0], "delta", None)
                content = getattr(delta, "content", None) if delta else None
                if content:
                    if first_token_time is None:
                        first_token_time = time.monotonic()
                        ttft_ms = (first_token_time - start_time) * 1000.0
                        span.set_ttft(ttft_ms)
                    accumulated_content.append(content)

            if hasattr(chunk, "usage") and chunk.usage:
                final_usage = chunk.usage

            yield chunk

        # Stream completed
        full_output = "".join(accumulated_content)
        span.set_output(full_output)

        if final_usage:
            prompt_tokens = getattr(final_usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(final_usage, "completion_tokens", 0) or 0
            span.set_tokens(prompt=prompt_tokens, completion=completion_tokens)
            span.set_cost(cost=0.0, is_estimated=False)
        else:
            prompt_tokens = estimate_messages_tokens(messages, model=model)
            completion_tokens = estimate_tokens(full_output, model=model)
            span.set_tokens(prompt=prompt_tokens, completion=completion_tokens)
            span.set_cost(cost=0.0, is_estimated=True)

        span.__exit__(None, None, None)

    except Exception as exc:
        span.__exit__(type(exc), exc, None)
        raise
