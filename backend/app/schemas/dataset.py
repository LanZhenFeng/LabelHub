"""Dataset schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DatasetBase(BaseModel):
    """Base dataset schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    root_path: str = Field(..., min_length=1, max_length=1000)


class DatasetCreate(DatasetBase):
    """Schema for creating a dataset."""

    pass


class DatasetResponse(DatasetBase):
    """Schema for dataset response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    item_count: int = Field(default=0, description="Number of items in dataset")
    todo_count: int = Field(default=0)
    done_count: int = Field(default=0)
    skipped_count: int = Field(default=0)


class ScanRequest(BaseModel):
    """Schema for scanning images from server path."""

    glob: str = Field(
        default="**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}",
        description="Glob pattern for matching image files",
    )
    limit: int | None = Field(
        None,
        ge=1,
        le=100000,
        description="Maximum number of images to import",
    )


class ScanError(BaseModel):
    """Error encountered during scanning."""

    path: str
    error: str


class ScanResponse(BaseModel):
    """Response from scan operation."""

    added_count: int = Field(..., description="Number of new items added")
    total_count: int = Field(..., description="Total items in dataset after scan")
    skipped_count: int = Field(
        default=0,
        description="Number of items skipped (already exist)",
    )
    errors: list[ScanError] = Field(default_factory=list)

