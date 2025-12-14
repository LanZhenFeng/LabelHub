"""Project model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.dataset import Dataset
    from app.models.label import Label


class TaskType(str, enum.Enum):
    """Supported task types."""

    CLASSIFICATION = "classification"
    DETECTION = "detection"  # M1: BBox
    SEGMENTATION = "segmentation"  # M1: Polygon


class Project(Base):
    """Project model - top-level container for datasets and labels."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    task_type: Mapped[TaskType] = mapped_column(
        Enum(TaskType),
        nullable=False,
        default=TaskType.CLASSIFICATION,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    datasets: Mapped[list["Dataset"]] = relationship(
        "Dataset",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    labels: Mapped[list["Label"]] = relationship(
        "Label",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Label.order",
    )

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}', task_type={self.task_type})>"

