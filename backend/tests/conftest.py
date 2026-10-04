import os
from collections.abc import AsyncGenerator
from typing import Any

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Set test environment
os.environ["APP_ENV"] = "test"

from datetime import UTC

from app.core.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.models.models import ApiKey, Project, User  # noqa: E402
from app.services.api_key import generate_api_key  # noqa: E402

test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def test_setup(db_session: AsyncSession) -> dict[str, Any]:
    # 1. Create user
    user = User(clerk_user_id="user_clerk_test_123")
    db_session.add(user)
    await db_session.flush()

    # 2. Create project
    project = Project(owner_user_id=user.id, name="Test Observability Project")
    db_session.add(project)
    await db_session.flush()

    # 3. Create active API key
    raw_key, key_hash, key_prefix = generate_api_key()
    active_key = ApiKey(
        project_id=project.id,
        name="Active Key",
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    db_session.add(active_key)

    # 4. Create revoked API key
    raw_revoked_key, revoked_hash, revoked_prefix = generate_api_key()
    from datetime import datetime

    revoked_key = ApiKey(
        project_id=project.id,
        name="Revoked Key",
        key_hash=revoked_hash,
        key_prefix=revoked_prefix,
        revoked_at=datetime.now(UTC),
    )
    db_session.add(revoked_key)

    await db_session.commit()

    return {
        "user": user,
        "project": project,
        "active_raw_key": raw_key,
        "revoked_raw_key": raw_revoked_key,
    }


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
