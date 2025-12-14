"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "LabelHub"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./labelhub.db",
        description="Database connection URL",
    )

    # CORS
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        description="Comma-separated list of allowed origins",
    )

    # Media storage
    media_root: str = Field(
        default="/data/images",
        description="Root directory for source images (server path import)",
    )
    thumb_root: str = Field(
        default="./thumbs",
        description="Directory to store generated thumbnails",
    )
    thumb_size: int = Field(default=256, description="Thumbnail size in pixels")

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: Literal["debug", "info", "warning", "error"] = "info"

    # JWT Authentication (M4)
    jwt_secret_key: str = Field(
        default="your-secret-key-change-in-production-min-32-chars",
        description="JWT secret key for token signing (MUST change in production!)",
    )
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    access_token_expire_minutes: int = Field(
        default=15, description="Access token expiration time in minutes"
    )
    refresh_token_expire_days: int = Field(
        default=7, description="Refresh token expiration time in days"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

