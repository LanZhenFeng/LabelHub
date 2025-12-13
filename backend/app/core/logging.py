"""Logging configuration."""

import logging
import sys
from typing import Literal

from app.core.config import get_settings


def setup_logging(
    level: Literal["debug", "info", "warning", "error"] | None = None,
) -> None:
    """Configure application logging."""
    settings = get_settings()
    log_level = (level or settings.log_level).upper()

    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Reduce noise from third-party libraries
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name."""
    return logging.getLogger(name)

