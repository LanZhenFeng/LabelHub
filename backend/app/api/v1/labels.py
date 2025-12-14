"""Label API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.label import Label
from app.models.project import Project
from app.schemas.label import LabelCreate, LabelResponse, LabelsUpdate

router = APIRouter()


@router.get("/projects/{project_id}/labels", response_model=list[LabelResponse])
async def list_labels(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all labels for a project."""
    # Verify project exists
    project_query = select(Project).where(Project.id == project_id)
    result = await db.execute(project_query)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(Label).where(Label.project_id == project_id).order_by(Label.order)
    result = await db.execute(query)
    return result.scalars().all()


@router.post(
    "/projects/{project_id}/labels",
    response_model=list[LabelResponse],
    status_code=status.HTTP_201_CREATED,
)
async def set_labels(
    project_id: int,
    labels_in: LabelsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Set labels for a project (replaces existing labels)."""
    # Verify project exists
    project_query = select(Project).where(Project.id == project_id)
    result = await db.execute(project_query)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete existing labels
    await db.execute(delete(Label).where(Label.project_id == project_id))

    # Create new labels
    new_labels = []
    for idx, label_data in enumerate(labels_in.labels):
        label = Label(
            project_id=project_id,
            name=label_data.name,
            color=label_data.color,
            shortcut=label_data.shortcut or (str(idx + 1) if idx < 9 else None),
            order=idx,
        )
        db.add(label)
        new_labels.append(label)

    await db.flush()

    # Refresh to get IDs
    for label in new_labels:
        await db.refresh(label)

    return new_labels


@router.post(
    "/projects/{project_id}/labels/add",
    response_model=LabelResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_label(
    project_id: int,
    label_in: LabelCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a single label to a project."""
    # Verify project exists
    project_query = select(Project).where(Project.id == project_id)
    result = await db.execute(project_query)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Get max order
    order_query = select(Label.order).where(Label.project_id == project_id).order_by(Label.order.desc()).limit(1)
    result = await db.execute(order_query)
    max_order = result.scalar() or -1

    label = Label(
        project_id=project_id,
        name=label_in.name,
        color=label_in.color,
        shortcut=label_in.shortcut,
        order=max_order + 1,
    )
    db.add(label)
    await db.flush()
    await db.refresh(label)

    return label


@router.delete("/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label(
    label_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a label."""
    query = select(Label).where(Label.id == label_id)
    result = await db.execute(query)
    label = result.scalar_one_or_none()

    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    await db.delete(label)

