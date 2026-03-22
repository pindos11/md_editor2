# Deployment

## Runtime Package
For a Python-only runtime package, ship:
- `app/`
- `requirements.txt`
- `docs/`

The built frontend is already served from `app/static/`, so Node.js is not required on the target machine.

## Developer Package
If the recipient needs to modify the frontend and rebuild it, also ship:
- `frontend/`
- `package.json`
- `package-lock.json`
- `vite.config.js`

## Install and Run
1. Create and activate a Python virtual environment.
2. Install backend dependencies with `pip install -r requirements.txt`.
3. Start the app with `python -m app --root ./workspace`.
4. Open `http://127.0.0.1:8000`.

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

## Rebuild Frontend
Only needed after frontend source changes:
1. Install frontend dependencies with `npm install`.
2. Build with `npm run build`.
3. Distribute the refreshed `app/static/` bundle with the backend.

## Notes
- The app is single-user and local-first.
- Runtime operation does not require internet access except optional local Ollama connectivity.
- Workspace-specific settings are stored inside the chosen root under `.mdeditor/`.
- Windows, macOS, and Linux are supported; only virtual environment activation syntax differs.
