from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class OverviewResponse(BaseModel):
    total_requests: int = Field(default=0, description="Total traces recorded")
    total_tokens: int = Field(default=0, description="Total tokens consumed across all traces")
    total_cost: float = Field(default=0.0, description="Total cost in USD")
    error_rate: float = Field(
        default=0.0, description="Percentage of traces that encountered errors (0-100)"
    )
    p50_latency_ms: float | None = Field(default=None, description="Median trace latency in ms")
    p95_latency_ms: float | None = Field(
        default=None, description="95th percentile trace latency in ms"
    )
    avg_latency_ms: float | None = Field(default=None, description="Mean trace latency in ms")


class TimeseriesPoint(BaseModel):
    timestamp: datetime
    value: float
    group: str | None = None


class TimeseriesResponse(BaseModel):
    metric: Literal["requests", "tokens", "cost", "latency"]
    interval: Literal["1h", "1d"]
    points: list[TimeseriesPoint]


class TraceSummaryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trace_id: str
    name: str
    started_at: datetime
    duration_ms: float | None = None
    status: str
    total_tokens: int
    total_cost: float
    span_count: int = 0
    models: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class TraceListResponse(BaseModel):
    traces: list[TraceSummaryItem]
    total_count: int
    has_more: bool


class SpanWaterfallItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    span_id: str
    trace_id: str
    parent_span_id: str | None = None
    name: str
    type: str
    started_at: datetime
    ended_at: datetime | None = None
    duration_ms: float | None = None
    ttft_ms: float | None = None
    status: str
    error_type: str | None = None
    error_message: str | None = None
    model: str | None = None
    provider: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost: float = 0.0
    cost_is_estimated: bool = False
    input: str | None = None
    output: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    offset_ms: float = Field(
        default=0.0, description="Milliseconds since trace started_at for waterfall rendering"
    )


class TraceDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trace_id: str
    name: str
    started_at: datetime
    ended_at: datetime | None = None
    duration_ms: float | None = None
    status: str
    total_tokens: int
    total_cost: float
    user_id: str | None = None
    session_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    spans: list[SpanWaterfallItem] = Field(default_factory=list)


class ModelUsageSummary(BaseModel):
    model: str
    provider: str | None = None
    total_calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    avg_latency_ms: float | None = None
    p95_latency_ms: float | None = None
