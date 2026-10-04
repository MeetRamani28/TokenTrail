import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AlertEvent, AlertRule, Trace
from app.schemas.alert import AlertExecutionSummary
from app.services.analytics import calculate_percentile

logger = logging.getLogger(__name__)


def parse_window_duration(window_str: str) -> timedelta:
    """Parses a time window string like '1h', '24h', '30m' into a timedelta."""
    s = window_str.strip().lower()
    if s.endswith("h"):
        try:
            return timedelta(hours=int(s[:-1]))
        except ValueError:
            pass
    elif s.endswith("m"):
        try:
            return timedelta(minutes=int(s[:-1]))
        except ValueError:
            pass
    elif s.endswith("d"):
        try:
            return timedelta(days=int(s[:-1]))
        except ValueError:
            pass
    return timedelta(hours=24)


async def send_webhook_notification(webhook_url: str, payload: dict[str, Any]) -> bool:
    """Sends a rich Discord/Slack-compatible webhook notification without raising errors."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code in (200, 204):
                return True
            logger.warning(
                "Webhook returned unexpected status code %s: %s", resp.status_code, resp.text
            )
            return False
    except Exception as e:
        logger.warning("Failed to dispatch alert webhook to %s: %s", webhook_url, e)
        return False


class AlertService:
    @staticmethod
    async def evaluate_rule(db: AsyncSession, rule: AlertRule) -> AlertExecutionSummary:
        now = datetime.now(UTC)
        window = parse_window_duration(rule.window)
        cutoff = now - window

        # Fetch traces in the evaluation window
        query = select(Trace).where(
            Trace.project_id == rule.project_id,
            Trace.started_at >= cutoff,
        )
        res = await db.execute(query)
        traces = res.scalars().all()

        current_value = 0.0
        if rule.type == "daily_budget":
            current_value = sum(t.total_cost for t in traces)
        elif rule.type == "error_rate":
            if traces:
                errors = sum(1 for t in traces if t.status == "error")
                current_value = (errors / len(traces)) * 100.0
            else:
                current_value = 0.0
        elif rule.type == "p95_latency":
            latencies = [
                (t.ended_at - t.started_at).total_seconds() * 1000.0
                for t in traces
                if t.ended_at and t.started_at
            ]
            p95 = calculate_percentile(latencies, 95.0) if latencies else None
            current_value = p95 if p95 is not None else 0.0
        else:
            return AlertExecutionSummary(
                rule_id=rule.id,
                rule_type=rule.type,
                project_id=rule.project_id,
                threshold=rule.threshold,
                current_value=0.0,
                fired=False,
                reason=f"Unknown rule type '{rule.type}'",
            )

        # Check threshold
        if current_value <= rule.threshold:
            return AlertExecutionSummary(
                rule_id=rule.id,
                rule_type=rule.type,
                project_id=rule.project_id,
                threshold=rule.threshold,
                current_value=round(current_value, 4),
                fired=False,
                reason="Threshold not exceeded",
            )

        # Check cooldown
        cooldown_cutoff = now - timedelta(minutes=rule.cooldown_minutes)
        event_query = (
            select(AlertEvent)
            .where(AlertEvent.rule_id == rule.id, AlertEvent.fired_at >= cooldown_cutoff)
            .order_by(AlertEvent.fired_at.desc())
        )
        event_res = await db.execute(event_query)
        last_event = event_res.scalars().first()

        if last_event:
            return AlertExecutionSummary(
                rule_id=rule.id,
                rule_type=rule.type,
                project_id=rule.project_id,
                threshold=rule.threshold,
                current_value=round(current_value, 4),
                fired=False,
                reason=f"Cooldown active (fired at {last_event.fired_at})",
            )

        # Build notification payload (Discord/Slack compatible)
        payload = {
            "content": f"🚨 **TokenTrail Alert Triggered: {rule.type.upper()}**",
            "embeds": [
                {
                    "title": f"Rule {rule.type} breached",
                    "description": f"Telemetry metric exceeded target threshold in project `{rule.project_id}`",
                    "color": 15158332,
                    "fields": [
                        {"name": "Rule Type", "value": rule.type, "inline": True},
                        {
                            "name": "Current Value",
                            "value": str(round(current_value, 4)),
                            "inline": True,
                        },
                        {"name": "Threshold", "value": str(rule.threshold), "inline": True},
                        {"name": "Window", "value": rule.window, "inline": True},
                    ],
                    "timestamp": now.isoformat(),
                }
            ],
        }

        # Dispatch webhook
        delivered = await send_webhook_notification(rule.webhook_url, payload)

        # Record alert event
        event = AlertEvent(
            rule_id=rule.id,
            fired_at=now,
            value=current_value,
            delivered=delivered,
        )
        db.add(event)
        await db.commit()

        return AlertExecutionSummary(
            rule_id=rule.id,
            rule_type=rule.type,
            project_id=rule.project_id,
            threshold=rule.threshold,
            current_value=round(current_value, 4),
            fired=True,
            reason="Threshold breached, notification sent",
        )

    @staticmethod
    async def evaluate_all_rules(db: AsyncSession) -> list[AlertExecutionSummary]:
        rules_query = select(AlertRule).where(AlertRule.enabled.is_(True))
        rules_res = await db.execute(rules_query)
        active_rules = rules_res.scalars().all()

        summaries: list[AlertExecutionSummary] = []
        for r in active_rules:
            summary = await AlertService.evaluate_rule(db, r)
            summaries.append(summary)

        return summaries
