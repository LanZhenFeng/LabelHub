"""Annotation models."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.item import Item


class ClassificationAnnotation(Base):
    """Classification annotation - stores classification label for an item."""

    __tablename__ = "classification_annotations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="User who created this annotation (M0: nullable)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    item: Mapped["Item"] = relationship("Item", back_populates="classifications")

    def __repr__(self) -> str:
        return f"<ClassificationAnnotation(id={self.id}, label='{self.label}', item_id={self.item_id})>"


class EventType(str, enum.Enum):
    """Event types for annotation tracking."""

    OPEN = "open"  # Item opened for annotation
    SAVE = "save"  # Annotation saved (draft)
    SUBMIT_DONE = "submit_done"  # Annotation submitted and completed
    SKIP = "skip"  # Item skipped
    DELETE = "delete"  # Item soft deleted
    UNSKIP = "unskip"  # Item unskipped
    RESTORE = "restore"  # Item restored from deleted


class AnnotationEvent(Base):
    """Event log for tracking annotation actions."""

    __tablename__ = "annotation_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    event_type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    # Use JSON type that works with both SQLite and PostgreSQL
    payload: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    duration_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Time spent on this action in milliseconds",
    )

    def __repr__(self) -> str:
        return f"<AnnotationEvent(id={self.id}, type={self.event_type}, item_id={self.item_id})>"

