from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="Human-readable project name")
    retention_days: int = Field(
        default=30, ge=1, le=365, description="Trace retention period in days"
    )


class ProjectUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="Updated project name")


class ProjectResponse(BaseModel):
    id: str
    name: str
    retention_days: int
    created_at: datetime
    api_key: str | None = None
    key_prefix: str | None = None

    model_config = {"from_attributes": True}


class ProjectListItem(BaseModel):
    id: str
    name: str
    retention_days: int
    created_at: datetime
    key_prefix: str | None = None

    model_config = {"from_attributes": True}
