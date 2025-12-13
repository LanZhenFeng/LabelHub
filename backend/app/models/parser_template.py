"""Parser Template model for flexible annotation import."""

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ParserTemplate(Base):
    """
    Parser Template for importing annotations from various formats.
    
    Uses JMESPath expressions to map arbitrary JSON/JSONL to internal format.
    """
    
    __tablename__ = "parser_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Template type
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Input configuration
    input_type: Mapped[str] = mapped_column(String(20), nullable=False)  # json, jsonl
    input_encoding: Mapped[str] = mapped_column(String(20), default="utf-8")
    record_path: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # JMESPath for JSON arrays
    
    # Mapping configuration (JMESPath expressions)
    mapping: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    # Example structure:
    # {
    #   "image_key": "file_name",
    #   "annotations_path": "annotations",
    #   "annotation": {
    #     "label": "category",
    #     "score": "confidence",
    #     "bbox": {
    #       "path": "bbox",
    #       "format": "xyxy",
    #       "normalized": false
    #     }
    #   }
    # }
    
    # Validation rules
    validation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    # {
    #   "required_fields": ["file_name", "annotations"],
    #   "score_range": [0.0, 1.0],
    #   "label_whitelist": null
    # }
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    created_by: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # user_id (future)
    
    def __repr__(self) -> str:
        return f"<ParserTemplate(id={self.id}, name='{self.name}', builtin={self.is_builtin})>"

