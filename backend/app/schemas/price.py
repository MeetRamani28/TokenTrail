from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ModelPriceBase(BaseModel):
    provider: str = Field(
        ..., min_length=1, max_length=64, description="Provider name (e.g. groq, cohere)"
    )
    model: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Model identifier (e.g. llama-3.3-70b-versatile)",
    )
    input_price_per_1m: float = Field(
        ..., ge=0.0, description="Cost in USD per 1,000,000 prompt tokens"
    )
    output_price_per_1m: float = Field(
        ..., ge=0.0, description="Cost in USD per 1,000,000 completion tokens"
    )
    currency: str = Field(default="USD", max_length=8)


class ModelPriceCreate(ModelPriceBase):
    effective_from: datetime | None = None


class ModelPriceUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    input_price_per_1m: float | None = Field(default=None, ge=0.0)
    output_price_per_1m: float | None = Field(default=None, ge=0.0)
    effective_from: datetime | None = None
    currency: str | None = Field(default=None, max_length=8)


class ModelPriceResponse(ModelPriceBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    effective_from: datetime
