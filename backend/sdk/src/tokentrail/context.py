from contextvars import ContextVar, Token
from typing import Any

_current_trace_id: ContextVar[str | None] = ContextVar("tokentrail_current_trace_id", default=None)
_current_span_id: ContextVar[str | None] = ContextVar("tokentrail_current_span_id", default=None)
_current_client: ContextVar[Any | None] = ContextVar("tokentrail_current_client", default=None)


def get_current_trace_id() -> str | None:
    return _current_trace_id.get()


def set_current_trace_id(trace_id: str | None) -> Token[str | None]:
    return _current_trace_id.set(trace_id)


def reset_current_trace_id(token: Token[str | None]) -> None:
    _current_trace_id.reset(token)


def get_current_span_id() -> str | None:
    return _current_span_id.get()


def set_current_span_id(span_id: str | None) -> Token[str | None]:
    return _current_span_id.set(span_id)


def reset_current_span_id(token: Token[str | None]) -> None:
    _current_span_id.reset(token)


def get_current_client() -> Any | None:
    return _current_client.get()


def set_current_client(client: Any | None) -> Token[Any | None]:
    return _current_client.set(client)


def reset_current_client(token: Token[Any | None]) -> None:
    _current_client.reset(token)
