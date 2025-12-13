"""Export API endpoints."""

from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.item import ItemStatus
from app.services.export import ExportService

router = APIRouter()
settings = get_settings()


class ExportRequest(BaseModel):
    """Export request parameters."""
    format: str  # coco, yolo, voc
    include_images: bool = False
    status_filter: Optional[List[str]] = None  # done, in_progress, etc.


@router.post("/datasets/{dataset_id}/export")
async def export_dataset(
    dataset_id: int,
    format: str = Query(..., regex="^(coco|yolo|voc)$"),
    include_images: bool = Query(False),
    status: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Export dataset annotations in specified format.
    
    Args:
        dataset_id: Dataset ID
        format: Export format (coco, yolo, voc)
        include_images: Include image files in export
        status: Filter by status (default: done only)
    
    Returns:
        ZIP file download
    """
    # Parse status filter
    status_filter = None
    if status:
        try:
            status_filter = [ItemStatus(s) for s in status]
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid status: {e}")
    
    # Create export directory if not exists
    export_dir = Path(settings.media_root).parent / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    
    # Export based on format
    export_service = ExportService()
    
    try:
        if format == "coco":
            zip_path = await export_service.export_coco(
                db, dataset_id, export_dir, include_images, status_filter
            )
        elif format == "yolo":
            zip_path = await export_service.export_yolo(
                db, dataset_id, export_dir, include_images, status_filter
            )
        elif format == "voc":
            zip_path = await export_service.export_voc(
                db, dataset_id, export_dir, include_images, status_filter
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
        
        # Return file for download
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=zip_path.name,
            headers={
                "Content-Disposition": f'attachment; filename="{zip_path.name}"'
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

