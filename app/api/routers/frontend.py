from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse


def create_frontend_router(static_dir: Path) -> APIRouter:
    router = APIRouter()

    @router.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        index_path = static_dir / "index.html"
        if not index_path.exists():
            raise HTTPException(status_code=500, detail="Frontend bundle is missing. Build the frontend first.")
        return FileResponse(index_path)

    return router
