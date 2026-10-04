import hashlib
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import ApiKey


def generate_api_key() -> tuple[str, str, str]:
    """Generates a secure TokenTrail API key.

    Returns:
        tuple of (raw_key, key_hash, key_prefix)
    """
    random_part = secrets.token_urlsafe(32)
    raw_key = f"tt_live_{random_part}"
    key_prefix = raw_key[:14]
    key_hash = hash_api_key(raw_key)
    return raw_key, key_hash, key_prefix


def hash_api_key(raw_key: str) -> str:
    """Computes SHA-256 hash of an API key."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()


async def verify_api_key(session: AsyncSession, raw_key: str) -> ApiKey | None:
    """Verifies a raw API key against stored active hashes.

    Returns ApiKey (with eager-loaded project) or None if invalid or revoked.
    """
    if not raw_key or not raw_key.startswith("tt_"):
        return None

    hashed = hash_api_key(raw_key)
    query = (
        select(ApiKey)
        .options(selectinload(ApiKey.project))
        .where(ApiKey.key_hash == hashed, ApiKey.revoked_at.is_(None))
    )
    result = await session.execute(query)
    return result.scalar_one_or_none()
