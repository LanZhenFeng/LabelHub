"""Tests for project endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient):
    """Test creating a project."""
    response = await client.post(
        "/api/v1/projects",
        json={
            "name": "Test Project",
            "description": "A test project",
            "task_type": "classification",
            "labels": [
                {"name": "Cat", "color": "#FF0000"},
                {"name": "Dog", "color": "#00FF00"},
            ],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["task_type"] == "classification"
    assert len(data["labels"]) == 2
    assert data["labels"][0]["name"] == "Cat"
    assert data["labels"][0]["shortcut"] == "1"


@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient):
    """Test listing projects."""
    # Create a project first
    await client.post(
        "/api/v1/projects",
        json={"name": "Project 1", "task_type": "classification"},
    )

    response = await client.get("/api/v1/projects")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_project(client: AsyncClient):
    """Test getting a project by ID."""
    # Create a project first
    create_response = await client.post(
        "/api/v1/projects",
        json={"name": "Test Project", "task_type": "classification"},
    )
    project_id = create_response.json()["id"]

    response = await client.get(f"/api/v1/projects/{project_id}")
    assert response.status_code == 200
    assert response.json()["id"] == project_id


@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient):
    """Test getting a non-existent project."""
    response = await client.get("/api/v1/projects/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_project(client: AsyncClient):
    """Test updating a project."""
    # Create a project first
    create_response = await client.post(
        "/api/v1/projects",
        json={"name": "Original Name", "task_type": "classification"},
    )
    project_id = create_response.json()["id"]

    response = await client.put(
        f"/api/v1/projects/{project_id}",
        json={"name": "Updated Name"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_project(client: AsyncClient):
    """Test deleting a project."""
    # Create a project first
    create_response = await client.post(
        "/api/v1/projects",
        json={"name": "To Delete", "task_type": "classification"},
    )
    project_id = create_response.json()["id"]

    response = await client.delete(f"/api/v1/projects/{project_id}")
    assert response.status_code == 204

    # Verify it's deleted
    get_response = await client.get(f"/api/v1/projects/{project_id}")
    assert get_response.status_code == 404

