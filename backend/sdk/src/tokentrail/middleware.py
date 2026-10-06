import logging
import time
from collections.abc import Callable
from typing import Any

from tokentrail.client import TokenTrail
from tokentrail.decorators import get_default_client, set_default_client
from tokentrail.instrumentation.patcher import patch_all

logger = logging.getLogger("tokentrail.middleware")


class TokenTrailMiddleware:
    """ASGI / Starlette middleware for automatic HTTP trace context propagation."""

    def __init__(
        self,
        app: Any,
        client: TokenTrail | None = None,
        auto_patch: bool = True,
    ) -> None:
        self.app = app
        self.client = client or get_default_client()
        if auto_patch:
            patch_all(self.client)

    async def __call__(
        self, scope: dict[str, Any], receive: Callable[..., Any], send: Callable[..., Any]
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        path = scope.get("path", "/")
        span_name = f"{method} {path}"

        status_code = 200

        async def send_wrapper(message: dict[str, Any]) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 200)
            await send(message)

        # Create root trace for this HTTP request
        async with self.client.span(
            name=span_name, type="http", metadata={"method": method, "path": path}
        ) as span:
            start_time = time.monotonic()
            try:
                await self.app(scope, receive, send_wrapper)
            except Exception as exc:
                span.status = "error"
                span.error_type = type(exc).__name__
                span.error_message = str(exc)
                raise
            finally:
                span.set_duration((time.monotonic() - start_time) * 1000.0)
                if status_code >= 400:
                    span.status = "error"
                    span.error_type = f"HTTP_{status_code}"


def use_tokentrail(
    app: Any,
    api_key: str | None = None,
    endpoint: str | None = None,
    auto_patch: bool = True,
) -> TokenTrail:
    """Convenience function to wire TokenTrail into any FastAPI or Starlette application in 1 line.

    Usage:
        from fastapi import FastAPI
        from tokentrail.middleware import use_tokentrail

        app = FastAPI()
        use_tokentrail(app)
    """
    client = TokenTrail(api_key=api_key, endpoint=endpoint)
    set_default_client(client)

    if auto_patch:
        patch_all(client)

    # Add ASGI middleware
    app.add_middleware(TokenTrailMiddleware, client=client, auto_patch=False)
    logger.info("TokenTrail middleware and auto-instrumentation attached to application.")
    return client
