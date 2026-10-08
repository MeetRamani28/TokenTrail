"""Entrypoint module for Gunicorn and ASGI servers.

Enables commands like:
    gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --max-requests 500 --max-requests-jitter 50 --timeout 120 --bind 0.0.0.0:$PORT
"""

from app.main import app

__all__ = ["app"]
