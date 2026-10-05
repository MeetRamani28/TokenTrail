import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clerk_auth import AuthContext, get_current_auth
from app.core.db import get_db
from app.models.models import ApiKey, Project
from app.schemas.project import ProjectCreate, ProjectListItem, ProjectResponse, ProjectUpdate
from app.services.api_key import generate_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectListItem])
async def list_projects(
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ProjectListItem]:
    """List all projects belonging to the authenticated user."""
    stmt = (
        select(Project)
        .options(selectinload(Project.api_keys))
        .where(Project.owner_user_id == auth.user.id)
        .order_by(Project.created_at.asc())
    )
    result = await db.execute(stmt)
    projects = result.scalars().all()

    items: list[ProjectListItem] = []
    for proj in projects:
        active_key = next((k for k in proj.api_keys if k.revoked_at is None), None)
        items.append(
            ProjectListItem(
                id=proj.id,
                name=proj.name,
                retention_days=proj.retention_days,
                created_at=proj.created_at,
                key_prefix=active_key.key_prefix if active_key else None,
            )
        )
    return items


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectResponse:
    """Create a new project with an initial API key for the authenticated user."""
    project = Project(
        owner_user_id=auth.user.id,
        name=payload.name.strip(),
        retention_days=payload.retention_days,
    )
    db.add(project)
    await db.flush()

    # Generate initial API key for telemetry ingestion in this new project
    raw_key, key_hash, key_prefix = generate_api_key()
    api_key = ApiKey(
        project_id=project.id,
        name=f"{project.name} Ingestion Key",
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(project)

    logger.info("Created project '%s' (%s) for user %s", project.name, project.id, auth.user.id)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        retention_days=project.retention_days,
        created_at=project.created_at,
        api_key=raw_key,
        key_prefix=key_prefix,
    )


@router.get("/{project_id}/key")
async def get_or_create_project_key(
    project_id: str,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Retrieve or generate an active API key prefix/key for the project."""
    stmt = (
        select(Project)
        .options(selectinload(Project.api_keys))
        .where(Project.id == project_id, Project.owner_user_id == auth.user.id)
    )
    res = await db.execute(stmt)
    proj = res.scalar_one_or_none()
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    active_key = next((k for k in proj.api_keys if k.revoked_at is None), None)
    if active_key:
        return {
            "project_id": proj.id,
            "project_name": proj.name,
            "key_prefix": active_key.key_prefix,
        }

    # Generate a fresh key if none exists
    raw_key, key_hash, key_prefix = generate_api_key()
    new_key = ApiKey(
        project_id=proj.id,
        name=f"{proj.name} Key",
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    db.add(new_key)
    await db.commit()

    return {
        "project_id": proj.id,
        "project_name": proj.name,
        "api_key": raw_key,
        "key_prefix": key_prefix,
    }


@router.post("/{project_id}/roll-key")
async def roll_project_key(
    project_id: str,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Revoke existing active key and generate a fresh API key for the project."""
    stmt = (
        select(Project)
        .options(selectinload(Project.api_keys))
        .where(Project.id == project_id, Project.owner_user_id == auth.user.id)
    )
    res = await db.execute(stmt)
    proj = res.scalar_one_or_none()
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    # Revoke all currently active keys for this project
    now = datetime.now(UTC)
    for k in proj.api_keys:
        if k.revoked_at is None:
            k.revoked_at = now

    raw_key, key_hash, key_prefix = generate_api_key()
    new_key = ApiKey(
        project_id=proj.id,
        name=f"{proj.name} Key",
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    db.add(new_key)
    await db.commit()

    logger.info("Rolled API key for project '%s' (%s)", proj.name, proj.id)

    return {
        "project_id": proj.id,
        "project_name": proj.name,
        "api_key": raw_key,
        "key_prefix": key_prefix,
    }


@router.patch("/{project_id}", response_model=ProjectListItem)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectListItem:
    """Rename a project belonging to the authenticated user."""
    stmt = (
        select(Project)
        .options(selectinload(Project.api_keys))
        .where(Project.id == project_id, Project.owner_user_id == auth.user.id)
    )
    res = await db.execute(stmt)
    proj = res.scalar_one_or_none()
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    proj.name = payload.name.strip()
    await db.commit()
    await db.refresh(proj)

    active_key = next((k for k in proj.api_keys if k.revoked_at is None), None)
    return ProjectListItem(
        id=proj.id,
        name=proj.name,
        retention_days=proj.retention_days,
        created_at=proj.created_at,
        key_prefix=active_key.key_prefix if active_key else None,
    )


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
async def delete_project(
    project_id: str,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Delete a project and its associated API keys, traces, and spans."""
    count_stmt = select(Project).where(Project.owner_user_id == auth.user.id)
    count_res = await db.execute(count_stmt)
    user_projects = count_res.scalars().all()
    if len(user_projects) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your only project. Create another project first.",
        )

    stmt = select(Project).where(Project.id == project_id, Project.owner_user_id == auth.user.id)
    res = await db.execute(stmt)
    proj = res.scalar_one_or_none()
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found",
        )

    proj_name = proj.name
    await db.delete(proj)
    await db.commit()

    logger.info("Deleted project '%s' (%s) for user %s", proj_name, project_id, auth.user.id)
    return {"status": "ok", "message": f"Project '{proj_name}' deleted successfully"}
