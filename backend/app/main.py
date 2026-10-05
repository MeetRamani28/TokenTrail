import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.alerts import router as alerts_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.ingest import router as ingest_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.prices import router as prices_router
from app.core.config import get_settings
from app.core.dev_seed import seed_dev_defaults

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup actions
    if not settings.CLERK_PUBLISHABLE_KEY or settings.is_development:
        try:
            await seed_dev_defaults()
        except Exception as e:
            logger.warning("Default auto-seeding skipped: %s", e)
    yield
    # Shutdown actions


app = FastAPI(
    title=settings.APP_NAME,
    description="Lightweight, zero-overhead LLM observability and cost-tracking engine.",
    version="0.1.0",
    docs_url=settings.docs_url,
    redoc_url=settings.redoc_url,
    openapi_url=settings.openapi_url,
    lifespan=lifespan,
)

# CORS configuration
if settings.cors_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def security_headers_middleware(request: Any, call_next: Any) -> Any:
    """Inject hardened security headers into all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Routers
app.include_router(ingest_router)
app.include_router(prices_router)
app.include_router(analytics_router)
app.include_router(alerts_router)
app.include_router(jobs_router)


@app.get("/healthz", tags=["Health"])
async def health_check() -> dict[str, Any]:
    """Health check endpoint accessible without authentication."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
    }
