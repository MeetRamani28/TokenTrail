from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AlertRuleCreate(BaseModel):
    type: Literal["daily_budget", "error_rate", "p95_latency"] = Field(
        description="Type of metric to monitor: daily_budget ($), error_rate (%), p95_latency (ms)"
    )
    threshold: float = Field(gt=0, description="Threshold value that triggers the alert")
    window: str = Field(
        default="24h", description="Time window for rolling evaluation (e.g. 1h, 24h)"
    )
    webhook_url: str = Field(description="Discord or Slack compatible webhook URL")
    cooldown_minutes: int = Field(
        default=60, ge=5, description="Minutes to wait before firing another alert for this rule"
    )
    enabled: bool = Field(default=True, description="Whether this rule is active")


class AlertRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    type: str
    threshold: float
    window: str
    webhook_url: str
    cooldown_minutes: int
    enabled: bool


class AlertExecutionSummary(BaseModel):
    rule_id: str
    rule_type: str
    project_id: str
    threshold: float
    current_value: float
    fired: bool
    reason: str


class JobsRunResponse(BaseModel):
    status: str = "ok"
    traces_deleted: int = 0
    spans_deleted: int = 0
    alerts_evaluated: int = 0
    alerts_fired: int = 0
    alert_details: list[AlertExecutionSummary] = Field(default_factory=list)
