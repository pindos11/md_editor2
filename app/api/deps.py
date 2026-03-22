from __future__ import annotations

from pathlib import Path

from fastapi import Request

from app.services.ollama import OllamaService
from app.services.workspace import WorkspaceManager


def get_workspace(request: Request) -> WorkspaceManager:
    return request.app.state.workspace


def get_ollama_service(request: Request) -> OllamaService:
    return request.app.state.ollama


def get_static_dir(request: Request) -> Path:
    return request.app.state.static_dir
