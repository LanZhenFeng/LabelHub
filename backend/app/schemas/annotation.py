"""Annotation schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


# ===== BBox Annotations =====


class BBoxCreate(BaseModel):
    """Schema for creating a bounding box annotation."""

    label_id: int = Field(..., description="Label ID")
    x: float = Field(..., ge=0, description="Left-top X coordinate (pixels)")
    y: float = Field(..., ge=0, description="Left-top Y coordinate (pixels)")
    width: float = Field(..., gt=0, description="Box width (pixels)")
    height: float = Field(..., gt=0, description="Box height (pixels)")
    attributes: dict[str, Any] | None = Field(
        default=None,
        description="Optional attributes (occluded, truncated, etc.)",
    )


class BBoxUpdate(BaseModel):
    """Schema for updating a bounding box annotation."""

    label_id: int | None = None
    x: float | None = Field(default=None, ge=0)
    y: float | None = Field(default=None, ge=0)
    width: float | None = Field(default=None, gt=0)
    height: float | None = Field(default=None, gt=0)
    attributes: dict[str, Any] | None = None


class BBoxResponse(BaseModel):
    """Schema for bounding box annotation response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    label_id: int
    label_name: str | None = None
    label_color: str | None = None
    x: float
    y: float
    width: float
    height: float
    attributes: dict[str, Any] | None = None
    user_id: str | None = None
    created_at: datetime
    updated_at: datetime


# ===== Polygon Annotations =====


class PolygonCreate(BaseModel):
    """Schema for creating a polygon annotation."""

    label_id: int = Field(..., description="Label ID")
    points: list[list[float]] = Field(
        ...,
        min_length=3,
        description="Polygon points as [[x1,y1], [x2,y2], ...]",
    )
    attributes: dict[str, Any] | None = Field(
        default=None,
        description="Optional attributes (occluded, crowd, etc.)",
    )

    @field_validator("points")
    @classmethod
    def validate_points(cls, v: list[list[float]]) -> list[list[float]]:
        """Validate that each point has exactly 2 coordinates."""
        for i, point in enumerate(v):
            if len(point) != 2:
                msg = f"Point {i} must have exactly 2 coordinates, got {len(point)}"
                raise ValueError(msg)
            if point[0] < 0 or point[1] < 0:
                msg = f"Point {i} coordinates must be non-negative"
                raise ValueError(msg)
        return v


class PolygonUpdate(BaseModel):
    """Schema for updating a polygon annotation."""

    label_id: int | None = None
    points: list[list[float]] | None = Field(default=None, min_length=3)
    attributes: dict[str, Any] | None = None

    @field_validator("points")
    @classmethod
    def validate_points(cls, v: list[list[float]] | None) -> list[list[float]] | None:
        """Validate that each point has exactly 2 coordinates."""
        if v is None:
            return v
        for i, point in enumerate(v):
            if len(point) != 2:
                msg = f"Point {i} must have exactly 2 coordinates, got {len(point)}"
                raise ValueError(msg)
            if point[0] < 0 or point[1] < 0:
                msg = f"Point {i} coordinates must be non-negative"
                raise ValueError(msg)
        return v


class PolygonResponse(BaseModel):
    """Schema for polygon annotation response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    label_id: int
    label_name: str | None = None
    label_color: str | None = None
    points: list[list[float]]
    attributes: dict[str, Any] | None = None
    user_id: str | None = None
    created_at: datetime
    updated_at: datetime


# ===== Batch Operations =====


class BatchAnnotationsCreate(BaseModel):
    """Schema for creating multiple annotations at once (for canvas save)."""

    bboxes: list[BBoxCreate] = Field(default_factory=list)
    polygons: list[PolygonCreate] = Field(default_factory=list)


class ItemAnnotationsResponse(BaseModel):
    """Schema for all annotations of an item."""

    item_id: int
    bboxes: list[BBoxResponse] = Field(default_factory=list)
    polygons: list[PolygonResponse] = Field(default_factory=list)

