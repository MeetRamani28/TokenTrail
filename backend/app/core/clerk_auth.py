import logging
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.models.models import Project, User

logger = logging.getLogger(__name__)
settings = get_settings()

security = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user: User
    project: Project


_jwk_client: jwt.PyJWKClient | None = None


def get_jwk_client() -> jwt.PyJWKClient | None:
    global _jwk_client
    if _jwk_client is None and settings.CLERK_JWKS_URL:
        try:
            _jwk_client = jwt.PyJWKClient(settings.CLERK_JWKS_URL, cache_keys=True, lifespan=3600)
        except Exception as e:
            logger.warning("Failed to initialize PyJWKClient: %s", e)
    return _jwk_client


def verify_clerk_token(token: str) -> str:
    """Verifies a Clerk JWT token and returns the clerk_user_id (sub).

    In development/test environments, supports test tokens when live Clerk is not configured.
    """
    # 1. Dev / test bypass tokens
    if settings.is_development or settings.is_test:
        if token == "test_token" or token.startswith("test_user_"):
            return "user_clerk_test_123"
        if token.startswith("dev_user_") or token.startswith("clerk_"):
            return token
        if token == "user_2_alice":
            return "clerk_alice"
        if token == "user_2_bob":
            return "clerk_bob"

    # 2. In dev/test with unconfigured Clerk keys, allow mock inspection
    if (settings.is_development or settings.is_test) and not settings.CLERK_PUBLISHABLE_KEY:
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            sub = unverified.get("sub")
            if sub:
                return str(sub)
        except Exception:
            pass

    # 3. Production / Live Clerk JWKS verification
    jwk_client = get_jwk_client()
    if not jwk_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clerk JWKS verification is not configured",
        )

    try:
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject (sub) claim",
            )
        return str(sub)
    except jwt.PyJWTError as e:
        logger.warning("Clerk JWT verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication token: {e}",
        ) from e


async def get_current_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_project_id: Annotated[str | None, Header(alias="X-Project-Id")] = None,
) -> AuthContext:
    """FastAPI dependency for dashboard routes.

    Authenticates user via Clerk JWT, auto-provisions their record and default project if needed,
    and returns the authenticated user and active project.
    """
    if not credentials or not credentials.credentials:
        # In development mode, allow anonymous fallback if configured
        if settings.is_development and not settings.CLERK_PUBLISHABLE_KEY:
            clerk_user_id = "dev_default_user"
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization header",
            )
    else:
        clerk_user_id = verify_clerk_token(credentials.credentials)

    # 1. Fetch or provision User
    user_stmt = select(User).where(User.clerk_user_id == clerk_user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    project: Project
    if not user:
        user = User(clerk_user_id=clerk_user_id)
        db.add(user)
        await db.flush()

        # Create default project for new user
        default_project = Project(
            owner_user_id=user.id,
            name="Default Project",
            retention_days=30,
        )
        db.add(default_project)
        await db.commit()
        await db.refresh(user)
        project = default_project
    else:
        # 2. Resolve requested or default project
        if x_project_id:
            proj_stmt = select(Project).where(
                Project.id == x_project_id, Project.owner_user_id == user.id
            )
            proj_res = await db.execute(proj_stmt)
            found_proj = proj_res.scalar_one_or_none()
            if not found_proj:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Project '{x_project_id}' not found or access denied",
                )
            project = found_proj
        else:
            proj_stmt = (
                select(Project)
                .where(Project.owner_user_id == user.id)
                .order_by(Project.created_at.asc())
            )
            proj_res = await db.execute(proj_stmt)
            found_proj = proj_res.scalars().first()
            if not found_proj:
                new_project = Project(
                    owner_user_id=user.id,
                    name="Default Project",
                    retention_days=30,
                )
                db.add(new_project)
                await db.commit()
                await db.refresh(new_project)
                project = new_project
            else:
                project = found_proj

    return AuthContext(user=user, project=project)
