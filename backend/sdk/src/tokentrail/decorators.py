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
