from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_workspace
from app.api.errors import missing_folder, workspace_bad_request
from app.models import DatabaseViewCollection, DatabaseViewSettings
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


@router.get("/api/database/views")
async def get_database_views(path: str = Query(""), workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    try:
        return workspace.load_database_views(path).model_dump()
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


@router.put("/api/database/views")
async def update_database_views(
    path: str = Query(""),
    views: DatabaseViewCollection | None = None,
    workspace: WorkspaceManager = Depends(get_workspace),
) -> dict:
    try:
        collection = views or DatabaseViewCollection(folder_path=path or "")
        return (await workspace.save_database_views(path, collection)).model_dump()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)
