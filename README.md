# Local-First Markdown Workspace

Single-user, offline-first markdown workspace with:
- folder tree
- markdown editor + preview
- backlinks and wiki-links
- folder database / board views from frontmatter
- local attachments
- folder templates
- optional local Ollama integration

The app is served by a Python backend and uses a bundled frontend. Runtime use does not require internet access, and end users do not need Node.js if the frontend has already been built.

## Runtime Requirements

End users need:
- Python 3.11+
- the project files, including [app/static](app/static)

Developers also need:
- Node.js
- npm

## Quick Start

1. Create a virtual environment.
2. Install backend dependencies.
3. Start the app with a workspace root.

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app --root .\workspace
```

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app --root ./workspace
```

Then open `http://127.0.0.1:8000`.

## Frontend Development

If you change frontend source, rebuild the bundled static assets:

```bash
npm install
npm run build
```

The built frontend is written into [app/static](app/static) and served by Python.

## Project Layout

- [app](app): Python backend, API, static serving
- [frontend](frontend): React source
- [app/static](app/static): built offline frontend bundle
- [tests](tests): backend tests
- [docs](docs): plan, manual, API, deployment notes

## Main Features

- Local workspace rooted at `--root`
- Markdown files as source of truth
- `.mdeditor/` metadata under the workspace root
- `_attachments/` for uploaded note files
- frontmatter-backed table and board views
- folder-level note templates
- preview rendering for:
  - markdown
  - wiki-links
  - Mermaid blocks
  - syntax-highlighted fenced code blocks

## Testing

Backend:

Windows PowerShell:

```powershell
.\.venv\Scripts\python -m pytest
```

macOS / Linux:

```bash
.venv/bin/python -m pytest
```

Frontend:

```bash
npm run test
```

## Documentation

- [docs/MANUAL.md](docs/MANUAL.md)
- [docs/API.md](docs/API.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/PLAN.md](docs/PLAN.md)
