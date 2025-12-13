"""HTTP caching utilities for media files."""

import hashlib
from pathlib import Path
from typing import Optional

from fastapi import Request
from fastapi.responses import FileResponse, Response


def calculate_etag(file_path: Path) -> str:
    """
    Calculate ETag for a file based on its modification time and size.
    Format: "mtime-size" (faster than full content hash)
    """
    stat = file_path.stat()
    etag_str = f"{stat.st_mtime}-{stat.st_size}"
    # Use MD5 hash for shorter ETag
    return hashlib.md5(etag_str.encode()).hexdigest()


def check_not_modified(request: Request, file_path: Path) -> Optional[Response]:
    """
    Check if file has not been modified (ETag or Last-Modified).
    Returns 304 response if not modified, None otherwise.
    """
    current_etag = calculate_etag(file_path)
    
    # Check If-None-Match header (ETag)
    if_none_match = request.headers.get("if-none-match")
    if if_none_match:
        # Remove W/ prefix if present (weak validator)
        if_none_match = if_none_match.strip('W/"')
        if if_none_match == current_etag:
            return Response(
                status_code=304,
                headers={
                    "ETag": f'"{current_etag}"',
                    "Cache-Control": "public, max-age=86400",
                },
            )
    
    return None


def add_cache_headers(
    response: FileResponse,
    file_path: Path,
    cache_control: str = "public, max-age=3600",
) -> FileResponse:
    """
    Add caching headers to FileResponse.
    
    Args:
        response: The FileResponse to modify
        file_path: Path to the file being served
        cache_control: Cache-Control header value
    
    Returns:
        The modified FileResponse
    """
    etag = calculate_etag(file_path)
    stat = file_path.stat()
    
    response.headers["ETag"] = f'"{etag}"'
    response.headers["Cache-Control"] = cache_control
    response.headers["Last-Modified"] = stat.st_mtime.__str__()
    
    return response


def check_precondition(request: Request, file_path: Path) -> Optional[Response]:
    """
    Check If-Match precondition for optimistic locking.
    Returns 412 response if precondition fails, None otherwise.
    
    Used for PUT/POST requests to ensure the client has the latest version.
    """
    if_match = request.headers.get("if-match")
    if not if_match:
        # No precondition specified
        return None
    
    current_etag = calculate_etag(file_path)
    if_match = if_match.strip('"')
    
    if if_match != "*" and if_match != current_etag:
        return Response(
            status_code=412,
            content="Precondition Failed: Resource has been modified",
            headers={
                "ETag": f'"{current_etag}"',
            },
        )
    
    return None

