"""Annotation schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.annotation import EventType


class ClassificationCreate(BaseModel):
    """Schema for creating a classification annotation."""

    label: str = Field(..., min_length=1, max_length=100)


class ClassificationResponse(BaseModel):
    """Schema for classification annotation response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    label: str
    user_id: str | None = None
    created_at: datetime


class SkipRequest(BaseModel):
    """Schema for skipping an item."""

    reason: str = Field(..., min_length=1, max_length=500)


class EventResponse(BaseModel):
    """Schema for annotation event response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    dataset_id: int
    item_id: int
    user_id: str | None = None
    event_type: EventType
    ts: datetime
    payload: dict[str, Any] | None = None
    duration_ms: int | None = None

