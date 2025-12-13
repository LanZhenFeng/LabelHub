"""API v1 routers."""

from fastapi import APIRouter

from app.api.v1 import (
    annotations,
    auth,
    datasets,
    export as export_router,
    health,
    items,
    labels,
    parser_templates,
    projects,
    stats,
    users,
)

router = APIRouter(prefix="/api/v1")

router.include_router(health.router, tags=["Health"])
router.include_router(auth.router, tags=["Authentication"])  # M4: 认证API（公开）
router.include_router(users.router, tags=["Users"])  # M4: 用户管理（管理员）
router.include_router(projects.router, prefix="/projects", tags=["Projects"])
router.include_router(datasets.router, tags=["Datasets"])
router.include_router(items.router, tags=["Items"])
router.include_router(labels.router, tags=["Labels"])
router.include_router(annotations.router, tags=["Annotations"])
router.include_router(export_router.router, tags=["Export"])
router.include_router(parser_templates.router, tags=["Parser Templates"])
router.include_router(stats.router, tags=["Statistics"])

