"""API v1 routers."""

from fastapi import APIRouter

from app.api.v1 import annotations, datasets, health, items, labels, projects

router = APIRouter(prefix="/api/v1")

router.include_router(health.router, tags=["Health"])
router.include_router(projects.router, prefix="/projects", tags=["Projects"])
router.include_router(datasets.router, tags=["Datasets"])
router.include_router(items.router, tags=["Items"])
router.include_router(labels.router, tags=["Labels"])
router.include_router(annotations.router, tags=["Annotations"])

