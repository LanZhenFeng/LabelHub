"""Label schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LabelBase(BaseModel):
    """Base label schema."""

    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#3B82F6", pattern=r"^#[0-9A-Fa-f]{6}$")
    shortcut: str | None = Field(None, pattern=r"^[1-9]$")


class LabelCreate(LabelBase):
    """Schema for creating a label."""

    pass


class LabelResponse(LabelBase):
    """Schema for label response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    order: int
    created_at: datetime


class LabelsUpdate(BaseModel):
    """Schema for bulk updating labels."""

    labels: list[LabelCreate] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of labels to set (replaces existing)",
    )

