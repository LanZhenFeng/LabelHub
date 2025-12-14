"""Dataset API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AdminUser, CurrentUser, get_current_user  # M4: Add auth dependencies
from app.core.database import get_db
from app.models.dataset import Dataset
from app.models.item import Item, ItemStatus
from app.models.project import Project
from app.schemas.dataset import DatasetCreate, DatasetResponse, ScanRequest, ScanResponse
from app.services.importer import ImporterService

router = APIRouter()


@router.post(
    "/projects/{project_id}/datasets",
    response_model=DatasetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dataset(
    project_id: int,
    dataset_in: DatasetCreate,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(),  # M4: Only admins can create datasets
):
    """Create a new dataset in a project (Admin only)."""
    # Verify project exists
    project_query = select(Project).where(Project.id == project_id)
    result = await db.execute(project_query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset = Dataset(
        project_id=project_id,
        name=dataset_in.name,
        description=dataset_in.description,
        root_path=dataset_in.root_path,
    )
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)

    return _dataset_to_response(dataset, 0, 0, 0, 0)


@router.get("/projects/{project_id}/datasets", response_model=list[DatasetResponse])
async def list_datasets(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List all datasets in a project."""
    # Verify project exists
    project_query = select(Project).where(Project.id == project_id)
    result = await db.execute(project_query)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Get datasets
    query = select(Dataset).where(Dataset.project_id == project_id).order_by(Dataset.created_at.desc())
    result = await db.execute(query)
    datasets = result.scalars().all()

    responses = []
    for dataset in datasets:
        stats = await _get_dataset_stats(db, dataset.id)
        responses.append(_dataset_to_response(dataset, **stats))

    return responses


@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a dataset by ID."""
    query = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(query)
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    stats = await _get_dataset_stats(db, dataset.id)
    return _dataset_to_response(dataset, **stats)


@router.post("/datasets/{dataset_id}/scan", response_model=ScanResponse)
async def scan_dataset(
    dataset_id: int,
    scan_request: ScanRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(),  # M4: Only admins can scan datasets
):
    """Scan server path and import images into dataset (Admin only)."""
    query = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(query)
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    importer = ImporterService(db)
    return await importer.scan_directory(
        dataset=dataset,
        glob_pattern=scan_request.glob,
        limit=scan_request.limit,
    )


@router.delete("/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(),  # M4: Only admins can delete datasets
):
    """Delete a dataset (Admin only)."""
    query = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(query)
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    await db.delete(dataset)
    await db.flush()


async def _get_dataset_stats(db: AsyncSession, dataset_id: int) -> dict:
    """Get dataset statistics."""
    base_query = select(func.count(Item.id)).where(Item.dataset_id == dataset_id)

    # Total (excluding deleted)
    total_query = base_query.where(Item.status != ItemStatus.DELETED)
    result = await db.execute(total_query)
    item_count = result.scalar() or 0

    # Todo
    todo_query = base_query.where(Item.status.in_([ItemStatus.TODO, ItemStatus.IN_PROGRESS]))
    result = await db.execute(todo_query)
    todo_count = result.scalar() or 0

    # Done
    done_query = base_query.where(Item.status == ItemStatus.DONE)
    result = await db.execute(done_query)
    done_count = result.scalar() or 0

    # Skipped
    skipped_query = base_query.where(Item.status == ItemStatus.SKIPPED)
    result = await db.execute(skipped_query)
    skipped_count = result.scalar() or 0

    return {
        "item_count": item_count,
        "todo_count": todo_count,
        "done_count": done_count,
        "skipped_count": skipped_count,
    }


def _dataset_to_response(
    dataset: Dataset,
    item_count: int,
    todo_count: int,
    done_count: int,
    skipped_count: int,
) -> DatasetResponse:
    """Convert dataset to response with statistics."""
    return DatasetResponse(
        id=dataset.id,
        project_id=dataset.project_id,
        name=dataset.name,
        description=dataset.description,
        root_path=dataset.root_path,
        created_at=dataset.created_at,
        updated_at=dataset.updated_at,
        item_count=item_count,
        todo_count=todo_count,
        done_count=done_count,
        skipped_count=skipped_count,
    )

