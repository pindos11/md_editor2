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

## Rebuild Frontend
Only needed after frontend source changes:
1. Install frontend dependencies with `cmd /c npm install`.
2. Build with `cmd /c npm run build`.
3. Distribute the refreshed `app/static/` bundle with the backend.

## Notes
- The app is single-user and local-first.
- Runtime operation does not require internet access except optional local Ollama connectivity.
- Workspace-specific settings are stored inside the chosen root under `.mdeditor/`.
