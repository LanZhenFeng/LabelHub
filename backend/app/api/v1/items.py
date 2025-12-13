"""Item API endpoints."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.annotation import AnnotationEvent, ClassificationAnnotation, EventType
from app.models.dataset import Dataset
from app.models.item import Item, ItemStatus
from app.schemas.item import ItemListResponse, ItemResponse, NextItemResponse
from app.services.thumbs import ThumbnailService

router = APIRouter()


@router.get("/datasets/{dataset_id}/items", response_model=ItemListResponse)
async def list_items(
    dataset_id: int,
    status: ItemStatus | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List items in a dataset with pagination."""
    # Verify dataset exists
    dataset_query = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(dataset_query)
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Base query
    base_query = select(Item).where(Item.dataset_id == dataset_id)

    # Apply status filter
    if status:
        base_query = base_query.where(Item.status == status)
    else:
        # Exclude deleted by default
        base_query = base_query.where(Item.status != ItemStatus.DELETED)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    result = await db.execute(count_query)
    total = result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    items_query = base_query.order_by(Item.id).offset(offset).limit(page_size)
    items_query = items_query.options(selectinload(Item.classifications))

    result = await db.execute(items_query)
    items = result.scalars().all()

    return ItemListResponse(
        items=[_item_to_response(item, dataset.root_path) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/datasets/{dataset_id}/next-item", response_model=NextItemResponse)
async def get_next_item(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get the next item to annotate."""
    # Verify dataset exists and get it
    dataset_query = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(dataset_query)
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Get next todo or in_progress item
    item_query = (
        select(Item)
        .where(Item.dataset_id == dataset_id)
        .where(Item.status.in_([ItemStatus.TODO, ItemStatus.IN_PROGRESS]))
        .order_by(Item.id)
        .limit(1)
        .options(selectinload(Item.classifications))
    )
    result = await db.execute(item_query)
    item = result.scalar_one_or_none()

    # Get counts
    base_query = select(func.count(Item.id)).where(Item.dataset_id == dataset_id)

    # Total (excluding deleted)
    total_query = base_query.where(Item.status != ItemStatus.DELETED)
    result = await db.execute(total_query)
    total_count = result.scalar() or 0

    # Done
    done_query = base_query.where(Item.status == ItemStatus.DONE)
    result = await db.execute(done_query)
    done_count = result.scalar() or 0

    # Remaining
    remaining_query = base_query.where(Item.status.in_([ItemStatus.TODO, ItemStatus.IN_PROGRESS]))
    result = await db.execute(remaining_query)
    remaining_count = result.scalar() or 0

    if item:
        # Set status to in_progress if todo
        if item.status == ItemStatus.TODO:
            item.status = ItemStatus.IN_PROGRESS

        # Write open event
        event = AnnotationEvent(
            project_id=dataset.project_id,
            dataset_id=dataset_id,
            item_id=item.id,
            event_type=EventType.OPEN,
            payload=None,
        )
        db.add(event)
        await db.flush()
        await db.refresh(item)  # Refresh to get updated_at

        return NextItemResponse(
            item=_item_to_response(item, dataset.root_path),
            remaining_count=remaining_count,
            total_count=total_count,
            done_count=done_count,
        )

    return NextItemResponse(
        item=None,
        remaining_count=0,
        total_count=total_count,
        done_count=done_count,
    )


@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single item by ID."""
    query = (
        select(Item)
        .options(selectinload(Item.dataset), selectinload(Item.classifications))
        .where(Item.id == item_id)
    )
    result = await db.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return _item_to_response(item, item.dataset.root_path)


@router.get("/items/{item_id}/previous", response_model=ItemResponse | None)
async def get_previous_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get the previous item in the dataset (by ID order)."""
    # Get current item to know dataset
    current_query = (
        select(Item)
        .options(selectinload(Item.dataset))
        .where(Item.id == item_id)
    )
    result = await db.execute(current_query)
    current_item = result.scalar_one_or_none()

    if not current_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Get previous item (smaller ID in same dataset, excluding deleted)
    prev_query = (
        select(Item)
        .options(selectinload(Item.dataset), selectinload(Item.classifications))
        .where(Item.dataset_id == current_item.dataset_id)
        .where(Item.id < item_id)
        .where(Item.status != ItemStatus.DELETED)
        .order_by(Item.id.desc())
        .limit(1)
    )
    result = await db.execute(prev_query)
    prev_item = result.scalar_one_or_none()

    if not prev_item:
        return None

    return _item_to_response(prev_item, prev_item.dataset.root_path)


@router.get("/items/{item_id}/next", response_model=ItemResponse | None)
async def get_next_item_by_order(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get the next item in the dataset (by ID order, regardless of status)."""
    # Get current item to know dataset
    current_query = (
        select(Item)
        .options(selectinload(Item.dataset))
        .where(Item.id == item_id)
    )
    result = await db.execute(current_query)
    current_item = result.scalar_one_or_none()

    if not current_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Get next item (larger ID in same dataset, excluding deleted)
    next_query = (
        select(Item)
        .options(selectinload(Item.dataset), selectinload(Item.classifications))
        .where(Item.dataset_id == current_item.dataset_id)
        .where(Item.id > item_id)
        .where(Item.status != ItemStatus.DELETED)
        .order_by(Item.id.asc())
        .limit(1)
    )
    result = await db.execute(next_query)
    next_item = result.scalar_one_or_none()

    if not next_item:
        return None

    return _item_to_response(next_item, next_item.dataset.root_path)


@router.get("/items/{item_id}/thumb")
async def get_thumbnail(
    item_id: int,
    size: int = Query(256, ge=64, le=512),
    db: AsyncSession = Depends(get_db),
):
    """Get thumbnail for an item."""
    # Get item with dataset
    query = select(Item).options(selectinload(Item.dataset)).where(Item.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Construct full path
    full_path = Path(item.dataset.root_path) / item.rel_path

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    # Generate thumbnail
    thumb_service = ThumbnailService()
    thumb_path = thumb_service.ensure_thumbnail(str(full_path), size)

    if not thumb_path or not thumb_path.exists():
        raise HTTPException(status_code=500, detail="Failed to generate thumbnail")

    return FileResponse(
        thumb_path,
        media_type="image/webp",
        headers={
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
    )


@router.get("/items/{item_id}/image")
async def get_image(
    item_id: int,
    variant: str = Query("orig", regex="^(orig|medium)$"),
    db: AsyncSession = Depends(get_db),
):
    """Get original image for an item."""
    # Get item with dataset
    query = select(Item).options(selectinload(Item.dataset)).where(Item.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Construct full path
    full_path = Path(item.dataset.root_path) / item.rel_path

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    # Determine media type from extension
    extension = full_path.suffix.lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    media_type = media_types.get(extension, "application/octet-stream")

    return FileResponse(
        full_path,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=3600",
        },
    )


def _item_to_response(item: Item, root_path: str) -> ItemResponse:
    """Convert item to response."""
    # Get current label if any
    current_label = None
    if item.classifications:
        current_label = item.classifications[-1].label

    return ItemResponse(
        id=item.id,
        dataset_id=item.dataset_id,
        rel_path=item.rel_path,
        filename=item.filename,
        width=item.width,
        height=item.height,
        file_size=item.file_size,
        status=item.status,
        skip_reason=item.skip_reason,
        created_at=item.created_at,
        updated_at=item.updated_at,
        thumb_url=f"/api/v1/items/{item.id}/thumb",
        image_url=f"/api/v1/items/{item.id}/image",
        label=current_label,
    )

