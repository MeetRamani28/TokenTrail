import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


def generate_uuid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    clerk_user_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="owner", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    owner_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    retention_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    owner: Mapped["User"] = relationship("User", back_populates="projects")
    api_keys: Mapped[list["ApiKey"]] = relationship(
        "ApiKey", back_populates="project", cascade="all, delete-orphan"
    )
    traces: Mapped[list["Trace"]] = relationship(
        "Trace", back_populates="project", cascade="all, delete-orphan"
    )
    spans: Mapped[list["Span"]] = relationship(
        "Span", back_populates="project", cascade="all, delete-orphan"
    )
    alert_rules: Mapped[list["AlertRule"]] = relationship(
        "AlertRule", back_populates="project", cascade="all, delete-orphan"
    )


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(64), default="Default Key", nullable=False)
    key_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )  # SHA-256
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)  # e.g., "tt_live_abc12"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="api_keys")


class Trace(Base):
    __tablename__ = "traces"

    trace_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="ok", nullable=False)  # 'ok' | 'error'
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="traces")
    spans: Mapped[list["Span"]] = relationship(
        "Span", back_populates="trace", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_traces_project_started", "project_id", "started_at"),)


class Span(Base):
    __tablename__ = "spans"

    span_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trace_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("traces.trace_id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_span_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    type: Mapped[str] = mapped_column(
        String(32), default="llm", nullable=False
    )  # llm | tool | retrieval | chain | other
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    ttft_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="ok", nullable=False)  # 'ok' | 'error'
    error_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cost_is_estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    input: Mapped[str | None] = mapped_column(Text, nullable=True)
    output: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="spans")
    trace: Mapped["Trace"] = relationship("Trace", back_populates="spans")

    __table_args__ = (
        Index("ix_spans_project_started", "project_id", "started_at"),
        Index("ix_spans_project_model_started", "project_id", "model", "started_at"),
    )


class ModelPrice(Base):
    __tablename__ = "model_prices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    input_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False)
    output_price_per_1m: Mapped[float] = mapped_column(Float, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)

    __table_args__ = (Index("ix_model_prices_provider_model", "provider", "model"),)


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # daily_budget | error_rate | p95_latency
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    window: Mapped[str] = mapped_column(String(32), default="24h", nullable=False)
    webhook_url: Mapped[str] = mapped_column(String(512), nullable=False)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    project: Mapped["Project"] = relationship("Project", back_populates="alert_rules")
    events: Mapped[list["AlertEvent"]] = relationship(
        "AlertEvent", back_populates="rule", cascade="all, delete-orphan"
    )


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    rule_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    value: Mapped[float] = mapped_column(Float, nullable=False)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    rule: Mapped["AlertRule"] = relationship("AlertRule", back_populates="events")
