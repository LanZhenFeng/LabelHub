"""Item (Image) model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.annotation import (
        BBoxAnnotation,
        ClassificationAnnotation,
        PolygonAnnotation,
    )
    from app.models.dataset import Dataset
    from app.models.user import User


class ItemStatus(str, enum.Enum):
    """Item status for state machine."""

    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    SKIPPED = "skipped"
    DELETED = "deleted"


class Item(Base):
    """Item model - represents a single image to be annotated."""

    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rel_path: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
        comment="Relative path from dataset root_path",
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original filename",
    )
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[ItemStatus] = mapped_column(
        Enum(ItemStatus),
        nullable=False,
        default=ItemStatus.TODO,
        index=True,
    )
    skip_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # 用户分配相关字段 (M4: Multi-user support)
    annotator_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Assigned annotator user ID",
    )
    assigned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when item was assigned",
    )
    assigned_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User ID who assigned this item",
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
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="items")
    annotator: Mapped["User | None"] = relationship(
        "User",
        back_populates="items_assigned",
        foreign_keys=[annotator_id],
    )
    assigned_by_user: Mapped["User | None"] = relationship(
        "User",
        back_populates="items_assigned_by",
        foreign_keys=[assigned_by],
    )
    classifications: Mapped[list["ClassificationAnnotation"]] = relationship(
        "ClassificationAnnotation",
        back_populates="item",
        cascade="all, delete-orphan",
    )
    bboxes: Mapped[list["BBoxAnnotation"]] = relationship(
        "BBoxAnnotation",
        back_populates="item",
        cascade="all, delete-orphan",
    )
    polygons: Mapped[list["PolygonAnnotation"]] = relationship(
        "PolygonAnnotation",
        back_populates="item",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Item(id={self.id}, filename='{self.filename}', status={self.status})>"

    @property
    def full_path(self) -> str:
        """Get full path by combining dataset root_path and rel_path."""
        # This should be computed at runtime using dataset.root_path
        return self.rel_path

