import functools
import logging
import time
from collections.abc import AsyncIterator, Iterator
from typing import Any

from tokentrail.client import TokenTrail
from tokentrail.context import get_current_client, get_current_span_id, get_current_trace_id
from tokentrail.decorators import get_default_client
from tokentrail.token_counter import estimate_messages_tokens, estimate_tokens

logger = logging.getLogger("tokentrail.patcher")

_IS_PATCHED = False
_ORIGINALS: dict[str, Any] = {}


def get_active_client() -> TokenTrail:
    """Returns active context client or default global client."""
    client = get_current_client()
    if client is not None:
        return client
    return get_default_client()


def format_messages_input(messages: list[dict[str, Any]] | None) -> str | None:
    if not messages:
        return None
    parts = []
    for m in messages:
        if isinstance(m, dict):
            role = m.get("role", "user")
            content = m.get("content", "")
            parts.append(f"{role}: {content}")
        else:
            parts.append(str(m))
    return "\n".join(parts)


def patch_all(client: TokenTrail | None = None) -> None:
    """Globally monkey-patches OpenAI, Groq, Anthropic, and LiteLLM classes.

    Intercepts every LLM completion across the entire runtime with zero code changes.
    Child spans automatically inherit parent trace_id and parent_span_id in multi-agent workflows.
    """
    global _IS_PATCHED
    if _IS_PATCHED:
        return

    _patch_openai()
    _patch_groq()
    _patch_anthropic()
    _IS_PATCHED = True
    logger.info("TokenTrail auto-instrumentation activated successfully.")


def _patch_openai() -> None:
    try:
        import openai.resources.chat.completions as openai_completions

        cls = openai_completions.Completions
        if hasattr(cls, "create") and "openai_sync" not in _ORIGINALS:
            orig_sync = cls.create
            _ORIGINALS["openai_sync"] = orig_sync

            @functools.wraps(orig_sync)
            def wrapped_sync(self: Any, *args: Any, **kwargs: Any) -> Any:
                return _execute_traced_call(
                    orig_sync, self, args, kwargs, default_provider="openai", is_async=False
                )

            cls.create = wrapped_sync  # type: ignore

        if hasattr(openai_completions, "AsyncCompletions"):
            async_cls = openai_completions.AsyncCompletions
            if hasattr(async_cls, "create") and "openai_async" not in _ORIGINALS:
                orig_async = async_cls.create
                _ORIGINALS["openai_async"] = orig_async

                @functools.wraps(orig_async)
                async def wrapped_async(self: Any, *args: Any, **kwargs: Any) -> Any:
                    return await _execute_traced_call(
                        orig_async, self, args, kwargs, default_provider="openai", is_async=True
                    )

                async_cls.create = wrapped_async  # type: ignore
    except ImportError:
        pass
    except Exception as e:
        logger.debug("Failed to patch OpenAI: %s", e)


def _patch_groq() -> None:
    try:
        import groq.resources.chat.completions as groq_completions

        cls = groq_completions.Completions
        if hasattr(cls, "create") and "groq_sync" not in _ORIGINALS:
            orig_sync = cls.create
            _ORIGINALS["groq_sync"] = orig_sync

            @functools.wraps(orig_sync)
            def wrapped_groq_sync(self: Any, *args: Any, **kwargs: Any) -> Any:
                return _execute_traced_call(
                    orig_sync, self, args, kwargs, default_provider="groq", is_async=False
                )

            cls.create = wrapped_groq_sync  # type: ignore

        if hasattr(groq_completions, "AsyncCompletions"):
            async_cls = groq_completions.AsyncCompletions
            if hasattr(async_cls, "create") and "groq_async" not in _ORIGINALS:
                orig_async = async_cls.create
                _ORIGINALS["groq_async"] = orig_async

                @functools.wraps(orig_async)
                async def wrapped_groq_async(self: Any, *args: Any, **kwargs: Any) -> Any:
                    return await _execute_traced_call(
                        orig_async, self, args, kwargs, default_provider="groq", is_async=True
                    )

                async_cls.create = wrapped_groq_async  # type: ignore
    except ImportError:
        pass
    except Exception as e:
        logger.debug("Failed to patch Groq: %s", e)


def _patch_anthropic() -> None:
    try:
        import anthropic.resources.messages as anthropic_messages

        cls = anthropic_messages.Messages
        if hasattr(cls, "create") and "anthropic_sync" not in _ORIGINALS:
            orig_sync = cls.create
            _ORIGINALS["anthropic_sync"] = orig_sync

            @functools.wraps(orig_sync)
            def wrapped_anthropic_sync(self: Any, *args: Any, **kwargs: Any) -> Any:
                return _execute_traced_anthropic_call(orig_sync, self, args, kwargs, is_async=False)

            cls.create = wrapped_anthropic_sync  # type: ignore

        if hasattr(anthropic_messages, "AsyncMessages"):
            async_cls = anthropic_messages.AsyncMessages
            if hasattr(async_cls, "create") and "anthropic_async" not in _ORIGINALS:
                orig_async = async_cls.create
                _ORIGINALS["anthropic_async"] = orig_async

                @functools.wraps(orig_async)
                async def wrapped_anthropic_async(self: Any, *args: Any, **kwargs: Any) -> Any:
                    return await _execute_traced_anthropic_call(
                        orig_async, self, args, kwargs, is_async=True
                    )

                async_cls.create = wrapped_anthropic_async  # type: ignore
    except ImportError:
        pass
    except Exception as e:
        logger.debug("Failed to patch Anthropic: %s", e)


