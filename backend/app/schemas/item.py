"""Item schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.item import ItemStatus


class ItemResponse(BaseModel):
    """Schema for item response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    rel_path: str
    filename: str
    width: int | None = None
    height: int | None = None
    file_size: int | None = None
    status: ItemStatus
    skip_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    thumb_url: str = Field(..., description="URL to thumbnail image")
    image_url: str = Field(..., description="URL to original image")
    label: str | None = Field(None, description="Current classification label if any")


class NextItemResponse(BaseModel):
    """Response for getting next item to annotate."""

    item: ItemResponse | None = Field(None, description="Next item to annotate")
    remaining_count: int = Field(..., description="Remaining todo/in_progress items")
    total_count: int = Field(..., description="Total items in dataset")
    done_count: int = Field(..., description="Completed items count")


class ItemListResponse(BaseModel):
    """Paginated list of items."""

    items: list[ItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

