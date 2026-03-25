# API

## Endpoints
- `GET /api/health`
- `GET /api/tree`
- `GET /api/document?path=...`
- `PUT /api/document`
- `POST /api/document`
- `PATCH /api/document`
- `DELETE /api/document`
- `GET /api/search?query=...`
- `GET /api/backlinks?path=...`
- `GET /api/ui-state`
- `PUT /api/ui-state`
- `GET /api/template?path=...`
- `PUT /api/template?path=...`
- `GET /api/templates?path=...`
- `PUT /api/templates?path=...`
- `GET /api/history?path=...`
- `POST /api/history/restore`
- `POST /api/attachment`
- `GET /api/database?path=...`
- `GET /api/database/view-settings?path=...`
- `PUT /api/database/view-settings?path=...`
- `GET /api/database/views?path=...`
- `PUT /api/database/views?path=...`
- `GET /api/ollama/settings`
- `PUT /api/ollama/settings`
- `GET /api/ollama/health`
- `POST /api/ollama/prompt`

## Payload Shapes
- `POST /api/document`: `{ "path": "notes/new-note.md", "node_type": "file" | "folder" }`
- `PUT /api/document`: `{ "path": "notes/new-note.md", "content": "# Title" }`
- `PATCH /api/document`: `{ "source_path": "old.md", "destination_path": "new.md" }`
- `DELETE /api/document`: `{ "path": "notes/new-note.md" }`
- `PUT /api/ui-state`: `{ "kind": "none" | "file" | "folder", "path": "notes/new-note.md" }`
- `PUT /api/template?path=projects`: `{ "content": "# {{title}}\n" }`
- `PUT /api/templates?path=projects`: `{ "folder_path": "projects", "templates": [{ "template_id": "meeting", "name": "Meeting", "content": "# Meeting\n", "is_default": false }] }`
- `POST /api/history/restore`: `{ "path": "notes/new-note.md", "snapshot_id": "abc123" }`
- `POST /api/attachment`: multipart form with `note_path` and uploaded `file`
- `PUT /api/database/view-settings?path=projects`: `{ "filter_text": "", "sort_by": "title", "sort_direction": "asc", "view_mode": "table" | "board", "status_options": ["backlog", "done"], "visible_columns": ["status", "owner"] }`
- `PUT /api/database/views?path=projects`: `{ "folder_path": "projects", "active_view_id": "default", "views": [{ "view_id": "default", "name": "Default", "settings": { ... } }] }`
- `PUT /api/ollama/settings`: `{ "base_url": "http://127.0.0.1:11434", "model": "llama3.2" }`
- `POST /api/ollama/prompt`: `{ "prompt": "Summarize this note..." }`

## Notes
- `GET /api/search` matches note names, relative paths, and markdown content.
- `GET /api/backlinks` returns notes that reference the target through wiki-links like `[[Alpha]]`.
- `GET /api/ui-state` returns the last open file or folder remembered for the current workspace root.
- `GET /api/template` returns the saved starter template for the requested folder path.
- `GET /api/templates` returns the named template collection for a folder and migrates older single-template data compatibly.
- `GET /api/history` returns recent saved snapshots for a markdown note.
- `POST /api/history/restore` restores a snapshot by id through the normal document save path.
- `POST /api/attachment` stores note-local files under the workspace `_attachments/` directory and returns a local `/workspace-assets/...` URL.
- `GET /api/database` lists markdown notes directly inside a folder and extracts simple YAML-style frontmatter fields.
- `GET /api/database/view-settings` returns saved folder view preferences, defaulting missing fields such as `view_mode` to `table`.
- `GET /api/database/views` returns the named saved views for a folder together with the active view id.
- `PUT /api/document` may normalize frontmatter on save by maintaining `title`, `created`, and `updated`.
- Document HTML renders wiki-links as `wikilink:` anchors so the frontend can open linked notes locally.
