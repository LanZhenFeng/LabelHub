"""Parser service using JMESPath for flexible annotation import."""

import json
import time
from typing import Any, Dict, List, Optional, Tuple

import jmespath
from pydantic import ValidationError

from app.schemas.parser_template import Prediction, PredictionItem


class ParserError(Exception):
    """Parser-specific error."""
    pass


class ParserService:
    """
    Service for parsing annotations using JMESPath templates.
    
    Supports:
    - JSON (single file, array of records)
    - JSONL (streaming, one record per line)
    - JMESPath expressions for flexible mapping
    - Safety limits (timeout, nesting depth, size)
    """
    
    # Safety limits
    MAX_EXPRESSION_TIME_MS = 100  # Per record
    MAX_NESTING_DEPTH = 20
    MAX_RESULT_SIZE_MB = 10
    
    def __init__(self, template: Dict[str, Any]):
        """
        Initialize parser with a template.
        
        Args:
            template: Parser template dict with mapping configuration
        """
        self.template = template
        self.mapping = template.get("mapping", {})
        self.validation = template.get("validation", {})
        
        # Compile JMESPath expressions
        self._compile_expressions()
    
    def _compile_expressions(self):
        """Pre-compile JMESPath expressions for performance."""
        self.image_key_expr = jmespath.compile(self.mapping.get("image_key", ""))
        self.annotations_path_expr = jmespath.compile(self.mapping.get("annotations_path", ""))
        
        # Annotation mappings
        ann_mapping = self.mapping.get("annotation", {})
        self.label_expr = jmespath.compile(ann_mapping.get("label", ""))
        self.score_expr = jmespath.compile(ann_mapping.get("score", "")) if ann_mapping.get("score") else None
        
        # Bbox mapping
        bbox_cfg = ann_mapping.get("bbox", {})
        if bbox_cfg:
            self.bbox_path_expr = jmespath.compile(bbox_cfg.get("path", ""))
            self.bbox_format = bbox_cfg.get("format", "xyxy")
            self.bbox_normalized = bbox_cfg.get("normalized", False)
        else:
            self.bbox_path_expr = None
        
        # Polygon mapping
        polygon_cfg = ann_mapping.get("polygon", {})
        if polygon_cfg:
            self.polygon_path_expr = jmespath.compile(polygon_cfg.get("path", ""))
            self.polygon_format = polygon_cfg.get("format", "flat")
        else:
            self.polygon_path_expr = None
    
    def parse_json(self, data: str, record_path: Optional[str] = None) -> List[Prediction]:
        """
        Parse JSON string.
        
        Args:
            data: JSON string
            record_path: JMESPath to array of records (optional)
            
        Returns:
            List of Prediction objects
        """
        try:
            obj = json.loads(data)
        except json.JSONDecodeError as e:
            raise ParserError(f"Invalid JSON: {e}")
        
        # Extract records array if record_path is provided
        if record_path:
            record_path_expr = jmespath.compile(record_path)
            records = record_path_expr.search(obj)
            if not isinstance(records, list):
                raise ParserError(f"Record path '{record_path}' did not return an array")
        else:
            # Assume root is array or single record
            records = obj if isinstance(obj, list) else [obj]
        
        return self._parse_records(records)
    
    def parse_jsonl(self, data: str, max_records: Optional[int] = None) -> List[Prediction]:
        """
        Parse JSONL string (streaming).
        
        Args:
            data: JSONL string (one JSON object per line)
            max_records: Maximum records to parse (for testing)
            
        Returns:
            List of Prediction objects
        """
        records = []
        for line_num, line in enumerate(data.strip().split('\n'), 1):
            if max_records and len(records) >= max_records:
                break
            
            line = line.strip()
            if not line:
                continue
            
            try:
                record = json.loads(line)
                records.append(record)
            except json.JSONDecodeError as e:
                raise ParserError(f"Line {line_num}: Invalid JSON: {e}")
        
        return self._parse_records(records)
    
    def _parse_records(self, records: List[Dict[str, Any]]) -> List[Prediction]:
        """
        Parse a list of record dicts into Predictions.
        
        Args:
            records: List of record dictionaries
            
        Returns:
            List of Prediction objects
        """
        predictions = []
        errors = []
        
        for idx, record in enumerate(records):
            try:
                prediction = self._parse_single_record(record)
                if prediction:
                    predictions.append(prediction)
            except Exception as e:
                errors.append({"index": idx, "error": str(e)})
                # Continue parsing other records
        
        return predictions
    
    def _parse_single_record(self, record: Dict[str, Any]) -> Optional[Prediction]:
        """
        Parse a single record into a Prediction.
        
        Args:
            record: Single record dictionary
            
        Returns:
            Prediction object or None if parsing fails
        """
        # Extract image key
        start_time = time.time()
        image_key = self.image_key_expr.search(record)
        
        if not image_key:
            return None
        
        # Extract annotations array
        annotations = self.annotations_path_expr.search(record)
        if not annotations or not isinstance(annotations, list):
            return Prediction(image_key=str(image_key), predictions=[])
        
        # Parse each annotation
        prediction_items = []
        for ann in annotations:
            # Check timeout
            if (time.time() - start_time) * 1000 > self.MAX_EXPRESSION_TIME_MS:
                raise ParserError(f"Expression timeout exceeded ({self.MAX_EXPRESSION_TIME_MS}ms)")
            
            # Extract label
            label = self.label_expr.search(ann)
            if not label:
                continue
            
            # Extract score (optional)
            score = None
            if self.score_expr:
                score = self.score_expr.search(ann)
                if score is not None:
                    score = float(score)
            
            # Parse bbox if configured
            if self.bbox_path_expr:
                bbox_data = self.bbox_path_expr.search(ann)
                if bbox_data:
                    bbox = self._parse_bbox(bbox_data, self.bbox_format, self.bbox_normalized)
                    if bbox:
                        prediction_items.append(PredictionItem(
                            type="bbox",
                            label=str(label),
                            score=score,
                            data=bbox
                        ))
            
            # Parse polygon if configured
            if self.polygon_path_expr:
                polygon_data = self.polygon_path_expr.search(ann)
                if polygon_data:
                    polygon = self._parse_polygon(polygon_data, self.polygon_format)
                    if polygon:
                        prediction_items.append(PredictionItem(
                            type="polygon",
                            label=str(label),
                            score=score,
                            data=polygon
                        ))
        
        return Prediction(image_key=str(image_key), predictions=prediction_items)
    
    def _parse_bbox(self, data: Any, format: str, normalized: bool) -> Optional[Dict[str, float]]:
        """
        Parse bbox data based on format.
        
        Args:
            data: Bbox data (array or dict)
            format: xyxy, xywh, cxcywh
            normalized: Whether coordinates are normalized (0-1)
            
        Returns:
            Dict with x, y, width, height (absolute pixels)
        """
        if not isinstance(data, (list, tuple)) or len(data) < 4:
            return None
        
        coords = [float(c) for c in data[:4]]
        
        if format == "xyxy":
            x1, y1, x2, y2 = coords
            return {"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1}
        elif format == "xywh":
            x, y, w, h = coords
            return {"x": x, "y": y, "width": w, "height": h}
        elif format == "cxcywh":
            cx, cy, w, h = coords
            return {"x": cx - w/2, "y": cy - h/2, "width": w, "height": h}
        else:
            return None
    
    def _parse_polygon(self, data: Any, format: str) -> Optional[Dict[str, List]]:
        """
        Parse polygon data based on format.
        
        Args:
            data: Polygon data (array)
            format: flat [x1,y1,x2,y2,...] or nested [[x1,y1],[x2,y2],...]
            
        Returns:
            Dict with points [[x1,y1],[x2,y2],...]
        """
        if not isinstance(data, list):
            return None
        
        if format == "flat":
            # [x1, y1, x2, y2, ...] -> [[x1,y1], [x2,y2], ...]
            if len(data) < 6 or len(data) % 2 != 0:  # At least 3 points
                return None
            points = [[data[i], data[i+1]] for i in range(0, len(data), 2)]
        elif format == "nested":
            # [[x1,y1], [x2,y2], ...]
            if len(data) < 3:  # At least 3 points
                return None
            points = [[float(p[0]), float(p[1])] for p in data if len(p) >= 2]
        else:
            return None
        
        return {"points": points}

