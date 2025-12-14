"""Project schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import TaskType
from app.schemas.label import LabelCreate, LabelResponse


class ProjectBase(BaseModel):
    """Base project schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    task_type: TaskType = TaskType.CLASSIFICATION


class ProjectCreate(ProjectBase):
    """Schema for creating a project."""

    labels: list[LabelCreate] = Field(
        default_factory=list,
        description="Initial labels for the project",
    )


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)


class ProjectResponse(ProjectBase):
    """Schema for project response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    labels: list[LabelResponse] = Field(default_factory=list)
    dataset_count: int = Field(default=0, description="Number of datasets in project")
    item_count: int = Field(default=0, description="Total items across all datasets")
    done_count: int = Field(default=0, description="Number of completed items")

