"""
Statistics schemas
"""

from datetime import date as date_type
from typing import Optional

from pydantic import BaseModel, Field


class OverviewStats(BaseModel):
    """Project overview statistics"""

    # Progress metrics
    total_items: int = Field(..., description="Total number of items")
    completed_items: int = Field(..., description="Number of completed items")
    in_progress_items: int = Field(..., description="Number of in-progress items")
    skipped_items: int = Field(..., description="Number of skipped items")
    todo_items: int = Field(..., description="Number of todo items")
    completion_rate: float = Field(..., description="Completion rate (0-100)")

    # Efficiency metrics
    avg_annotation_time: Optional[float] = Field(
        None, description="Average annotation time in seconds"
    )
    avg_daily_throughput: Optional[float] = Field(
        None, description="Average daily throughput per annotator"
    )
    skip_rate: float = Field(..., description="Skip rate (0-100)")

    # Pre-annotation metrics (if applicable)
    pre_annotation_adopt_rate: Optional[float] = Field(
        None, description="Pre-annotation adoption rate (0-100)"
    )
    pre_annotation_modify_rate: Optional[float] = Field(
        None, description="Pre-annotation modification rate (0-100)"
    )

    # Category distribution
    category_distribution: dict[str, int] = Field(
        default_factory=dict, description="Annotation count by category"
    )


class DailyStats(BaseModel):
    """Daily statistics"""

    stat_date: date_type = Field(..., description="Date")
    completed_count: int = Field(..., description="Number of completed items")
    skipped_count: int = Field(..., description="Number of skipped items")
    avg_annotation_time: Optional[float] = Field(
        None, description="Average annotation time in seconds"
    )
    active_annotators: int = Field(
        0, description="Number of active annotators on this day"
    )


class AnnotatorStats(BaseModel):
    """Annotator statistics"""

    annotator_id: str = Field(..., description="Annotator ID (placeholder)")
    annotator_name: str = Field(..., description="Annotator name")
    completed_count: int = Field(..., description="Number of completed items")
    avg_annotation_time: Optional[float] = Field(
        None, description="Average annotation time in seconds"
    )
    contribution_rate: float = Field(
        ..., description="Contribution rate relative to total (0-100)"
    )
    skip_rate: float = Field(..., description="Skip rate (0-100)")


class StatsResponse(BaseModel):
    """Generic stats response wrapper"""

    success: bool = True
    data: OverviewStats | list[DailyStats] | list[AnnotatorStats]

