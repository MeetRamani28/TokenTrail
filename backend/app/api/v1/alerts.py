from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clerk_auth import AuthContext, get_current_auth
from app.core.db import get_db
from app.models.models import AlertRule
from app.schemas.alert import AlertRuleCreate, AlertRuleResponse

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertRuleResponse])
async def list_alert_rules(
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AlertRuleResponse]:
    """List all alert rules for the active project."""
    stmt = select(AlertRule).where(AlertRule.project_id == auth.project.id)
    res = await db.execute(stmt)
    rules = res.scalars().all()
    return [AlertRuleResponse.model_validate(r) for r in rules]


@router.post("", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    body: AlertRuleCreate,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertRuleResponse:
    """Create a new alert rule for the active project."""
    rule = AlertRule(
        project_id=auth.project.id,
        type=body.type,
        threshold=body.threshold,
        window=body.window,
        webhook_url=body.webhook_url,
        cooldown_minutes=body.cooldown_minutes,
        enabled=body.enabled,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return AlertRuleResponse.model_validate(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(
    rule_id: str,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete an alert rule."""
    stmt = delete(AlertRule).where(AlertRule.id == rule_id, AlertRule.project_id == auth.project.id)
    res = await db.execute(stmt)
    deleted_count = int(getattr(res, "rowcount", 0) or 0)
    if not deleted_count:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert rule '{rule_id}' not found in active project",
        )
    await db.commit()
