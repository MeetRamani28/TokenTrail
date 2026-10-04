from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ModelPrice


async def calculate_cost(
    session: AsyncSession,
    model: str | None,
    provider: str | None,
    prompt_tokens: int,
    completion_tokens: int,
    timestamp: datetime | None = None,
) -> tuple[float, bool]:
    """Calculates cost for given token counts using the model_prices table.

    Returns:
        tuple of (calculated_cost, is_estimated)
        If model pricing is found: (cost, False)
        If model is unknown: (0.0, True)
    """
    if not model:
        return 0.0, True

    norm_model = model.strip().lower()
    norm_provider = provider.strip().lower() if provider else None
    ref_time = timestamp or datetime.now(UTC)

    # 1. Query with model and provider
    query = (
        select(ModelPrice)
        .where(
            func.lower(ModelPrice.model) == norm_model,
            ModelPrice.effective_from <= ref_time,
        )
        .order_by(ModelPrice.effective_from.desc())
    )

    if norm_provider:
        query = query.where(func.lower(ModelPrice.provider) == norm_provider)

    result = await session.execute(query)
    price_record = result.scalars().first()

    # 2. Fallback: if provider was specified but no match, try matching by model alone
    if not price_record and norm_provider:
        fallback_query = (
            select(ModelPrice)
            .where(
                func.lower(ModelPrice.model) == norm_model,
                ModelPrice.effective_from <= ref_time,
            )
            .order_by(ModelPrice.effective_from.desc())
        )
        fallback_res = await session.execute(fallback_query)
        price_record = fallback_res.scalars().first()

    # 3. If model pricing not found, return 0 cost flagged as estimated/unknown
    if not price_record:
        return 0.0, True

    # 4. Accurate cost calculation per 1M tokens
    input_cost = (prompt_tokens * price_record.input_price_per_1m) / 1_000_000.0
    output_cost = (completion_tokens * price_record.output_price_per_1m) / 1_000_000.0
    total_cost = round(input_cost + output_cost, 7)

    return total_cost, False


DEFAULT_FREE_TIER_PRICES: list[dict[str, Any]] = [
    # Groq models (official current pricing)
    {
        "provider": "groq",
        "model": "llama-3.3-70b-versatile",
        "input_price_per_1m": 0.59,
        "output_price_per_1m": 0.79,
    },
    {
        "provider": "groq",
        "model": "llama-3.1-8b-instant",
        "input_price_per_1m": 0.05,
        "output_price_per_1m": 0.08,
    },
    {
        "provider": "groq",
        "model": "mixtral-8x7b-32768",
        "input_price_per_1m": 0.24,
        "output_price_per_1m": 0.24,
    },
    # Cohere models
    {
        "provider": "cohere",
        "model": "command-r",
        "input_price_per_1m": 0.50,
        "output_price_per_1m": 1.50,
    },
    {
        "provider": "cohere",
        "model": "command-r-plus",
        "input_price_per_1m": 2.50,
        "output_price_per_1m": 10.00,
    },
]


async def seed_default_prices_if_empty(session: AsyncSession) -> int:
    """Seeds popular free-tier models into model_prices if empty."""
    count_res = await session.execute(select(func.count(ModelPrice.id)))
    count = count_res.scalar() or 0
    if count > 0:
        return 0

    inserted = 0
    now = datetime.now(UTC)
    for p in DEFAULT_FREE_TIER_PRICES:
        price = ModelPrice(
            provider=p["provider"],
            model=p["model"],
            input_price_per_1m=p["input_price_per_1m"],
            output_price_per_1m=p["output_price_per_1m"],
            effective_from=now,
            currency="USD",
        )
        session.add(price)
        inserted += 1

    await session.commit()
    return inserted
