import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine base directory (backend/)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
CURRENT_ENV = os.getenv("APP_ENV", "development").lower()
ENV_FILE = BACKEND_DIR / f".env.{CURRENT_ENV}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "TokenTrail"
    APP_ENV: Literal["development", "production", "test"] = Field(default="development")
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./tokentrail.db"

    # CORS: comma-separated list of origins
    CORS_ORIGINS: str = "http://localhost:5173"

    # Clerk
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_SECRET_KEY: str = ""
    CLERK_JWKS_URL: str = "https://api.clerk.com/v1/jwks"

    # Scheduled Jobs Token
    INTERNAL_JOBS_TOKEN: str = "dev_internal_jobs_token_change_in_production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_test(self) -> bool:
        return self.APP_ENV == "test"

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS.strip():
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def docs_url(self) -> str | None:
        return "/docs" if self.is_development else None

    @property
    def redoc_url(self) -> str | None:
        return "/redoc" if self.is_development else None

    @property
    def openapi_url(self) -> str | None:
        return "/openapi.json" if self.is_development else None

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, v: str) -> str:
        origins = [orig.strip() for orig in v.split(",") if orig.strip()]
        for origin in origins:
            if origin.endswith("/"):
                raise ValueError(f"CORS origin '{origin}' must not end with a trailing slash")
        return v

    @model_validator(mode="after")
    def validate_production_constraints(self) -> "Settings":
        if self.is_production:
            # 1. Database must be Postgres
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError("SQLite cannot be used in production mode; DATABASE_URL must be PostgreSQL")

            # 2. CORS cannot be wildcard
            if "*" in self.cors_origins_list:
                raise ValueError("Wildcard CORS ('*') is strictly forbidden in production mode")

            # 3. Secret tokens must not be the dev placeholder
            if (
                not self.INTERNAL_JOBS_TOKEN
                or self.INTERNAL_JOBS_TOKEN == "dev_internal_jobs_token_change_in_production"
            ):
                raise ValueError("A secure INTERNAL_JOBS_TOKEN must be configured in production mode")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
