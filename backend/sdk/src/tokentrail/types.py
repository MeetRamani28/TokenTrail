from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

DropPolicy = Literal["drop_oldest", "drop_newest"]
RedactFn = Callable[[str], str]


@dataclass
class SpanData:
    span_id: str
    trace_id: str
    name: str
    started_at: datetime
    parent_span_id: str | None = None
    ended_at: datetime | None = None
    duration_ms: float | None = None
    ttft_ms: float | None = None
    status: Literal["ok", "error"] = "ok"
    error_type: str | None = None
    error_message: str | None = None
    type: str = "llm"  # llm | tool | retrieval | chain | other
    model: str | None = None
    provider: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost: float = 0.0
    cost_is_estimated: bool = False
    input: str | None = None
    output: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "span_id": self.span_id,
            "trace_id": self.trace_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "type": self.type,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "duration_ms": self.duration_ms,
            "ttft_ms": self.ttft_ms,
            "status": self.status,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "model": self.model,
            "provider": self.provider,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "cost": self.cost,
            "cost_is_estimated": self.cost_is_estimated,
            "input": self.input,
            "output": self.output,
            "metadata": self.metadata,
        }


@dataclass
class TraceData:
    trace_id: str
    name: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "name": self.name,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "tags": self.tags,
            "metadata": self.metadata,
        }
