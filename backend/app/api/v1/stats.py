"""
Statistics API endpoints
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.project import Project
from app.schemas.stats import AnnotatorStats, DailyStats, OverviewStats
from app.services.stats import StatsService

router = APIRouter(prefix="/stats", tags=["statistics"])


@router.get("/projects/{project_id}/overview", response_model=OverviewStats)
async def get_project_overview_stats(
    project_id: int,
    dataset_id: Optional[int] = Query(None, description="Optional dataset filter"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get overview statistics for a project or dataset
    """
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stats = await StatsService.get_overview_stats(db, project_id, dataset_id)
    return stats


@router.get("/projects/{project_id}/daily", response_model=list[DailyStats])
async def get_project_daily_stats(
    project_id: int,
    dataset_id: Optional[int] = Query(None, description="Optional dataset filter"),
    days: int = Query(30, ge=1, le=365, description="Number of days to retrieve"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get daily statistics for a project or dataset
    """
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stats = await StatsService.get_daily_stats(db, project_id, dataset_id, days)
    return stats


@router.get("/projects/{project_id}/annotators", response_model=list[AnnotatorStats])
async def get_project_annotator_stats(
    project_id: int,
    dataset_id: Optional[int] = Query(None, description="Optional dataset filter"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get per-annotator statistics for a project or dataset
    (Placeholder in v1 single-user mode)
    """
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stats = await StatsService.get_annotator_stats(db, project_id, dataset_id)
    return stats

