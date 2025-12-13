"""Annotation API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUser
from app.core.database import get_db
from app.models.annotation import (
    AnnotationEvent,
    BBoxAnnotation,
    ClassificationAnnotation,
    EventType,
    PolygonAnnotation,
)
from app.models.item import Item, ItemStatus
from app.models.label import Label
from app.schemas.annotation import (
    BatchAnnotationsCreate,
    BBoxCreate,
    BBoxResponse,
    BBoxUpdate,
    ClassificationCreate,
    ClassificationResponse,
    ItemAnnotationsResponse,
    PolygonCreate,
    PolygonResponse,
    PolygonUpdate,
    SkipRequest,
)

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


# ===== BBox Annotations =====


async def _get_item_with_dataset(item_id: int, db: AsyncSession) -> Item:
    """Get item with dataset loaded, raise 404 if not found."""
    query = select(Item).options(selectinload(Item.dataset)).where(Item.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


async def _validate_label(label_id: int, project_id: int, db: AsyncSession) -> Label:
    """Validate that label exists and belongs to the project."""
    query = select(Label).where(Label.id == label_id, Label.project_id == project_id)
    result = await db.execute(query)
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(
            status_code=400,
            detail=f"Label {label_id} not found in project",
        )
    return label


def _bbox_to_response(bbox: BBoxAnnotation) -> BBoxResponse:
    """Convert BBoxAnnotation to response with label info."""
    return BBoxResponse(
        id=bbox.id,
        item_id=bbox.item_id,
        label_id=bbox.label_id,
        label_name=bbox.label.name if bbox.label else None,
        label_color=bbox.label.color if bbox.label else None,
        x=bbox.x,
        y=bbox.y,
        width=bbox.width,
        height=bbox.height,
        attributes=bbox.attributes,
        user_id=bbox.user_id,
        created_at=bbox.created_at,
        updated_at=bbox.updated_at,
    )


def _polygon_to_response(polygon: PolygonAnnotation) -> PolygonResponse:
    """Convert PolygonAnnotation to response with label info."""
    return PolygonResponse(
        id=polygon.id,
        item_id=polygon.item_id,
        label_id=polygon.label_id,
        label_name=polygon.label.name if polygon.label else None,
        label_color=polygon.label.color if polygon.label else None,
        points=polygon.points,
        attributes=polygon.attributes,
        user_id=polygon.user_id,
        created_at=polygon.created_at,
        updated_at=polygon.updated_at,
    )


@router.get("/items/{item_id}/annotations", response_model=ItemAnnotationsResponse)
async def get_item_annotations(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all annotations (bboxes and polygons) for an item."""
    item = await _get_item_with_dataset(item_id, db)

    # Get bboxes
    bbox_query = (
        select(BBoxAnnotation)
        .options(selectinload(BBoxAnnotation.label))
        .where(BBoxAnnotation.item_id == item_id)
    )
    bbox_result = await db.execute(bbox_query)
    bboxes = bbox_result.scalars().all()

    # Get polygons
    polygon_query = (
        select(PolygonAnnotation)
        .options(selectinload(PolygonAnnotation.label))
        .where(PolygonAnnotation.item_id == item_id)
    )
    polygon_result = await db.execute(polygon_query)
    polygons = polygon_result.scalars().all()

    return ItemAnnotationsResponse(
        item_id=item_id,
        bboxes=[_bbox_to_response(b) for b in bboxes],
        polygons=[_polygon_to_response(p) for p in polygons],
    )


