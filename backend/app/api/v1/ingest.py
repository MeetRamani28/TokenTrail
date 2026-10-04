import time
from collections import defaultdict

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import ApiKey
from app.schemas.ingest import IngestBatchRequest, IngestBatchResponse
from app.services.api_key import verify_api_key
from app.services.ingest import ingest_spans_batch

router = APIRouter(prefix="/v1", tags=["Ingestion"])

MAX_PAYLOAD_BYTES = 2 * 1024 * 1024  # 2MB


async def get_current_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> ApiKey:
    """Authenticates the request using an active project API key."""
    raw_key: str | None = None
    if x_api_key:
        raw_key = x_api_key.strip()
    elif authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            raw_key = parts[1]

    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide via 'X-API-Key' header or 'Authorization: Bearer <key>'.",
        )

    api_key_record = await verify_api_key(db, raw_key)
    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
        )

    return api_key_record


_RATE_LIMIT_WINDOW = 60.0  # 60s window
_MAX_REQUESTS_PER_WINDOW = 300  # 300 req/min per key
_rate_limit_records: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key_id: str) -> None:
    now = time.time()
    cutoff = now - _RATE_LIMIT_WINDOW
    timestamps = [t for t in _rate_limit_records[key_id] if t > cutoff]
    if len(timestamps) >= _MAX_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 300 requests per minute per API key.",
            headers={"Retry-After": "60"},
        )
    timestamps.append(now)
    _rate_limit_records[key_id] = timestamps


@router.post(
    "/ingest",
    response_model=IngestBatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Ingest batch of spans and traces",
)
async def ingest_spans(
    request: Request,
    batch: IngestBatchRequest,
    api_key: ApiKey = Depends(get_current_api_key),
    db: AsyncSession = Depends(get_db),
) -> IngestBatchResponse:
    """Ingests spans and traces idempotently into the active project."""
    # Check rate limit
    check_rate_limit(api_key.id)

    # Check payload size header if present
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_PAYLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Payload exceeds maximum allowed size of {MAX_PAYLOAD_BYTES} bytes.",
        )

    accepted_spans, accepted_traces = await ingest_spans_batch(
        session=db,
        project_id=api_key.project_id,
        batch=batch,
    )

    return IngestBatchResponse(
        status="ok",
        accepted_spans=accepted_spans,
        accepted_traces=accepted_traces,
        rejected_spans=0,
    )
