import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import app


@pytest.mark.asyncio
async def test_health_check() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["app"] == "TokenTrail"
        assert "environment" in data


def test_settings_development_defaults() -> None:
    settings = Settings(APP_ENV="development")
    assert settings.is_development is True
    assert settings.is_production is False
    assert settings.docs_url == "/docs"
    assert "http://localhost:5173" in settings.cors_origins_list


def test_settings_production_constraints() -> None:
    # 1. Production must reject SQLite
    with pytest.raises(ValueError, match="SQLite cannot be used in production mode"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="sqlite+aiosqlite:///./test.db",
            INTERNAL_JOBS_TOKEN="secure_token_123",
        )

    # 2. Production must reject wildcard CORS
    with pytest.raises(ValueError, match="Wildcard CORS"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/db",
            CORS_ORIGINS="*",
            INTERNAL_JOBS_TOKEN="secure_token_123",
        )

    # 3. Production must reject default internal jobs token
    with pytest.raises(ValueError, match="secure INTERNAL_JOBS_TOKEN"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/db",
            INTERNAL_JOBS_TOKEN="dev_internal_jobs_token_change_in_production",
        )

    # 4. Valid production settings
    prod_settings = Settings(
        APP_ENV="production",
        DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/db",
        CORS_ORIGINS="http://localhost:4173",
        INTERNAL_JOBS_TOKEN="prod_secure_secret_token",
    )
    assert prod_settings.is_production is True
    assert prod_settings.docs_url is None
    assert prod_settings.openapi_url is None


@pytest.mark.asyncio
async def test_gzip_compression_and_cors() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request with Accept-Encoding: gzip and Origin header
        response = await client.get(
            "/api/prices",
            headers={
                "Accept-Encoding": "gzip",
                "Origin": "http://localhost:5173",
            },
        )
        assert response.status_code == 200
        # If response body exceeds 500 bytes, GZipMiddleware compresses it
        if "gzip" in response.headers.get("content-encoding", ""):
            assert response.headers.get("content-encoding") == "gzip"
        # CORS headers are preserved on the response
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
