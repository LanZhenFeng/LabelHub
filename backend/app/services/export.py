"""Data export service for annotations."""

import json
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from xml.etree.ElementTree import Element, SubElement, ElementTree, tostring
from xml.dom import minidom

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.annotation import BBoxAnnotation, PolygonAnnotation, ClassificationAnnotation
from app.models.dataset import Dataset
from app.models.item import Item, ItemStatus
from app.models.project import Project


class ExportService:
    """Service for exporting annotations in various formats."""

    async def export_coco(
        self,
        db: AsyncSession,
        dataset_id: int,
        output_path: Path,
        include_images: bool = False,
        status_filter: Optional[List[ItemStatus]] = None,
    ) -> Path:
        """
        Export annotations in COCO JSON format.
        
        Args:
            db: Database session
            dataset_id: Dataset ID to export
            output_path: Output directory path
            include_images: Whether to include image files in ZIP
            status_filter: Filter items by status (default: done)
            
        Returns:
            Path to generated ZIP file
        """
        # Default to only export 'done' items
        if status_filter is None:
            status_filter = [ItemStatus.DONE]

        # Fetch dataset with project and labels
        query = (
            select(Dataset)
            .options(selectinload(Dataset.project).selectinload(Project.labels))
            .where(Dataset.id == dataset_id)
        )
        result = await db.execute(query)
        dataset = result.scalar_one()
        project = dataset.project

        # Fetch items with annotations
        items_query = (
            select(Item)
            .options(
                selectinload(Item.bbox_annotations),
                selectinload(Item.polygon_annotations),
                selectinload(Item.classifications),
            )
            .where(Item.dataset_id == dataset_id)
            .where(Item.status.in_(status_filter))
        )
        result = await db.execute(items_query)
        items = result.scalars().all()

        # Build COCO JSON structure
        coco = {
            "info": {
                "description": f"{project.name} - {dataset.name}",
                "date_created": datetime.now().isoformat(),
                "year": datetime.now().year,
            },
            "images": [],
            "annotations": [],
            "categories": [],
        }

        # Add categories (labels)
        label_id_map = {}
        for idx, label in enumerate(project.labels, 1):
            label_id_map[label.id] = idx
            coco["categories"].append({
                "id": idx,
                "name": label.name,
                "supercategory": "object",
            })

        # Add images and annotations
        annotation_id = 1
        for image_id, item in enumerate(items, 1):
            # Add image
            full_path = Path(dataset.root_path) / item.rel_path
            coco["images"].append({
                "id": image_id,
                "file_name": item.filename,
                "width": item.width or 0,  # TODO: Store image dimensions
                "height": item.height or 0,
            })

            # Add bbox annotations
            for bbox in item.bbox_annotations:
                coco["annotations"].append({
                    "id": annotation_id,
                    "image_id": image_id,
                    "category_id": label_id_map[bbox.label_id],
                    "bbox": [bbox.x, bbox.y, bbox.width, bbox.height],
                    "area": bbox.width * bbox.height,
                    "iscrowd": 0,
                })
                annotation_id += 1

            # Add polygon annotations (segmentation)
            for polygon in item.polygon_annotations:
                # Flatten points: [[x1,y1],[x2,y2]] -> [x1,y1,x2,y2]
                segmentation = [coord for point in polygon.points for coord in point]
                
                # Calculate bbox from polygon
                xs = [p[0] for p in polygon.points]
                ys = [p[1] for p in polygon.points]
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)
                
                coco["annotations"].append({
                    "id": annotation_id,
                    "image_id": image_id,
                    "category_id": label_id_map[polygon.label_id],
                    "segmentation": [segmentation],
                    "bbox": [x_min, y_min, x_max - x_min, y_max - y_min],
                    "area": (x_max - x_min) * (y_max - y_min),
                    "iscrowd": 0,
                })
                annotation_id += 1

        # Create output ZIP
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_path = output_path / f"{dataset.name}_coco_{timestamp}.zip"
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Write annotations JSON
            zipf.writestr(
                "annotations.json",
                json.dumps(coco, indent=2, ensure_ascii=False)
            )
            
            # Optionally include images
            if include_images:
                for item in items:
                    full_path = Path(dataset.root_path) / item.rel_path
                    if full_path.exists():
                        zipf.write(full_path, f"images/{item.filename}")

        return zip_path

    async def export_yolo(
        self,
        db: AsyncSession,
        dataset_id: int,
        output_path: Path,
        include_images: bool = False,
        status_filter: Optional[List[ItemStatus]] = None,
    ) -> Path:
        """
        Export annotations in YOLO TXT format.
        
        Format: <class_id> <x_center> <y_center> <width> <height> (normalized 0-1)
        """
        if status_filter is None:
            status_filter = [ItemStatus.DONE]

        # Fetch dataset and items
        query = (
            select(Dataset)
            .options(selectinload(Dataset.project).selectinload(Project.labels))
            .where(Dataset.id == dataset_id)
        )
        result = await db.execute(query)
        dataset = result.scalar_one()
        project = dataset.project

        items_query = (
            select(Item)
            .options(selectinload(Item.bbox_annotations))
            .where(Item.dataset_id == dataset_id)
            .where(Item.status.in_(status_filter))
        )
        result = await db.execute(items_query)
        items = result.scalars().all()

        # Create label map
        label_id_map = {label.id: idx for idx, label in enumerate(project.labels)}
        
        # Create output ZIP
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_path = output_path / f"{dataset.name}_yolo_{timestamp}.zip"
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Write classes.txt
            classes_content = "\n".join([label.name for label in project.labels])
            zipf.writestr("classes.txt", classes_content)
            
            # Write labels for each image
            for item in items:
                if not item.bbox_annotations:
                    continue
                
                # YOLO format requires image dimensions
                img_width = item.width or 1920  # TODO: Get actual dimensions
                img_height = item.height or 1080
                
                lines = []
                for bbox in item.bbox_annotations:
                    class_id = label_id_map[bbox.label_id]
                    # Convert to YOLO format (normalized center coordinates)
                    x_center = (bbox.x + bbox.width / 2) / img_width
                    y_center = (bbox.y + bbox.height / 2) / img_height
                    width = bbox.width / img_width
                    height = bbox.height / img_height
                    
                    lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}")
                
                # Write label file
                label_filename = Path(item.filename).stem + ".txt"
                zipf.writestr(f"labels/{label_filename}", "\n".join(lines))
                
                # Optionally include image
                if include_images:
                    full_path = Path(dataset.root_path) / item.rel_path
                    if full_path.exists():
                        zipf.write(full_path, f"images/{item.filename}")

        return zip_path

    async def export_voc(
        self,
        db: AsyncSession,
        dataset_id: int,
        output_path: Path,
        include_images: bool = False,
        status_filter: Optional[List[ItemStatus]] = None,
    ) -> Path:
        """
        Export annotations in Pascal VOC XML format.
        """
        if status_filter is None:
            status_filter = [ItemStatus.DONE]

        # Fetch dataset and items
        query = (
            select(Dataset)
            .options(selectinload(Dataset.project).selectinload(Project.labels))
            .where(Dataset.id == dataset_id)
        )
        result = await db.execute(query)
        dataset = result.scalar_one()
        project = dataset.project

        items_query = (
            select(Item)
            .options(selectinload(Item.bbox_annotations))
            .where(Item.dataset_id == dataset_id)
            .where(Item.status.in_(status_filter))
        )
        result = await db.execute(items_query)
        items = result.scalars().all()
        
        # Create label map for quick lookup
        label_map = {label.id: label.name for label in project.labels}

        # Create output ZIP
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_path = output_path / f"{dataset.name}_voc_{timestamp}.zip"
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for item in items:
                if not item.bbox_annotations:
                    continue
                
                # Create XML annotation
                annotation = Element('annotation')
                
                # Folder
                folder = SubElement(annotation, 'folder')
                folder.text = dataset.name
                
                # Filename
                filename = SubElement(annotation, 'filename')
                filename.text = item.filename
                
                # Size
                size = SubElement(annotation, 'size')
                width = SubElement(size, 'width')
                width.text = str(item.width or 1920)
                height = SubElement(size, 'height')
                height.text = str(item.height or 1080)
                depth = SubElement(size, 'depth')
                depth.text = '3'
                
                # Objects
                for bbox in item.bbox_annotations:
                    obj = SubElement(annotation, 'object')
                    
                    name = SubElement(obj, 'name')
                    # Use label map to get label name
                    name.text = label_map.get(bbox.label_id, 'unknown')
                    
                    bndbox = SubElement(obj, 'bndbox')
                    xmin = SubElement(bndbox, 'xmin')
                    xmin.text = str(int(bbox.x))
                    ymin = SubElement(bndbox, 'ymin')
                    ymin.text = str(int(bbox.y))
                    xmax = SubElement(bndbox, 'xmax')
                    xmax.text = str(int(bbox.x + bbox.width))
                    ymax = SubElement(bndbox, 'ymax')
                    ymax.text = str(int(bbox.y + bbox.height))
                
                # Format XML nicely
                xml_str = minidom.parseString(
                    tostring(annotation, encoding='unicode')
                ).toprettyxml(indent="  ")
                
                # Write XML file
                xml_filename = Path(item.filename).stem + ".xml"
                zipf.writestr(f"Annotations/{xml_filename}", xml_str)
                
                # Optionally include image
                if include_images:
                    full_path = Path(dataset.root_path) / item.rel_path
                    if full_path.exists():
                        zipf.write(full_path, f"JPEGImages/{item.filename}")

        return zip_path

