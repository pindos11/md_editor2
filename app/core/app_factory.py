from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers import (
    create_frontend_router,
    database_router,
    health_router,
    ollama_router,
    workspace_router,
)
from app.services.ollama import OllamaService
from app.services.workspace import WorkspaceManager


def create_app(root: str | Path) -> FastAPI:
    workspace = WorkspaceManager(Path(root))
    workspace.initialize()
    ollama = OllamaService()

    app = FastAPI(title="Local Markdown Workspace", version="0.2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    static_dir = Path(__file__).resolve().parent.parent / "static"
    assets_dir = static_dir / "assets"
    attachments_dir = workspace.attachments_dir

    app.state.workspace = workspace
    app.state.ollama = ollama
    app.state.static_dir = static_dir

    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    if attachments_dir.exists():
        app.mount("/workspace-assets", StaticFiles(directory=attachments_dir), name="workspace-assets")

    app.include_router(health_router)
    app.include_router(workspace_router)
    app.include_router(database_router)
    app.include_router(ollama_router)
    app.include_router(create_frontend_router(static_dir))
    return app
