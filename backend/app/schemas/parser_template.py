"""Pydantic schemas for Parser Templates."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ParserTemplateBase(BaseModel):
    """Base Parser Template schema."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    input_type: str = Field(..., pattern="^(json|jsonl)$")
    input_encoding: str = "utf-8"
    record_path: Optional[str] = None
    mapping: Dict[str, Any]
    validation: Optional[Dict[str, Any]] = None


class ParserTemplateCreate(ParserTemplateBase):
    """Schema for creating a Parser Template."""
    pass


class ParserTemplateUpdate(BaseModel):
    """Schema for updating a Parser Template."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    input_type: Optional[str] = Field(None, pattern="^(json|jsonl)$")
    input_encoding: Optional[str] = None
    record_path: Optional[str] = None
    mapping: Optional[Dict[str, Any]] = None
    validation: Optional[Dict[str, Any]] = None


class ParserTemplateResponse(ParserTemplateBase):
    """Schema for Parser Template response."""
    id: int
    is_builtin: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class ParseTestRequest(BaseModel):
    """Schema for testing parser template."""
    template_id: Optional[int] = None  # Use existing template
    template: Optional[ParserTemplateBase] = None  # Or provide template directly
    sample_data: str  # JSON or JSONL string
    max_records: int = Field(20, ge=1, le=100)  # Limit test results


class PredictionItem(BaseModel):
    """Single prediction item (internal format)."""
    type: str  # classification, bbox, polygon
    label: str
    score: Optional[float] = None
    data: Dict[str, Any]  # BBoxData, PolygonData, or ClassificationData


class Prediction(BaseModel):
    """Prediction for a single image."""
    image_key: str  # Filename or path to match Item
    predictions: List[PredictionItem]


class ParseTestResponse(BaseModel):
    """Schema for parse test response."""
    success: bool
    records_parsed: int
    predictions: List[Prediction]
    errors: List[Dict[str, Any]] = []  # [{line: int, error: str}]

