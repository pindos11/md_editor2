from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends

from app.api.deps import get_ollama_service, get_workspace
from app.api.errors import ollama_prompt_failed, ollama_unavailable
from app.models import OllamaPromptRequest, OllamaSettings
from app.services.ollama import OllamaService
from app.services.workspace import WorkspaceManager


router = APIRouter()


@router.get("/api/ollama/settings")
async def get_ollama_settings(workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    return workspace.load_settings().model_dump()


@router.put("/api/ollama/settings")
async def update_ollama_settings(settings: OllamaSettings, workspace: WorkspaceManager = Depends(get_workspace)) -> dict:
    return (await workspace.save_settings(settings)).model_dump()


@router.get("/api/ollama/health")
async def ollama_health(
    workspace: WorkspaceManager = Depends(get_workspace),
    ollama: OllamaService = Depends(get_ollama_service),
) -> dict[str, object]:
    settings = workspace.load_settings()
    try:
        ok = await ollama.health(settings)
        return {"status": "ok" if ok else "unavailable", "base_url": settings.base_url, "model": settings.model}
    except httpx.HTTPError as exc:
        raise ollama_unavailable(exc)


@router.post("/api/ollama/prompt")
async def ollama_prompt(
    payload: OllamaPromptRequest,
    workspace: WorkspaceManager = Depends(get_workspace),
    ollama: OllamaService = Depends(get_ollama_service),
) -> dict:
    settings = workspace.load_settings()
    try:
        return (await ollama.prompt(settings, payload.prompt)).model_dump()
    except httpx.HTTPError as exc:
        raise ollama_prompt_failed(exc)
