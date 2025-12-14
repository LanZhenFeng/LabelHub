"""Label model."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project


class Label(Base):
    """Label model - defines classification labels for a project."""

    __tablename__ = "labels"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
        default="#3B82F6",
        comment="Hex color code for UI display",
    )
    shortcut: Mapped[str | None] = mapped_column(
        String(1),
        nullable=True,
        comment="Keyboard shortcut (1-9)",
    )
    order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Display order",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="labels")

    def __repr__(self) -> str:
        return f"<Label(id={self.id}, name='{self.name}', project_id={self.project_id})>"

