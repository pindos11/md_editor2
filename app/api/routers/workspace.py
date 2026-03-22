from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.api.deps import get_workspace
from app.api.errors import (
    missing_document,
    missing_path,
    missing_source_path,
    workspace_bad_request,
)
from app.models import CreateNodeRequest, DeleteNodeRequest, FolderTemplate, MoveNodeRequest, SaveDocumentRequest, UiState
from app.services.workspace import WorkspaceError, WorkspaceManager


router = APIRouter()


@router.get("/api/tree")
async def tree(workspace: WorkspaceManager = Depends(get_workspace)) -> list[dict]:
    return [node.model_dump() for node in workspace.build_tree()]


@router.get("/api/document")
async def get_document(path: str = Query(...), workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    try:
        return workspace.get_document(path).model_dump()
    except FileNotFoundError:
        raise missing_document()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.put("/api/document")
async def save_document(payload: SaveDocumentRequest, workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    try:
        return (await workspace.save_document(payload.path, payload.content)).model_dump()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.post("/api/document", status_code=201)
async def create_document(payload: CreateNodeRequest, workspace: WorkspaceManager = Depends(get_workspace)) -> dict[str, str]:
    try:
        await workspace.create_node(payload.path, payload.node_type)
        return {"status": "created"}
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.patch("/api/document")
async def move_document(payload: MoveNodeRequest, workspace: WorkspaceManager = Depends(get_workspace)) -> dict[str, str]:
    try:
        await workspace.move_node(payload.source_path, payload.destination_path)
        return {"status": "moved"}
    except FileNotFoundError:
        raise missing_source_path()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.delete("/api/document")
async def delete_document(payload: DeleteNodeRequest, workspace: WorkspaceManager = Depends(get_workspace)) -> dict[str, str]:
    try:
        await workspace.delete_node(payload.path)
        return {"status": "deleted"}
    except FileNotFoundError:
        raise missing_path()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.get("/api/search")
async def search_notes(query: str = Query(""), workspace: WorkspaceManager = Depends(get_workspace)) -> list[dict]:
    return [result.model_dump() for result in workspace.search_notes(query)]


@router.get("/api/backlinks")
async def backlinks(path: str = Query(...), workspace: WorkspaceManager = Depends(get_workspace)) -> list[dict]:
    try:
        return [item.model_dump() for item in workspace.get_backlinks(path)]
    except FileNotFoundError:
        raise missing_document()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.get("/api/ui-state")
async def get_ui_state(workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    try:
        return workspace.load_ui_state().model_dump()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.put("/api/ui-state")
async def update_ui_state(payload: UiState, workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    try:
        return (await workspace.save_ui_state(payload)).model_dump()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.get("/api/template")
async def get_folder_template(path: str = Query(""), workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    try:
        return workspace.load_folder_template(path).model_dump()
    except FileNotFoundError:
        raise missing_path()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.put("/api/template")
async def update_folder_template(
    path: str = Query(""),
    payload: FolderTemplate | None = None,
    workspace: WorkspaceManager = Depends(get_workspace),
) -> dict:
    try:
        return (await workspace.save_folder_template(path, payload or FolderTemplate(folder_path=path, content=""))).model_dump()
    except FileNotFoundError:
        raise missing_path()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)


@router.post("/api/attachment", status_code=201)
async def upload_attachment(
    note_path: str = Form(...),
    file: UploadFile = File(...),
    workspace: WorkspaceManager = Depends(get_workspace),
) -> dict:
    try:
        content = await file.read()
        return (await workspace.save_attachment(note_path, file.filename or "attachment", content)).model_dump()
    except FileNotFoundError:
        raise missing_document()
    except WorkspaceError as exc:
        raise workspace_bad_request(exc)
