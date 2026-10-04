from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.models import AlertEvent, AlertRule, Span, Trace
from app.services.alerts import AlertService
from app.services.retention import RetentionService

settings = get_settings()


@pytest.mark.asyncio
async def test_internal_jobs_unauthorized(client: AsyncClient) -> None:
    """Requesting internal maintenance jobs without valid token must fail with 401."""
    resp_no_token = await client.post("/internal/run-jobs")
    assert resp_no_token.status_code == 401

    resp_bad_token = await client.post(
        "/internal/run-jobs", headers={"Authorization": "Bearer wrong_token_xyz"}
    )
    assert resp_bad_token.status_code == 401


@pytest.mark.asyncio
async def test_daily_budget_alert_and_cooldown(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Tests daily budget alert firing and cooldown enforcement."""
    project = test_setup["project"]
    now = datetime.now(UTC)

    # 1. Create a daily budget alert rule ($0.05 threshold, 60m cooldown)
    rule = AlertRule(
        project_id=project.id,
        type="daily_budget",
        threshold=0.05,
        window="24h",
        webhook_url="https://discord.com/api/webhooks/mock/123",
        cooldown_minutes=60,
        enabled=True,
    )
    db_session.add(rule)

    # 2. Add traces totaling $0.15 spend within the last 2 hours
    t1 = Trace(
        trace_id="tr_budget_1",
        project_id=project.id,
        name="call_expensive",
        started_at=now - timedelta(hours=2),
        ended_at=now - timedelta(hours=2, seconds=-1),
        status="ok",
        total_tokens=10000,
        total_cost=0.15,
    )
    db_session.add(t1)
    await db_session.commit()

    # 3. Evaluate rules (mocking the HTTP webhook client)
    with patch(
        "app.services.alerts.send_webhook_notification", new_callable=AsyncMock
    ) as mock_send:
        mock_send.return_value = True

        resp = await client.post(
            "/internal/run-jobs",
            headers={"Authorization": f"Bearer {settings.INTERNAL_JOBS_TOKEN}"},
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data["alerts_evaluated"] >= 1
        assert data["alerts_fired"] == 1
        fired_detail = [d for d in data["alert_details"] if d["rule_id"] == rule.id][0]
        assert fired_detail["fired"] is True
        assert fired_detail["current_value"] == 0.15
        assert mock_send.await_count == 1

        # Check alert event logged in DB
        event_res = await db_session.execute(
            select(AlertEvent).where(AlertEvent.rule_id == rule.id)
        )
        events = event_res.scalars().all()
        assert len(events) == 1
        assert events[0].delivered is True

    # 4. Immediate second run: Cooldown must prevent firing again
    with patch(
        "app.services.alerts.send_webhook_notification", new_callable=AsyncMock
    ) as mock_send:
        resp2 = await client.post(
            "/internal/run-jobs",
            headers={"Authorization": f"Bearer {settings.INTERNAL_JOBS_TOKEN}"},
        )
        assert resp2.status_code == 200
        data2 = resp2.json()

        fired_detail2 = [d for d in data2["alert_details"] if d["rule_id"] == rule.id][0]
        assert fired_detail2["fired"] is False
        assert "Cooldown active" in fired_detail2["reason"]
        assert mock_send.await_count == 0


@pytest.mark.asyncio
async def test_error_rate_and_p95_latency_alerts(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Verifies error rate and p95 latency threshold alerts."""
    project = test_setup["project"]
    now = datetime.now(UTC)

    # 1. Error rate rule (threshold 30.0%, 1h window)
    rule_err = AlertRule(
        project_id=project.id,
        type="error_rate",
        threshold=30.0,
        window="1h",
        webhook_url="https://discord.com/api/webhooks/mock/err",
        cooldown_minutes=60,
        enabled=True,
    )
    # 2. Latency rule (threshold 500ms, 1h window)
    rule_lat = AlertRule(
        project_id=project.id,
        type="p95_latency",
        threshold=500.0,
        window="1h",
        webhook_url="https://discord.com/api/webhooks/mock/lat",
        cooldown_minutes=60,
        enabled=True,
    )
    db_session.add_all([rule_err, rule_lat])

    # 3 traces: 2 errors, durations 600ms, 700ms, 800ms
    for i in range(3):
        t = Trace(
            trace_id=f"tr_err_lat_{i}",
            project_id=project.id,
            name=f"trace_{i}",
            started_at=now - timedelta(minutes=10 * (i + 1)),
            ended_at=now - timedelta(minutes=10 * (i + 1), milliseconds=-(600 + i * 100)),
            status="error" if i < 2 else "ok",
            total_tokens=100,
            total_cost=0.001,
        )
        db_session.add(t)
    await db_session.commit()

    with patch(
        "app.services.alerts.send_webhook_notification", new_callable=AsyncMock
    ) as mock_send:
        mock_send.return_value = True

        res_err = await AlertService.evaluate_rule(db_session, rule_err)
        assert res_err.fired is True
        # 2 out of 3 = 66.67%
        assert res_err.current_value > 60.0

        res_lat = await AlertService.evaluate_rule(db_session, rule_lat)
        assert res_lat.fired is True
        assert res_lat.current_value >= 600.0


@pytest.mark.asyncio
async def test_retention_purge_older_records(
    client: AsyncClient, test_setup: dict[str, Any], db_session: AsyncSession
) -> None:
    """Verifies retention purge deletes traces & spans older than retention_days (30 days)."""
    project = test_setup["project"]
    project.retention_days = 30
    now = datetime.now(UTC)

    # 1. Old records (45 days old -> should be purged)
    old_time = now - timedelta(days=45)
    t_old = Trace(
        trace_id="tr_retention_old",
        project_id=project.id,
        name="old_trace",
        started_at=old_time,
        ended_at=old_time + timedelta(seconds=1),
    )
    s_old = Span(
        span_id="sp_retention_old",
        trace_id=t_old.trace_id,
        project_id=project.id,
        name="old_span",
        started_at=old_time,
    )

    # 2. Recent records (5 days old -> must be kept)
    recent_time = now - timedelta(days=5)
    t_recent = Trace(
        trace_id="tr_retention_recent",
        project_id=project.id,
        name="recent_trace",
        started_at=recent_time,
        ended_at=recent_time + timedelta(seconds=1),
    )
    s_recent = Span(
        span_id="sp_retention_recent",
        trace_id=t_recent.trace_id,
        project_id=project.id,
        name="recent_span",
        started_at=recent_time,
    )

    db_session.add_all([t_old, s_old, t_recent, s_recent])
    await db_session.commit()

    # Run retention purge
    traces_del, spans_del = await RetentionService.run_retention_purge(db_session)
    assert traces_del == 1
    assert spans_del == 1

    # Check DB: only recent trace & span remain
    t_res = await db_session.execute(select(Trace).where(Trace.project_id == project.id))
    remaining_traces = t_res.scalars().all()
    assert len(remaining_traces) == 1
    assert remaining_traces[0].trace_id == "tr_retention_recent"

    s_res = await db_session.execute(select(Span).where(Span.project_id == project.id))
    remaining_spans = s_res.scalars().all()
    assert len(remaining_spans) == 1
    assert remaining_spans[0].span_id == "sp_retention_recent"


@pytest.mark.asyncio
async def test_alerts_crud_api(client: AsyncClient, test_setup: dict[str, Any]) -> None:
    """Verifies Alert Rules CRUD endpoints."""
    # 1. Create alert rule
    create_payload = {
        "type": "daily_budget",
        "threshold": 10.0,
        "window": "24h",
        "webhook_url": "https://discord.com/api/webhooks/test/456",
        "cooldown_minutes": 30,
        "enabled": True,
    }
    resp_create = await client.post(
        "/api/alerts",
        json=create_payload,
        headers={"Authorization": "Bearer test_token"},
    )
    assert resp_create.status_code == 201
    created_rule = resp_create.json()
    rule_id = created_rule["id"]
    assert created_rule["type"] == "daily_budget"
    assert created_rule["threshold"] == 10.0

    # 2. List alert rules
    resp_list = await client.get("/api/alerts", headers={"Authorization": "Bearer test_token"})
    assert resp_list.status_code == 200
    rules = resp_list.json()
    assert any(r["id"] == rule_id for r in rules)

    # 3. Delete alert rule
    resp_del = await client.delete(
        f"/api/alerts/{rule_id}", headers={"Authorization": "Bearer test_token"}
    )
    assert resp_del.status_code == 204

    # 4. Confirm deleted
    resp_list_after = await client.get(
        "/api/alerts", headers={"Authorization": "Bearer test_token"}
    )
    assert not any(r["id"] == rule_id for r in resp_list_after.json())
