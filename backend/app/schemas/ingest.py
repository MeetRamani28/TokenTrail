from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class SpanIngestItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    span_id: str = Field(
        ..., min_length=1, max_length=64, description="Unique client-generated span identifier"
    )
    trace_id: str = Field(..., min_length=1, max_length=64, description="Parent trace identifier")
    parent_span_id: str | None = Field(default=None, max_length=64)
    name: str = Field(..., min_length=1, max_length=256)
    type: Literal["llm", "tool", "retrieval", "chain", "other"] = Field(default="llm")
    started_at: datetime
    ended_at: datetime | None = None
    duration_ms: float | None = None
    ttft_ms: float | None = None
    status: Literal["ok", "error"] = Field(default="ok")
    error_type: str | None = Field(default=None, max_length=128)
    error_message: str | None = None
    model: str | None = Field(default=None, max_length=128)
    provider: str | None = Field(default=None, max_length=64)
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    cost: float = Field(default=0.0, ge=0.0)
    cost_is_estimated: bool = False
    input: str | None = None
    output: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class TraceMetadataItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    trace_id: str = Field(..., min_length=1, max_length=64)
    name: str | None = Field(default=None, max_length=256)
    user_id: str | None = Field(default=None, max_length=128)
    session_id: str | None = Field(default=None, max_length=128)
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestBatchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    spans: list[SpanIngestItem] = Field(
        ...,
        min_length=1,
        max_length=500,
        description="List of spans to ingest in this batch (max 500 per batch)",
    )
    traces: list[TraceMetadataItem] = Field(
        default_factory=list,
        description="Optional explicit trace-level metadata",
    )


class IngestBatchResponse(BaseModel):
    status: str = "ok"
    accepted_spans: int
    accepted_traces: int
    rejected_spans: int = 0
