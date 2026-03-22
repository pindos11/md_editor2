from .database import router as database_router
from .frontend import create_frontend_router
from .health import router as health_router
from .ollama import router as ollama_router
from .workspace import router as workspace_router

__all__ = [
    "database_router",
    "create_frontend_router",
    "health_router",
    "ollama_router",
    "workspace_router",
]
