"""Built-in parser templates for common formats."""

# COCO JSON format template
TEMPLATE_COCO = {
    "name": "builtin_coco",
    "description": "COCO JSON format (Microsoft Common Objects in Context)",
    "input_type": "json",
    "record_path": "images",
    "mapping": {
        "image_key": "file_name",
        "annotations_path": "join('', [\"@\", to_string(id)])",  # Placeholder, need cross-array lookup
        "annotation": {
            "label": "category_id",  # Need category mapping
            "score": null,
            "bbox": {
                "path": "bbox",
                "format": "xywh",
                "normalized": False
            },
            "polygon": {
                "path": "segmentation[0]",
                "format": "flat"
            }
        }
    },
    "validation": {
        "required_fields": ["file_name", "id"],
    }
}

# YOLO format template (TXT files)
TEMPLATE_YOLO = {
    "name": "builtin_yolo",
    "description": "YOLO TXT format (class x_center y_center width height, normalized)",
    "input_type": "jsonl",  # Each line: {filename, annotations: [[class, x, y, w, h]]}
    "mapping": {
        "image_key": "filename",
        "annotations_path": "annotations",
        "annotation": {
            "label": "[0]",  # First element is class ID
            "score": null,
            "bbox": {
                "path": "[1:5]",  # Elements 1-4 are coords
                "format": "cxcywh",
                "normalized": True
            }
        }
    }
}

# Pascal VOC XML format (simplified)
TEMPLATE_VOC = {
    "name": "builtin_voc",
    "description": "Pascal VOC XML format",
    "input_type": "jsonl",  # Pre-converted XML to JSON
    "mapping": {
        "image_key": "annotation.filename",
        "annotations_path": "annotation.object",
        "annotation": {
            "label": "name",
            "score": null,
            "bbox": {
                "path": "bndbox",  # {xmin, ymin, xmax, ymax}
                "format": "xyxy",
                "normalized": False
            }
        }
    }
}

# Generic detection format (flexible)
TEMPLATE_GENERIC_DETECTION = {
    "name": "generic_detection",
    "description": "Generic detection format (image + bboxes array)",
    "input_type": "jsonl",
    "mapping": {
        "image_key": "image",
        "annotations_path": "boxes",
        "annotation": {
            "label": "class",
            "score": "confidence",
            "bbox": {
                "path": "bbox",
                "format": "xyxy",
                "normalized": False
            }
        }
    },
    "validation": {
        "required_fields": ["image", "boxes"],
        "score_range": [0.0, 1.0]
    }
}

BUILTIN_TEMPLATES = [
    TEMPLATE_COCO,
    TEMPLATE_YOLO,
    TEMPLATE_VOC,
    TEMPLATE_GENERIC_DETECTION,
]

