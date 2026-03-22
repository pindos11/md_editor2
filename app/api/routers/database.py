from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_workspace
from app.api.errors import missing_folder, workspace_bad_request
from app.models import DatabaseViewSettings
from app.services.workspace import WorkspaceError, WorkspaceManager


router = APIRouter()


@router.get("/api/database")
async def folder_database(path: str = Query(""), workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    try:
        return workspace.get_folder_database(path).model_dump()
    except FileNotFoundError:
        raise missing_folder()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.get("/api/database/view-settings")
async def get_database_view_settings(path: str = Query(""), workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    try:
        return workspace.load_database_view_settings(path).model_dump()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.put("/api/database/view-settings")
async def update_database_view_settings(
    path: str = Query(""),
    settings: DatabaseViewSettings | None = None,
    workspace: WorkspaceManager = Depends(get_workspace),
) -> dict:
    try:
        return (await workspace.save_database_view_settings(path, settings or DatabaseViewSettings())).model_dump()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)
