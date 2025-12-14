"""
Statistics service - Aggregates data from AnnotationEvent logs
"""

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.annotation import (
    AnnotationEvent,
    BBoxAnnotation,
    ClassificationAnnotation,
    PolygonAnnotation,
)
from app.models.dataset import Dataset
from app.models.item import Item, ItemStatus
from app.models.label import Label
from app.schemas.stats import AnnotatorStats, DailyStats, OverviewStats


class StatsService:
    """
    Statistics calculation service based on AnnotationEvent logs
    """

    @staticmethod
    async def get_overview_stats(
        db: AsyncSession, project_id: int, dataset_id: Optional[int] = None
    ) -> OverviewStats:
        """
        Calculate overview statistics for a project or dataset
        """
        # Build base query for items
        # Item has dataset_id, need to join Dataset to filter by project_id
        if dataset_id:
            # Filter by specific dataset
            query = select(Item).where(Item.dataset_id == dataset_id)
        else:
            # Filter by project (join through Dataset)
            query = (
                select(Item)
                .join(Dataset, Item.dataset_id == Dataset.id)
                .where(Dataset.project_id == project_id)
            )

        result = await db.execute(query)
        items = result.scalars().all()

        total_items = len(items)
        completed_items = sum(1 for item in items if item.status == ItemStatus.DONE)
        in_progress_items = sum(
            1 for item in items if item.status == ItemStatus.IN_PROGRESS
        )
        skipped_items = sum(1 for item in items if item.status == ItemStatus.SKIPPED)
        todo_items = sum(1 for item in items if item.status == ItemStatus.TODO)

        completion_rate = (
            (completed_items / total_items * 100) if total_items > 0 else 0.0
        )
        skip_rate = (skipped_items / total_items * 100) if total_items > 0 else 0.0

        # Calculate average annotation time from events
        avg_annotation_time = await StatsService._calculate_avg_annotation_time(
            db, project_id, dataset_id
        )

        # Calculate daily throughput
        avg_daily_throughput = await StatsService._calculate_avg_daily_throughput(
            db, project_id, dataset_id
        )

        # Calculate pre-annotation adoption metrics
        pre_annotation_adopt_rate, pre_annotation_modify_rate = (
            await StatsService._calculate_pre_annotation_metrics(
                db, project_id, dataset_id
            )
        )

        # Calculate category distribution
        category_distribution = await StatsService._calculate_category_distribution(
            db, project_id, dataset_id
        )

        return OverviewStats(
            total_items=total_items,
            completed_items=completed_items,
            in_progress_items=in_progress_items,
            skipped_items=skipped_items,
            todo_items=todo_items,
            completion_rate=round(completion_rate, 2),
            avg_annotation_time=avg_annotation_time,
            avg_daily_throughput=avg_daily_throughput,
            skip_rate=round(skip_rate, 2),
            pre_annotation_adopt_rate=pre_annotation_adopt_rate,
            pre_annotation_modify_rate=pre_annotation_modify_rate,
            category_distribution=category_distribution,
        )

    @staticmethod
    async def get_daily_stats(
        db: AsyncSession,
        project_id: int,
        dataset_id: Optional[int] = None,
        days: int = 30,
    ) -> list[DailyStats]:
        """
        Calculate daily statistics for the last N days
        """
        start_date = datetime.now() - timedelta(days=days)

        # Query events grouped by date
        query = (
            select(
                func.date(AnnotationEvent.ts).label("event_date"),
                func.count(AnnotationEvent.id).label("count"),
                AnnotationEvent.event_type,
            )
            .where(
                AnnotationEvent.project_id == project_id,
                AnnotationEvent.ts >= start_date,
            )
            .group_by("event_date", AnnotationEvent.event_type)
        )

        if dataset_id:
            query = query.where(AnnotationEvent.dataset_id == dataset_id)

        result = await db.execute(query)
        rows = result.all()

        # Aggregate by date
        daily_data: dict[date, dict] = defaultdict(
            lambda: {"completed": 0, "skipped": 0, "times": [], "annotators": set()}
        )

        for row in rows:
            event_date = row.event_date
            event_type = row.event_type

            if event_type == "submit_done":
                daily_data[event_date]["completed"] += row.count
            elif event_type == "skip":
                daily_data[event_date]["skipped"] += row.count

        # Query annotation times from duration_ms
        time_query = (
            select(
                func.date(AnnotationEvent.ts).label("event_date"),
                AnnotationEvent.duration_ms,
            )
            .where(
                AnnotationEvent.project_id == project_id,
                AnnotationEvent.event_type == "submit_done",
                AnnotationEvent.ts >= start_date,
                AnnotationEvent.duration_ms.isnot(None),
            )
        )

        if dataset_id:
            time_query = time_query.where(AnnotationEvent.dataset_id == dataset_id)

        time_result = await db.execute(time_query)
        time_rows = time_result.all()

        for row in time_rows:
            event_date = row.event_date
            duration_seconds = row.duration_ms / 1000.0
            daily_data[event_date]["times"].append(duration_seconds)

        # Build response
        daily_stats = []
        for i in range(days):
            target_date = (datetime.now() - timedelta(days=days - i - 1)).date()
            data = daily_data.get(target_date, {})

            times = data.get("times", [])
            avg_time = sum(times) / len(times) if times else None

            daily_stats.append(
                DailyStats(
                    stat_date=target_date,
                    completed_count=data.get("completed", 0),
                    skipped_count=data.get("skipped", 0),
                    avg_annotation_time=round(avg_time, 2) if avg_time else None,
                    active_annotators=0,  # Placeholder for multi-user version
                )
            )

        return daily_stats

    @staticmethod
    async def get_annotator_stats(
        db: AsyncSession, project_id: int, dataset_id: Optional[int] = None
    ) -> list[AnnotatorStats]:
        """
        Calculate per-annotator statistics (placeholder for v1 single-user mode)
        """
        # In v1, we have single user mode, so return a single "default" annotator
        overview = await StatsService.get_overview_stats(db, project_id, dataset_id)

        return [
            AnnotatorStats(
                annotator_id="default",
                annotator_name="Default User",
                completed_count=overview.completed_items,
                avg_annotation_time=overview.avg_annotation_time,
                contribution_rate=100.0,
                skip_rate=overview.skip_rate,
            )
        ]

    # Helper methods

    @staticmethod
    async def _calculate_avg_annotation_time(
        db: AsyncSession, project_id: int, dataset_id: Optional[int] = None
    ) -> Optional[float]:
        """
        Calculate average annotation time from submit events
        """
        query = select(AnnotationEvent.duration_ms).where(
            AnnotationEvent.project_id == project_id,
            AnnotationEvent.event_type == "submit_done",
            AnnotationEvent.duration_ms.isnot(None),
        )

        if dataset_id:
            query = query.where(AnnotationEvent.dataset_id == dataset_id)

        result = await db.execute(query)
        durations_ms = result.scalars().all()

        if not durations_ms:
            return None

        avg_seconds = sum(durations_ms) / len(durations_ms) / 1000.0
        return round(avg_seconds, 2)

    @staticmethod
    async def _calculate_avg_daily_throughput(
        db: AsyncSession, project_id: int, dataset_id: Optional[int] = None
    ) -> Optional[float]:
        """
        Calculate average daily throughput per annotator
        """
        # Get events from the last 7 days
        start_date = datetime.now() - timedelta(days=7)

        query = select(func.count(AnnotationEvent.id)).where(
            AnnotationEvent.project_id == project_id,
            AnnotationEvent.event_type == "submit_done",
            AnnotationEvent.ts >= start_date,
        )

        if dataset_id:
            query = query.where(AnnotationEvent.dataset_id == dataset_id)

        result = await db.execute(query)
        total_completed = result.scalar() or 0

        # In single-user mode, divide by 7 days (assuming 1 annotator)
        return round(total_completed / 7, 2) if total_completed > 0 else None

    @staticmethod
    async def _calculate_pre_annotation_metrics(
        db: AsyncSession, project_id: int, dataset_id: Optional[int] = None
    ) -> tuple[Optional[float], Optional[float]]:
        """
        Calculate pre-annotation adoption and modification rates
        """
        # Query adopt events
        adopt_query = select(func.count(AnnotationEvent.id)).where(
            AnnotationEvent.project_id == project_id,
            AnnotationEvent.event_type == "adopt_prediction",
        )

        if dataset_id:
            adopt_query = adopt_query.where(AnnotationEvent.dataset_id == dataset_id)

        adopt_result = await db.execute(adopt_query)
        adopt_count = adopt_result.scalar() or 0

        # Query total items with pre-annotations (items that have been imported with pre-annotations)
        # For now, we approximate by counting adopt + modify events
        modify_query = select(func.count(AnnotationEvent.id)).where(
            AnnotationEvent.project_id == project_id,
            AnnotationEvent.event_type == "modify_prediction",
        )

        if dataset_id:
            modify_query = modify_query.where(AnnotationEvent.dataset_id == dataset_id)

        modify_result = await db.execute(modify_query)
        modify_count = modify_result.scalar() or 0

        total_with_pre = adopt_count + modify_count

        if total_with_pre == 0:
            return None, None

        adopt_rate = (adopt_count / total_with_pre * 100) if total_with_pre > 0 else 0.0
        modify_rate = (
            (modify_count / total_with_pre * 100) if total_with_pre > 0 else 0.0
        )

        return round(adopt_rate, 2), round(modify_rate, 2)

    @staticmethod
    async def _calculate_category_distribution(
        db: AsyncSession, project_id: int, dataset_id: Optional[int] = None
    ) -> dict[str, int]:
        """
        Calculate annotation count by category
        """
        # Get all labels for the project
        labels_result = await db.execute(
            select(Label).where(Label.project_id == project_id)
        )
        labels = {label.id: label.name for label in labels_result.scalars().all()}

        if not labels:
            return {}

        distribution: dict[str, int] = defaultdict(int)

        # Query classification annotations (uses 'label' string field, not label_id)
        cls_query = select(
            ClassificationAnnotation.label,
            func.count(ClassificationAnnotation.id),
        )

        if dataset_id:
            # Filter by specific dataset
            cls_query = cls_query.join(
                Item, ClassificationAnnotation.item_id == Item.id
            ).where(Item.dataset_id == dataset_id)
        else:
            # Filter by project (join through Item -> Dataset)
            cls_query = cls_query.join(
                Item, ClassificationAnnotation.item_id == Item.id
            ).join(
                Dataset, Item.dataset_id == Dataset.id
            ).where(Dataset.project_id == project_id)

        cls_query = cls_query.group_by(ClassificationAnnotation.label)

        cls_result = await db.execute(cls_query)
        for label_name, count in cls_result.all():
            distribution[label_name] += count

        # Query bbox annotations (has label_id)
        bbox_query = select(
            BBoxAnnotation.label_id, func.count(BBoxAnnotation.id)
        )

        if dataset_id:
            # Filter by specific dataset
            bbox_query = bbox_query.join(Item, BBoxAnnotation.item_id == Item.id).where(
                Item.dataset_id == dataset_id
            )
        else:
            # Filter by project (join through Item -> Dataset)
            bbox_query = bbox_query.join(
                Item, BBoxAnnotation.item_id == Item.id
            ).join(
                Dataset, Item.dataset_id == Dataset.id
            ).where(Dataset.project_id == project_id)

        bbox_query = bbox_query.group_by(BBoxAnnotation.label_id)

        bbox_result = await db.execute(bbox_query)
        for label_id, count in bbox_result.all():
            label_name = labels.get(label_id, "Unknown")
            distribution[label_name] += count

        # Query polygon annotations (has label_id)
        poly_query = select(
            PolygonAnnotation.label_id, func.count(PolygonAnnotation.id)
        )

        if dataset_id:
            # Filter by specific dataset
            poly_query = poly_query.join(
                Item, PolygonAnnotation.item_id == Item.id
            ).where(Item.dataset_id == dataset_id)
        else:
            # Filter by project (join through Item -> Dataset)
            poly_query = poly_query.join(
                Item, PolygonAnnotation.item_id == Item.id
            ).join(
                Dataset, Item.dataset_id == Dataset.id
            ).where(Dataset.project_id == project_id)

        poly_query = poly_query.group_by(PolygonAnnotation.label_id)

        poly_result = await db.execute(poly_query)
        for label_id, count in poly_result.all():
            label_name = labels.get(label_id, "Unknown")
            distribution[label_name] += count

        return dict(distribution)

