"""Annotation API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.annotation import AnnotationEvent, ClassificationAnnotation, EventType
from app.models.dataset import Dataset
from app.models.item import Item, ItemStatus
from app.schemas.annotation import ClassificationCreate, ClassificationResponse, SkipRequest

router = APIRouter()


@router.post(
    "/items/{item_id}/classification",
    response_model=ClassificationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_classification(
    item_id: int,
    classification_in: ClassificationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submit a classification for an item."""
    # Get item with dataset
    query = select(Item).options(selectinload(Item.dataset)).where(Item.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.status == ItemStatus.DELETED:
        raise HTTPException(status_code=400, detail="Cannot annotate deleted item")

    # Create classification annotation
    classification = ClassificationAnnotation(
        item_id=item_id,
        label=classification_in.label,
        user_id=None,  # M0: no auth
    )
    db.add(classification)

    # Update item status to done
    item.status = ItemStatus.DONE
    item.skip_reason = None

    # Write events
    save_event = AnnotationEvent(
        project_id=item.dataset.project_id,
        dataset_id=item.dataset_id,
        item_id=item_id,
        event_type=EventType.SAVE,
        payload={"label": classification_in.label},
    )
    db.add(save_event)

    submit_event = AnnotationEvent(
        project_id=item.dataset.project_id,
        dataset_id=item.dataset_id,
        item_id=item_id,
        event_type=EventType.SUBMIT_DONE,
        payload={"label": classification_in.label},
    )
    db.add(submit_event)

    await db.flush()
    await db.refresh(classification)

    return classification


@router.post("/items/{item_id}/skip", status_code=status.HTTP_200_OK)
async def skip_item(
    item_id: int,
    skip_in: SkipRequest,
    db: AsyncSession = Depends(get_db),
):
    """Skip an item with a reason."""
    # Get item with dataset
    query = select(Item).options(selectinload(Item.dataset)).where(Item.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.status == ItemStatus.DELETED:
        raise HTTPException(status_code=400, detail="Cannot skip deleted item")

    # Update status
    item.status = ItemStatus.SKIPPED
    item.skip_reason = skip_in.reason

    # Write event
    event = AnnotationEvent(
        project_id=item.dataset.project_id,
        dataset_id=item.dataset_id,
        item_id=item_id,
        event_type=EventType.SKIP,
        payload={"reason": skip_in.reason},
    )
    db.add(event)

    await db.flush()

    return {"status": "skipped", "reason": skip_in.reason}


@router.post("/items/{item_id}/delete", status_code=status.HTTP_200_OK)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Soft delete an item."""
    # Get item with dataset
    query = select(Item).options(selectinload(Item.dataset)).where(Item.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.status == ItemStatus.DELETED:
        raise HTTPException(status_code=400, detail="Item already deleted")

    # Update status
    previous_status = item.status
    item.status = ItemStatus.DELETED

    # Write event
    event = AnnotationEvent(
        project_id=item.dataset.project_id,
        dataset_id=item.dataset_id,
        item_id=item_id,
        event_type=EventType.DELETE,
        payload={"previous_status": previous_status.value},
    )
    db.add(event)

    await db.flush()

    return {"status": "deleted"}


@router.post("/items/{item_id}/restore", status_code=status.HTTP_200_OK)
async def restore_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Restore a deleted item."""
    # Get item with dataset
    query = select(Item).options(selectinload(Item.dataset)).where(Item.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.status != ItemStatus.DELETED:
        raise HTTPException(status_code=400, detail="Item is not deleted")

    # Update status back to todo
    item.status = ItemStatus.TODO
    item.skip_reason = None

    # Write event
    event = AnnotationEvent(
        project_id=item.dataset.project_id,
        dataset_id=item.dataset_id,
        item_id=item_id,
        event_type=EventType.RESTORE,
        payload=None,
    )
    db.add(event)

    await db.flush()

    return {"status": "restored"}