@router.post(
    "/items/{item_id}/bboxes",
    response_model=BBoxResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_bbox(
    item_id: int,
    bbox_in: BBoxCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a bounding box annotation."""
    item = await _get_item_with_dataset(item_id, db)
    if item.status == ItemStatus.DELETED:
        raise HTTPException(status_code=400, detail="Cannot annotate deleted item")

    # Validate label belongs to project
    await _validate_label(bbox_in.label_id, item.dataset.project_id, db)

    # Create bbox
    bbox = BBoxAnnotation(
        item_id=item_id,
        label_id=bbox_in.label_id,
        x=bbox_in.x,
        y=bbox_in.y,
        width=bbox_in.width,
        height=bbox_in.height,
        attributes=bbox_in.attributes,
        user_id=None,  # M1: no auth
    )
    db.add(bbox)

    # Update item status to in_progress if todo
    if item.status == ItemStatus.TODO:
        item.status = ItemStatus.IN_PROGRESS

    await db.flush()
    await db.refresh(bbox)

    # Load label relationship
    label_query = select(Label).where(Label.id == bbox.label_id)
    label_result = await db.execute(label_query)
    bbox.label = label_result.scalar_one()

    return _bbox_to_response(bbox)


@router.put("/bboxes/{bbox_id}", response_model=BBoxResponse)
async def update_bbox(
    bbox_id: int,
    bbox_in: BBoxUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a bounding box annotation."""
    query = (
        select(BBoxAnnotation)
        .options(selectinload(BBoxAnnotation.item).selectinload(Item.dataset))
        .where(BBoxAnnotation.id == bbox_id)
    )
    result = await db.execute(query)
    bbox = result.scalar_one_or_none()

    if not bbox:
        raise HTTPException(status_code=404, detail="BBox not found")

    # Validate label if changing
    if bbox_in.label_id is not None and bbox_in.label_id != bbox.label_id:
        await _validate_label(bbox_in.label_id, bbox.item.dataset.project_id, db)
        bbox.label_id = bbox_in.label_id

    # Update fields
    if bbox_in.x is not None:
        bbox.x = bbox_in.x
    if bbox_in.y is not None:
        bbox.y = bbox_in.y
    if bbox_in.width is not None:
        bbox.width = bbox_in.width
    if bbox_in.height is not None:
        bbox.height = bbox_in.height
    if bbox_in.attributes is not None:
        bbox.attributes = bbox_in.attributes

    await db.flush()
    await db.refresh(bbox)

    # Load label
    label_query = select(Label).where(Label.id == bbox.label_id)
    label_result = await db.execute(label_query)
    bbox.label = label_result.scalar_one()

    return _bbox_to_response(bbox)


@router.delete("/bboxes/{bbox_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bbox(
    bbox_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a bounding box annotation."""
    query = select(BBoxAnnotation).where(BBoxAnnotation.id == bbox_id)
    result = await db.execute(query)
    bbox = result.scalar_one_or_none()

    if not bbox:
        raise HTTPException(status_code=404, detail="BBox not found")

    await db.delete(bbox)
    await db.flush()


# ===== Polygon Annotations =====


@router.post(
    "/items/{item_id}/polygons",
    response_model=PolygonResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_polygon(
    item_id: int,
    polygon_in: PolygonCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a polygon annotation."""
    item = await _get_item_with_dataset(item_id, db)
    if item.status == ItemStatus.DELETED:
        raise HTTPException(status_code=400, detail="Cannot annotate deleted item")

    # Validate label belongs to project
    await _validate_label(polygon_in.label_id, item.dataset.project_id, db)

    # Create polygon
    polygon = PolygonAnnotation(
        item_id=item_id,
        label_id=polygon_in.label_id,
        points=polygon_in.points,
        attributes=polygon_in.attributes,
        user_id=None,  # M1: no auth
    )
    db.add(polygon)

    # Update item status to in_progress if todo
    if item.status == ItemStatus.TODO:
        item.status = ItemStatus.IN_PROGRESS

    await db.flush()
    await db.refresh(polygon)

    # Load label
    label_query = select(Label).where(Label.id == polygon.label_id)
    label_result = await db.execute(label_query)
    polygon.label = label_result.scalar_one()

    return _polygon_to_response(polygon)


@router.put("/polygons/{polygon_id}", response_model=PolygonResponse)
async def update_polygon(
    polygon_id: int,
    polygon_in: PolygonUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a polygon annotation."""
    query = (
        select(PolygonAnnotation)
        .options(selectinload(PolygonAnnotation.item).selectinload(Item.dataset))
        .where(PolygonAnnotation.id == polygon_id)
    )
    result = await db.execute(query)
    polygon = result.scalar_one_or_none()

    if not polygon:
        raise HTTPException(status_code=404, detail="Polygon not found")

    # Validate label if changing
    if polygon_in.label_id is not None and polygon_in.label_id != polygon.label_id:
        await _validate_label(polygon_in.label_id, polygon.item.dataset.project_id, db)
        polygon.label_id = polygon_in.label_id

    # Update fields
    if polygon_in.points is not None:
        polygon.points = polygon_in.points
    if polygon_in.attributes is not None:
        polygon.attributes = polygon_in.attributes

    await db.flush()
    await db.refresh(polygon)

    # Load label
    label_query = select(Label).where(Label.id == polygon.label_id)
    label_result = await db.execute(label_query)
    polygon.label = label_result.scalar_one()

    return _polygon_to_response(polygon)


@router.delete("/polygons/{polygon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_polygon(
    polygon_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a polygon annotation."""
    query = select(PolygonAnnotation).where(PolygonAnnotation.id == polygon_id)
    result = await db.execute(query)
    polygon = result.scalar_one_or_none()

    if not polygon:
        raise HTTPException(status_code=404, detail="Polygon not found")

    await db.delete(polygon)
    await db.flush()


# ===== Batch Operations =====


@router.post("/items/{item_id}/annotations/batch", response_model=ItemAnnotationsResponse)
async def save_annotations_batch(
    item_id: int,
    batch_in: BatchAnnotationsCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Save all annotations for an item (replaces existing).
    Used by canvas to save all drawn objects at once.
    """
    item = await _get_item_with_dataset(item_id, db)
    if item.status == ItemStatus.DELETED:
        raise HTTPException(status_code=400, detail="Cannot annotate deleted item")

    project_id = item.dataset.project_id

    # Delete existing annotations
    await db.execute(
        select(BBoxAnnotation).where(BBoxAnnotation.item_id == item_id)
    )
    existing_bboxes = (await db.execute(
        select(BBoxAnnotation).where(BBoxAnnotation.item_id == item_id)
    )).scalars().all()
    for bbox in existing_bboxes:
        await db.delete(bbox)

    existing_polygons = (await db.execute(
        select(PolygonAnnotation).where(PolygonAnnotation.item_id == item_id)
    )).scalars().all()
    for polygon in existing_polygons:
        await db.delete(polygon)

    # Create new annotations
    new_bboxes = []
    for bbox_in in batch_in.bboxes:
        await _validate_label(bbox_in.label_id, project_id, db)
        bbox = BBoxAnnotation(
            item_id=item_id,
            label_id=bbox_in.label_id,
            x=bbox_in.x,
            y=bbox_in.y,
            width=bbox_in.width,
            height=bbox_in.height,
            attributes=bbox_in.attributes,
            user_id=None,
        )
        db.add(bbox)
        new_bboxes.append(bbox)

    new_polygons = []
    for polygon_in in batch_in.polygons:
        await _validate_label(polygon_in.label_id, project_id, db)
        polygon = PolygonAnnotation(
            item_id=item_id,
            label_id=polygon_in.label_id,
            points=polygon_in.points,
            attributes=polygon_in.attributes,
            user_id=None,
        )
        db.add(polygon)
        new_polygons.append(polygon)

    # Update item status
    if batch_in.bboxes or batch_in.polygons:
        if item.status == ItemStatus.TODO:
            item.status = ItemStatus.IN_PROGRESS
    
    await db.flush()

    # Refresh and load labels
    for bbox in new_bboxes:
        await db.refresh(bbox)
        label_query = select(Label).where(Label.id == bbox.label_id)
        label_result = await db.execute(label_query)
        bbox.label = label_result.scalar_one()

    for polygon in new_polygons:
        await db.refresh(polygon)
        label_query = select(Label).where(Label.id == polygon.label_id)
        label_result = await db.execute(label_query)
        polygon.label = label_result.scalar_one()

    return ItemAnnotationsResponse(
        item_id=item_id,
        bboxes=[_bbox_to_response(b) for b in new_bboxes],
        polygons=[_polygon_to_response(p) for p in new_polygons],
    )


@router.post("/items/{item_id}/submit", status_code=status.HTTP_200_OK)
async def submit_annotations(
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Mark item as done after annotation is complete."""
    item = await _get_item_with_dataset(item_id, db)
    
    if item.status == ItemStatus.DELETED:
        raise HTTPException(status_code=400, detail="Cannot submit deleted item")
    
    if item.status == ItemStatus.DONE:
        return {"status": "already_done"}

    # Update status
    item.status = ItemStatus.DONE
    item.skip_reason = None

    # Write event
    event = AnnotationEvent(
        project_id=item.dataset.project_id,
        dataset_id=item.dataset_id,
        item_id=item_id,
        event_type=EventType.SUBMIT_DONE,
        payload=None,
    )
    db.add(event)

    await db.flush()

    return {"status": "submitted"}

