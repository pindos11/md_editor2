# Local-First Markdown Workspace MVP

## Summary
Single-user, offline-first markdown workspace with a Python backend, bundled React frontend, local folder tree, autosaving markdown editor/preview, and minimal Ollama connectivity.

## Implementation Notes
- FastAPI serves the JSON API and static frontend bundle.
- Backend internals are organized around an app factory plus domain routers for workspace, database, health/static, and Ollama.
- Frontend internals are organized around a smaller app shell, reusable hooks, and focused workspace components.
- `--root` points at the managed workspace; `.mdeditor/` is initialized there for internal config.
- Only folders and `.md` files are managed in MVP.
- Ollama support includes settings persistence, health check, and a minimal prompt action.

## Acceptance Criteria
- App starts locally with `python -m app --root <folder>`.
- Tree, CRUD, edit, save, and preview flows work without internet access.
- Frontend assets are locally bundled and served by the backend.
- Docs live in `docs/`.
