"""Pydantic schemas for API request/response validation."""

from app.schemas.annotation import (
    BatchAnnotationsCreate,
    BBoxCreate,
    BBoxResponse,
    BBoxUpdate,
    ClassificationCreate,
    ClassificationResponse,
    EventResponse,
    ItemAnnotationsResponse,
    PolygonCreate,
    PolygonResponse,
    PolygonUpdate,
    SkipRequest,
)
from app.schemas.dataset import DatasetCreate, DatasetResponse, ScanRequest, ScanResponse
from app.schemas.item import ItemResponse, NextItemResponse
from app.schemas.label import LabelCreate, LabelResponse, LabelsUpdate
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate

__all__ = [
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "DatasetCreate",
    "DatasetResponse",
    "ScanRequest",
    "ScanResponse",
    "ItemResponse",
    "NextItemResponse",
    "LabelCreate",
    "LabelResponse",
    "LabelsUpdate",
    "ClassificationCreate",
    "ClassificationResponse",
    "SkipRequest",
    "EventResponse",
    # M1: Detection & Segmentation
    "BBoxCreate",
    "BBoxUpdate",
    "BBoxResponse",
    "PolygonCreate",
    "PolygonUpdate",
    "PolygonResponse",
    "BatchAnnotationsCreate",
    "ItemAnnotationsResponse",
]

