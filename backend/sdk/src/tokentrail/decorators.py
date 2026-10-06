import asyncio
import functools
import inspect
from collections.abc import Callable
from typing import Any, TypeVar

from tokentrail.client import TokenTrail
from tokentrail.context import get_current_client

F = TypeVar("F", bound=Callable[..., Any])

_default_global_client: TokenTrail | None = None


def get_default_client() -> TokenTrail:
    global _default_global_client
    if _default_global_client is None:
        _default_global_client = TokenTrail()
    return _default_global_client


def set_default_client(client: TokenTrail) -> None:
    global _default_global_client
    _default_global_client = client


def trace(
    name: str | None = None,
    type: str = "chain",
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Callable[[F], F]:
    """Decorator to automatically trace a function execution.

    Compatible with both synchronous and asynchronous functions.
    Exceptions are captured with error details and re-raised unchanged.
    """

    def decorator(fn: F) -> F:
        span_name = name or fn.__name__
        meta = metadata.copy() if metadata else {}
        if tags:
            meta["tags"] = tags

        if inspect.iscoroutinefunction(fn) or asyncio.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                client = get_current_client() or get_default_client()
                async with client.span(name=span_name, type=type, metadata=meta):
                    return await fn(*args, **kwargs)

            return async_wrapper  # type: ignore

        else:

            @functools.wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                client = get_current_client() or get_default_client()
                with client.span(name=span_name, type=type, metadata=meta):
                    return fn(*args, **kwargs)

            return sync_wrapper  # type: ignore

    return decorator


def agent(
    name: str | None = None,
    role: str | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Callable[[F], F]:
    """Decorator to trace an AI Agent's execution in a multi-agent system.

    Child tools and LLM invocations executed within this agent automatically nest
    underneath it in the waterfall timeline via contextvars.
    """
    meta = metadata.copy() if metadata else {}
    if role:
        meta["role"] = role
    return trace(name=name, type="agent", tags=tags, metadata=meta)


def tool(
    name: str | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Callable[[F], F]:
    """Decorator to trace a tool or function invocation in an agentic pipeline."""
    return trace(name=name, type="tool", tags=tags, metadata=metadata)


def step(
    name: str | None = None,
    type: str = "chain",
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Callable[[F], F]:
    """Decorator to trace a pipeline or chain step."""
    return trace(name=name, type=type, tags=tags, metadata=metadata)
