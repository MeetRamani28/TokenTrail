#!/usr/bin/env python3
"""Run script for TokenTrail Backend.

Usage:
    uv run python run.py dev    # Starts development server with hot-reload
    uv run python run.py prod   # Starts production server with production settings
"""

import os
import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' module is importable
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in ("dev", "prod"):
        print("Usage: uv run python run.py [dev|prod]")
        sys.exit(1)

    mode = sys.argv[1]

    if mode == "dev":
        os.environ["APP_ENV"] = "development"
        # In dev mode, default host is 127.0.0.1 and port is 8000 with reload
        from app.core.config import get_settings
        get_settings.cache_clear()
        settings = get_settings()

        import uvicorn
        print(f"Starting TokenTrail in DEVELOPMENT mode on {settings.HOST}:{settings.PORT} (reload=True)...")
        uvicorn.run(
            "app.main:app",
            host=settings.HOST,
            port=settings.PORT,
            reload=True,
            reload_dirs=[str(BACKEND_DIR / "app")],
            log_level=settings.LOG_LEVEL.lower(),
        )

    elif mode == "prod":
        os.environ["APP_ENV"] = "production"
        from app.core.config import get_settings
        get_settings.cache_clear()
        settings = get_settings()

        import uvicorn
        port = int(os.getenv("PORT", str(settings.PORT)))
        host = os.getenv("HOST", "0.0.0.0")
        print(f"Starting TokenTrail in PRODUCTION mode on {host}:{port} (reload=False)...")
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=False,
            log_level=settings.LOG_LEVEL.lower(),
        )


if __name__ == "__main__":
    main()
