from __future__ import annotations

import httpx
from fastapi import HTTPException

from app.services.workspace import WorkspaceError


def workspace_bad_request(exc: WorkspaceError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


def missing_document() -> HTTPException:
    return HTTPException(status_code=404, detail="Document not found.")


def missing_folder() -> HTTPException:
    return HTTPException(status_code=404, detail="Folder not found.")


def missing_source_path() -> HTTPException:
    return HTTPException(status_code=404, detail="Source path not found.")


def missing_path() -> HTTPException:
    return HTTPException(status_code=404, detail="Path not found.")


def ollama_unavailable(exc: httpx.HTTPError) -> HTTPException:
    return HTTPException(status_code=503, detail=f"Ollama is unavailable: {exc}")


def ollama_prompt_failed(exc: httpx.HTTPError) -> HTTPException:
    return HTTPException(status_code=503, detail=f"Ollama prompt failed: {exc}")
