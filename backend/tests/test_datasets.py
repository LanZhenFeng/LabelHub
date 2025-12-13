"""Tests for dataset endpoints."""

import pytest
from httpx import AsyncClient


@pytest.fixture
async def project_id(client: AsyncClient) -> int:
    """Create a project for testing."""
    response = await client.post(
        "/api/v1/projects",
        json={"name": "Test Project", "task_type": "classification"},
    )
    return response.json()["id"]


@pytest.mark.asyncio
async def test_create_dataset(client: AsyncClient, project_id: int):
    """Test creating a dataset."""
    response = await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={
            "name": "Test Dataset",
            "description": "A test dataset",
            "root_path": "/tmp/test_images",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Dataset"
    assert data["root_path"] == "/tmp/test_images"
    assert data["project_id"] == project_id


@pytest.mark.asyncio
async def test_list_datasets(client: AsyncClient, project_id: int):
    """Test listing datasets in a project."""
    # Create a dataset first
    await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={"name": "Dataset 1", "root_path": "/tmp/images1"},
    )

    response = await client.get(f"/api/v1/projects/{project_id}/datasets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_dataset(client: AsyncClient, project_id: int):
    """Test getting a dataset by ID."""
    # Create a dataset first
    create_response = await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={"name": "Test Dataset", "root_path": "/tmp/images"},
    )
    dataset_id = create_response.json()["id"]

    response = await client.get(f"/api/v1/datasets/{dataset_id}")
    assert response.status_code == 200
    assert response.json()["id"] == dataset_id


@pytest.mark.asyncio
async def test_delete_dataset(client: AsyncClient, project_id: int):
    """Test deleting a dataset."""
    # Create a dataset first
    create_response = await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={"name": "To Delete", "root_path": "/tmp/images"},
    )
    dataset_id = create_response.json()["id"]

    response = await client.delete(f"/api/v1/datasets/{dataset_id}")
    assert response.status_code == 204

    # Verify it's deleted
    get_response = await client.get(f"/api/v1/datasets/{dataset_id}")
    assert get_response.status_code == 404

