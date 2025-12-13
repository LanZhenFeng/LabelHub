"""Image importer service for scanning server paths."""

import os
from fnmatch import fnmatch
from pathlib import Path

from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.dataset import Dataset
from app.models.item import Item, ItemStatus
from app.schemas.dataset import ScanError, ScanResponse

logger = get_logger(__name__)
settings = get_settings()

# Supported image extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"}


class ImporterService:
    """Service for importing images from server paths."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def scan_directory(
        self,
        dataset: Dataset,
        glob_pattern: str = "**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}",
        limit: int | None = None,
    ) -> ScanResponse:
        """
        Scan a directory and import images into the dataset.

        Args:
            dataset: Dataset to import into
            glob_pattern: Glob pattern for matching files
            limit: Maximum number of files to import

        Returns:
            ScanResponse with import statistics
        """
        root_path = Path(dataset.root_path)

        if not root_path.exists():
            logger.error(f"Root path does not exist: {root_path}")
            return ScanResponse(
                added_count=0,
                total_count=0,
                skipped_count=0,
                errors=[ScanError(path=str(root_path), error="Directory does not exist")],
            )

        if not root_path.is_dir():
            logger.error(f"Root path is not a directory: {root_path}")
            return ScanResponse(
                added_count=0,
                total_count=0,
                skipped_count=0,
                errors=[ScanError(path=str(root_path), error="Path is not a directory")],
            )

        # Get existing rel_paths to avoid duplicates
        existing_query = select(Item.rel_path).where(Item.dataset_id == dataset.id)
        result = await self.db.execute(existing_query)
        existing_paths = set(result.scalars().all())

        added_count = 0
        skipped_count = 0
        errors: list[ScanError] = []
        new_items: list[Item] = []

        # Convert glob pattern with braces to multiple patterns
        patterns = self._expand_glob_pattern(glob_pattern)

        # Scan directory
        try:
            for file_path in self._iter_files(root_path, patterns, limit):
                rel_path = str(file_path.relative_to(root_path))

                if rel_path in existing_paths:
                    skipped_count += 1
                    continue

                try:
                    # Try to get image dimensions
                    width, height, file_size = self._get_image_info(file_path)

                    item = Item(
                        dataset_id=dataset.id,
                        rel_path=rel_path,
                        filename=file_path.name,
                        width=width,
                        height=height,
                        file_size=file_size,
                        status=ItemStatus.TODO,
                    )
                    new_items.append(item)
                    added_count += 1

                    # Batch insert
                    if len(new_items) >= 100:
                        self.db.add_all(new_items)
                        await self.db.flush()
                        new_items = []

                except Exception as e:
                    errors.append(ScanError(path=rel_path, error=str(e)))
                    logger.warning(f"Error processing {rel_path}: {e}")

            # Insert remaining items
            if new_items:
                self.db.add_all(new_items)
                await self.db.flush()

        except PermissionError as e:
            errors.append(ScanError(path=str(root_path), error=f"Permission denied: {e}"))

        # Get total count
        total_query = select(Item.id).where(Item.dataset_id == dataset.id)
        result = await self.db.execute(total_query)
        total_count = len(result.all())

        logger.info(
            f"Scan completed: added={added_count}, skipped={skipped_count}, "
            f"total={total_count}, errors={len(errors)}"
        )

        return ScanResponse(
            added_count=added_count,
            total_count=total_count,
            skipped_count=skipped_count,
            errors=errors[:50],  # Limit error list
        )

    def _expand_glob_pattern(self, pattern: str) -> list[str]:
        """Expand glob pattern with braces into multiple patterns."""
        # Handle {ext1,ext2} syntax
        if "{" in pattern and "}" in pattern:
            start = pattern.index("{")
            end = pattern.index("}")
            prefix = pattern[:start]
            suffix = pattern[end + 1 :]
            extensions = pattern[start + 1 : end].split(",")
            return [f"{prefix}{ext}{suffix}" for ext in extensions]
        return [pattern]

    def _iter_files(
        self,
        root: Path,
        patterns: list[str],
        limit: int | None,
    ):
        """Iterate over files matching patterns."""
        count = 0
        for pattern in patterns:
            # Handle ** recursive patterns
            if "**" in pattern:
                for file_path in root.rglob(pattern.replace("**/", "")):
                    if file_path.is_file() and self._is_image(file_path):
                        yield file_path
                        count += 1
                        if limit and count >= limit:
                            return
            else:
                for file_path in root.glob(pattern):
                    if file_path.is_file() and self._is_image(file_path):
                        yield file_path
                        count += 1
                        if limit and count >= limit:
                            return

    def _is_image(self, path: Path) -> bool:
        """Check if file is a supported image."""
        return path.suffix.lower() in IMAGE_EXTENSIONS

    def _get_image_info(self, path: Path) -> tuple[int | None, int | None, int | None]:
        """Get image dimensions and file size."""
        file_size = path.stat().st_size

        try:
            with Image.open(path) as img:
                return img.width, img.height, file_size
        except Exception:
            # Return None for dimensions if we can't read the image
            return None, None, file_size

