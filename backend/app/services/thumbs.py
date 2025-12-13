"""Thumbnail generation service."""

import hashlib
from pathlib import Path

from PIL import Image

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class ThumbnailService:
    """Service for generating and serving thumbnails."""

    def __init__(self):
        self.thumb_root = Path(settings.thumb_root)
        self.thumb_size = settings.thumb_size
        self.thumb_root.mkdir(parents=True, exist_ok=True)

    def get_thumb_path(self, image_path: str, size: int | None = None) -> Path:
        """
        Get the path to the thumbnail file.

        Args:
            image_path: Full path to the original image
            size: Thumbnail size (default from settings)

        Returns:
            Path to the thumbnail file
        """
        size = size or self.thumb_size
        # Create a hash-based filename to avoid path issues
        path_hash = hashlib.md5(image_path.encode()).hexdigest()
        return self.thumb_root / f"{path_hash}_{size}.webp"

    def generate_thumbnail(
        self,
        image_path: str | Path,
        size: int | None = None,
        force: bool = False,
    ) -> Path | None:
        """
        Generate a thumbnail for an image.

        Args:
            image_path: Path to the original image
            size: Target size (square)
            force: Regenerate even if exists

        Returns:
            Path to generated thumbnail, or None on error
        """
        image_path = Path(image_path)
        size = size or self.thumb_size
        thumb_path = self.get_thumb_path(str(image_path), size)

        # Check if already exists
        if thumb_path.exists() and not force:
            return thumb_path

        try:
            with Image.open(image_path) as img:
                # Convert to RGB if necessary (for PNG with alpha, etc.)
                if img.mode in ("RGBA", "LA", "P"):
                    # Create white background
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                # Calculate resize dimensions maintaining aspect ratio
                img.thumbnail((size, size), Image.Resampling.LANCZOS)

                # Save as WebP
                img.save(thumb_path, "WebP", quality=85)
                logger.debug(f"Generated thumbnail: {thumb_path}")
                return thumb_path

        except Exception as e:
            logger.error(f"Failed to generate thumbnail for {image_path}: {e}")
            return None

    def ensure_thumbnail(self, image_path: str | Path, size: int | None = None) -> Path | None:
        """
        Ensure a thumbnail exists, generating if necessary.

        Args:
            image_path: Path to the original image
            size: Target size

        Returns:
            Path to thumbnail
        """
        thumb_path = self.get_thumb_path(str(image_path), size)
        if thumb_path.exists():
            return thumb_path
        return self.generate_thumbnail(image_path, size)