def _detect_provider(client_obj: Any, default_provider: str) -> str:
    base_url = str(getattr(client_obj, "_client", getattr(client_obj, "base_url", ""))).lower()
    if "groq.com" in base_url:
        return "groq"
    if "together" in base_url:
        return "together"
    if "openrouter" in base_url:
        return "openrouter"
    if "openai" in base_url:
        return "openai"
    return default_provider


def _execute_traced_call(
    original_fn: Any,
    client_instance: Any,
    args: Any,
    kwargs: Any,
    default_provider: str,
    is_async: bool,
) -> Any:
    tt = get_active_client()
    model = kwargs.get("model", "unknown")
    messages = kwargs.get("messages", [])
    is_stream = kwargs.get("stream", False)
    provider = _detect_provider(client_instance, default_provider)

    span_name = f"{provider}:{model}" if model != "unknown" else "chat_completion"
    parent_id = get_current_span_id()
    active_trace_id = get_current_trace_id()

    span = tt.span(
        name=span_name,
        type="llm",
        trace_id=active_trace_id,
        parent_span_id=parent_id,
        model=model,
        provider=provider,
    )
    span.set_input(format_messages_input(messages))
    span.__enter__()
    start_time = time.monotonic()

    if is_async:

        async def _run_async() -> Any:
            try:
                res = await original_fn(client_instance, *args, **kwargs)
                if is_stream:
                    return _wrap_async_stream(span, res, model, messages, start_time)
                _finalize_span(span, res, model, messages)
                return res
            except Exception as exc:
                span.__exit__(type(exc), exc, None)
                raise

        return _run_async()
    else:
        try:
            res = original_fn(client_instance, *args, **kwargs)
            if is_stream:
                return _wrap_sync_stream(span, res, model, messages, start_time)
            _finalize_span(span, res, model, messages)
            return res
        except Exception as exc:
            span.__exit__(type(exc), exc, None)
            raise


def _execute_traced_anthropic_call(
    original_fn: Any,
    client_instance: Any,
    args: Any,
    kwargs: Any,
    is_async: bool,
) -> Any:
    tt = get_active_client()
    model = kwargs.get("model", "unknown")
    messages = kwargs.get("messages", [])
    provider = "anthropic"

    span_name = f"anthropic:{model}" if model != "unknown" else "messages_completion"
    parent_id = get_current_span_id()
    active_trace_id = get_current_trace_id()

    span = tt.span(
        name=span_name,
        type="llm",
        trace_id=active_trace_id,
        parent_span_id=parent_id,
        model=model,
        provider=provider,
    )
    span.set_input(format_messages_input(messages))
    span.__enter__()

    if is_async:

        async def _run_async() -> Any:
            try:
                res = await original_fn(client_instance, *args, **kwargs)
                _finalize_anthropic_span(span, res)
                return res
            except Exception as exc:
                span.__exit__(type(exc), exc, None)
                raise

        return _run_async()
    else:
        try:
            res = original_fn(client_instance, *args, **kwargs)
            _finalize_anthropic_span(span, res)
            return res
        except Exception as exc:
            span.__exit__(type(exc), exc, None)
            raise


def _finalize_span(span: Any, response: Any, model: str, messages: list[dict[str, Any]]) -> None:
    try:
        output_text = None
        if hasattr(response, "choices") and response.choices:
            msg = getattr(response.choices[0], "message", None)
            if msg and hasattr(msg, "content"):
                output_text = msg.content
        span.set_output(output_text)

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


def _finalize_anthropic_span(span: Any, response: Any) -> None:
    try:
        output_text = ""
        if hasattr(response, "content") and response.content:
            for block in response.content:
                if hasattr(block, "text"):
                    output_text += block.text
        span.set_output(output_text)

        usage = getattr(response, "usage", None)
        if usage:
            input_tokens = getattr(usage, "input_tokens", 0) or 0
            output_tokens = getattr(usage, "output_tokens", 0) or 0
            span.set_tokens(prompt=input_tokens, completion=output_tokens)
            span.set_cost(cost=0.0, is_estimated=False)
    finally:
        span.__exit__(None, None, None)


def _wrap_sync_stream(
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
                        span.set_ttft((first_token_time - start_time) * 1000.0)
                    accumulated_content.append(content)

            if hasattr(chunk, "usage") and chunk.usage:
                final_usage = chunk.usage
            yield chunk

        full_output = "".join(accumulated_content)
        span.set_output(full_output)

        if final_usage:
            span.set_tokens(
                prompt=getattr(final_usage, "prompt_tokens", 0) or 0,
                completion=getattr(final_usage, "completion_tokens", 0) or 0,
            )
        else:
            span.set_tokens(
                prompt=estimate_messages_tokens(messages, model=model),
                completion=estimate_tokens(full_output, model=model),
            )
        span.__exit__(None, None, None)
    except Exception as exc:
        span.__exit__(type(exc), exc, None)
        raise


async def _wrap_async_stream(
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
                        span.set_ttft((first_token_time - start_time) * 1000.0)
                    accumulated_content.append(content)

            if hasattr(chunk, "usage") and chunk.usage:
                final_usage = chunk.usage
            yield chunk

        full_output = "".join(accumulated_content)
        span.set_output(full_output)

        if final_usage:
            span.set_tokens(
                prompt=getattr(final_usage, "prompt_tokens", 0) or 0,
                completion=getattr(final_usage, "completion_tokens", 0) or 0,
            )
        else:
            span.set_tokens(
                prompt=estimate_messages_tokens(messages, model=model),
                completion=estimate_tokens(full_output, model=model),
            )
        span.__exit__(None, None, None)
    except Exception as exc:
        span.__exit__(type(exc), exc, None)
        raise
