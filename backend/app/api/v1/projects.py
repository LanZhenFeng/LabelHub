"""Project API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.dataset import Dataset
from app.models.item import Item, ItemStatus
from app.models.label import Label
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new project with optional labels."""
    project = Project(
        name=project_in.name,
        description=project_in.description,
        task_type=project_in.task_type,
    )
    db.add(project)
    await db.flush()

    # Create labels if provided
    for idx, label_data in enumerate(project_in.labels):
        label = Label(
            project_id=project.id,
            name=label_data.name,
            color=label_data.color,
            shortcut=label_data.shortcut or str(idx + 1) if idx < 9 else None,
            order=idx,
        )
        db.add(label)

    await db.flush()
    await db.refresh(project, ["labels"])

    return _project_to_response(project, 0, 0, 0)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
):
    """List all projects with statistics."""
    # Get projects with labels
    query = select(Project).options(selectinload(Project.labels)).order_by(Project.created_at.desc())
    result = await db.execute(query)
    projects = result.scalars().all()

    responses = []
    for project in projects:
        # Get counts
        stats = await _get_project_stats(db, project.id)
        responses.append(_project_to_response(project, **stats))

    return responses


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a project by ID."""
    query = select(Project).options(selectinload(Project.labels)).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stats = await _get_project_stats(db, project.id)
    return _project_to_response(project, **stats)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a project."""
    query = select(Project).options(selectinload(Project.labels)).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project_in.name is not None:
        project.name = project_in.name
    if project_in.description is not None:
        project.description = project_in.description

    await db.flush()
    await db.refresh(project)

    stats = await _get_project_stats(db, project.id)
    return _project_to_response(project, **stats)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a project."""
    query = select(Project).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.flush()


async def _get_project_stats(db: AsyncSession, project_id: int) -> dict:
    """Get project statistics."""
    # Count datasets
    dataset_query = select(func.count(Dataset.id)).where(Dataset.project_id == project_id)
    result = await db.execute(dataset_query)
    dataset_count = result.scalar() or 0

    # Count items through datasets
    item_query = (
        select(func.count(Item.id))
        .join(Dataset)
        .where(Dataset.project_id == project_id)
        .where(Item.status != ItemStatus.DELETED)
    )
    result = await db.execute(item_query)
    item_count = result.scalar() or 0

    # Count done items
    done_query = (
        select(func.count(Item.id))
        .join(Dataset)
        .where(Dataset.project_id == project_id)
        .where(Item.status == ItemStatus.DONE)
    )
    result = await db.execute(done_query)
    done_count = result.scalar() or 0

    return {
        "dataset_count": dataset_count,
        "item_count": item_count,
        "done_count": done_count,
    }


def _project_to_response(
    project: Project,
    dataset_count: int,
    item_count: int,
    done_count: int,
) -> ProjectResponse:
    """Convert project to response with statistics."""
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        task_type=project.task_type,
        created_at=project.created_at,
        updated_at=project.updated_at,
        labels=[
            {
                "id": label.id,
                "project_id": label.project_id,
                "name": label.name,
                "color": label.color,
                "shortcut": label.shortcut,
                "order": label.order,
                "created_at": label.created_at,
            }
            for label in project.labels
        ],
        dataset_count=dataset_count,
        item_count=item_count,
        done_count=done_count,
    )

