from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import ModelPrice
from app.schemas.price import ModelPriceCreate, ModelPriceResponse, ModelPriceUpdate

router = APIRouter(prefix="/api/prices", tags=["Model Prices"])


@router.get(
    "",
    response_model=list[ModelPriceResponse],
    summary="List all model prices",
)
async def list_prices(
    provider: str | None = Query(default=None, description="Filter by provider (case-insensitive)"),
    model: str | None = Query(default=None, description="Filter by model name"),
    db: AsyncSession = Depends(get_db),
) -> list[ModelPrice]:
    query = select(ModelPrice).order_by(
        ModelPrice.provider, ModelPrice.model, ModelPrice.effective_from.desc()
    )

    if provider:
        query = query.where(func.lower(ModelPrice.provider) == provider.strip().lower())
    if model:
        query = query.where(func.lower(ModelPrice.model).contains(model.strip().lower()))

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "",
    response_model=ModelPriceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or add new model price",
)
async def create_price(
    payload: ModelPriceCreate,
    db: AsyncSession = Depends(get_db),
) -> ModelPrice:
    price = ModelPrice(
        provider=payload.provider.strip().lower(),
        model=payload.model.strip(),
        input_price_per_1m=payload.input_price_per_1m,
        output_price_per_1m=payload.output_price_per_1m,
        effective_from=payload.effective_from or datetime.now(UTC),
        currency=payload.currency.upper(),
    )
    db.add(price)
    await db.commit()
    await db.refresh(price)
    return price


@router.get(
    "/{price_id}",
    response_model=ModelPriceResponse,
    summary="Get single model price",
)
async def get_price(
    price_id: str,
    db: AsyncSession = Depends(get_db),
) -> ModelPrice:
    result = await db.execute(select(ModelPrice).where(ModelPrice.id == price_id))
    price = result.scalar_one_or_none()
    if not price:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model price with ID '{price_id}' not found.",
        )
    return price


@router.put(
    "/{price_id}",
    response_model=ModelPriceResponse,
    summary="Update model price",
)
async def update_price(
    price_id: str,
    payload: ModelPriceUpdate,
    db: AsyncSession = Depends(get_db),
) -> ModelPrice:
    result = await db.execute(select(ModelPrice).where(ModelPrice.id == price_id))
    price = result.scalar_one_or_none()
    if not price:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model price with ID '{price_id}' not found.",
        )

    if payload.input_price_per_1m is not None:
        price.input_price_per_1m = payload.input_price_per_1m
    if payload.output_price_per_1m is not None:
        price.output_price_per_1m = payload.output_price_per_1m
    if payload.effective_from is not None:
        price.effective_from = payload.effective_from
    if payload.currency is not None:
        price.currency = payload.currency.upper()

    await db.commit()
    await db.refresh(price)
    return price


@router.delete(
    "/{price_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete model price",
)
async def delete_price(
    price_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(ModelPrice).where(ModelPrice.id == price_id))
    price = result.scalar_one_or_none()
    if not price:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model price with ID '{price_id}' not found.",
        )

    await db.delete(price)
    await db.commit()
