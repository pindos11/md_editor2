from pathlib import Path

import asyncio
import datetime
import httpx
import pytest
from fastapi.testclient import TestClient

from app.models import RestoreSnapshotRequest, UiState
from app.server import create_app
from app.services.ollama import OllamaService
from app.services.workspace import METADATA_DIR, WorkspaceError, WorkspaceManager


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    app = create_app(tmp_path)
    return TestClient(app)


def test_initializes_metadata(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    assert (tmp_path / METADATA_DIR).exists()
    assert (tmp_path / METADATA_DIR / "config.json").exists()


def test_rejects_root_escape(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    with pytest.raises(WorkspaceError):
        manager.resolve_path("../escape.md")


def test_rejects_metadata_access(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    with pytest.raises(WorkspaceError):
        manager.resolve_path(".mdeditor/config.json")


def test_tree_filters_non_markdown(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "keep.md").write_text("# keep", encoding="utf-8")
    (tmp_path / "skip.txt").write_text("skip", encoding="utf-8")
    response = client.get("/api/tree")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["path"] == "keep.md"


def test_document_crud_flow(client: TestClient) -> None:
    create_response = client.post("/api/document", json={"path": "notes/day.md", "node_type": "file"})
    assert create_response.status_code == 201

    save_response = client.put("/api/document", json={"path": "notes/day.md", "content": "# Updated"})
    assert save_response.status_code == 200
    assert save_response.json()["html"].startswith("<h1>")

    get_response = client.get("/api/document", params={"path": "notes/day.md"})
    assert get_response.status_code == 200
    assert get_response.json()["content"].endswith("# Updated")
    assert get_response.json()["frontmatter"]["title"] == "Updated"

    move_response = client.patch(
        "/api/document",
        json={"source_path": "notes/day.md", "destination_path": "notes/renamed.md"},
    )
    assert move_response.status_code == 200

    delete_response = client.request("DELETE", "/api/document", json={"path": "notes/renamed.md"})
    assert delete_response.status_code == 200


def test_move_document_rejects_existing_destination(client: TestClient) -> None:
    client.post("/api/document", json={"path": "notes/source.md", "node_type": "file"})
    client.post("/api/document", json={"path": "notes/existing.md", "node_type": "file"})

    move_response = client.patch(
        "/api/document",
        json={"source_path": "notes/source.md", "destination_path": "notes/existing.md"},
    )

    assert move_response.status_code == 400
    assert move_response.json()["detail"] == "Destination already exists."


def test_delete_folder_removes_nested_notes(client: TestClient, tmp_path: Path) -> None:
    client.post("/api/document", json={"path": "projects", "node_type": "folder"})
    client.post("/api/document", json={"path": "projects/nested.md", "node_type": "file"})

    delete_response = client.request("DELETE", "/api/document", json={"path": "projects"})

    assert delete_response.status_code == 200
    assert not (tmp_path / "projects").exists()


def test_search_and_backlinks(client: TestClient) -> None:
    client.post("/api/document", json={"path": "alpha.md", "node_type": "file"})
    client.put("/api/document", json={"path": "alpha.md", "content": "# Alpha\n\nReference note"})
    client.post("/api/document", json={"path": "beta.md", "node_type": "file"})
    client.put("/api/document", json={"path": "beta.md", "content": "See [[Alpha]] for context"})

    search_response = client.get("/api/search", params={"query": "alpha"})
    assert search_response.status_code == 200
    assert any(item["path"] == "alpha.md" for item in search_response.json())

    backlinks_response = client.get("/api/backlinks", params={"path": "alpha.md"})
    assert backlinks_response.status_code == 200
    assert backlinks_response.json()[0]["path"] == "beta.md"

    document_response = client.get("/api/document", params={"path": "beta.md"})
    assert 'href="wikilink:Alpha"' in document_response.json()["html"]


def test_folder_database_lists_frontmatter_columns(client: TestClient) -> None:
    client.post("/api/document", json={"path": "projects/roadmap.md", "node_type": "file"})
    client.put(
        "/api/document",
        json={
            "path": "projects/roadmap.md",
            "content": "---\nstatus: active\ntags:\n  - app\n  - ui\nowner: andrei\n---\n# Roadmap\n\nBody"
        },
    )
    client.post("/api/document", json={"path": "projects/notes.md", "node_type": "file"})
    client.put(
        "/api/document",
        json={
            "path": "projects/notes.md",
            "content": "---\ndue: 2026-03-25\n---\n# Notes"
        },
    )

    response = client.get("/api/database", params={"path": "projects"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["folder_path"] == "projects"
    assert payload["columns"][:3] == ["status", "tags", "due"]
    roadmap = next(note for note in payload["notes"] if note["path"] == "projects/roadmap.md")
    assert roadmap["frontmatter"]["status"] == "active"


def test_document_response_includes_frontmatter(client: TestClient) -> None:
    client.post("/api/document", json={"path": "meta.md", "node_type": "file"})
    client.put(
        "/api/document",
        json={
            "path": "meta.md",
            "content": "---\nstatus: draft\n---\n# Meta"
        },
    )
    response = client.get("/api/document", params={"path": "meta.md"})
    assert response.status_code == 200
    assert response.json()["frontmatter"]["status"] == "draft"
    assert "<hr" not in response.json()["html"]


def test_save_document_auto_adds_title_created_and_updated(client: TestClient) -> None:
    client.post("/api/document", json={"path": "meta.md", "node_type": "file"})

    save_response = client.put(
        "/api/document",
        json={"path": "meta.md", "content": "# Hello World\n\nBody"},
    )

    assert save_response.status_code == 200
    payload = save_response.json()
    assert payload["frontmatter"]["title"] == "Hello World"
    assert payload["frontmatter"]["created"]
    assert payload["frontmatter"]["updated"]
    assert payload["content"].startswith("---\n")


def test_save_document_preserves_explicit_updated_value(client: TestClient) -> None:
    client.post("/api/document", json={"path": "meta.md", "node_type": "file"})
    client.put("/api/document", json={"path": "meta.md", "content": "# Hello"})

    save_response = client.put(
        "/api/document",
        json={"path": "meta.md", "content": "---\nupdated: 2026-03-25T12:45\ntitle: Hello\ncreated: 2026-03-25T12:30\n---\n# Hello"},
    )

    assert save_response.status_code == 200
    payload = save_response.json()
    assert payload["frontmatter"]["updated"] == "2026-03-25T12:45"


def test_database_view_settings_round_trip(client: TestClient) -> None:
    save_response = client.put(
        "/api/database/view-settings",
        params={"path": "projects"},
        json={
            "filter_text": "road",
            "sort_by": "status",
            "sort_direction": "desc",
            "view_mode": "board",
            "status_options": ["queued", "doing", "done"],
            "visible_columns": ["owner", "due"],
        },
    )
    assert save_response.status_code == 200

    get_response = client.get("/api/database/view-settings", params={"path": "projects"})
    assert get_response.status_code == 200
    assert get_response.json()["sort_by"] == "status"
    assert get_response.json()["sort_direction"] == "desc"
    assert get_response.json()["view_mode"] == "board"
    assert get_response.json()["status_options"] == ["queued", "doing", "done"]
    assert get_response.json()["visible_columns"] == ["owner", "due"]


def test_database_views_round_trip_and_legacy_compatibility(client: TestClient, tmp_path: Path) -> None:
    response = client.put(
        "/api/database/views",
        params={"path": "projects"},
        json={
            "folder_path": "projects",
            "active_view_id": "delivery",
            "views": [
                {
                    "view_id": "planning",
                    "name": "Planning",
                    "settings": {"filter_text": "", "sort_by": "title", "sort_direction": "asc", "view_mode": "table", "status_options": ["backlog"], "visible_columns": ["status"]},
                },
                {
                    "view_id": "delivery",
                    "name": "Delivery",
                    "settings": {"filter_text": "road", "sort_by": "due", "sort_direction": "desc", "view_mode": "board", "status_options": ["doing", "done"], "visible_columns": ["due"]},
                },
            ],
        },
    )
    assert response.status_code == 200

    get_response = client.get("/api/database/views", params={"path": "projects"})
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["active_view_id"] == "delivery"
    assert len(payload["views"]) == 2

    active_settings = client.get("/api/database/view-settings", params={"path": "projects"}).json()
    assert active_settings["sort_by"] == "due"
    assert active_settings["view_mode"] == "board"


def test_database_view_settings_defaults_missing_fields(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    manager.db_views_path.write_text('{"projects": {"filter_text": "road"}}', encoding="utf-8")

    settings = manager.load_database_view_settings("projects")

    assert settings.filter_text == "road"
    assert settings.sort_by == "title"
    assert settings.sort_direction == "asc"
    assert settings.view_mode == "table"
    assert settings.status_options == ["backlog", "active", "in-progress", "paused", "done"]
    assert settings.visible_columns == []


def test_database_views_loads_legacy_single_view_payload(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    manager.db_views_path.write_text('{"projects": {"filter_text": "road"}}', encoding="utf-8")

    collection = manager.load_database_views("projects")

    assert collection.active_view_id == "default"
    assert len(collection.views) == 1
    assert collection.views[0].name == "Default"
    assert collection.views[0].settings.filter_text == "road"


def test_ui_state_round_trip_and_missing_target_defaults(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    (tmp_path / "notes").mkdir()
    (tmp_path / "notes" / "alpha.md").write_text("# Alpha", encoding="utf-8")

    asyncio.run(manager.save_ui_state(UiState(kind="file", path="notes/alpha.md")))
    state = manager.load_ui_state()
    assert state.kind == "file"
    assert state.path == "notes/alpha.md"

    (tmp_path / "notes" / "alpha.md").unlink()
    missing_state = manager.load_ui_state()
    assert missing_state.kind == "none"
    assert missing_state.path == ""


def test_folder_template_and_attachment_flow(client: TestClient, tmp_path: Path) -> None:
    client.post("/api/document", json={"path": "projects", "node_type": "folder"})

    template_response = client.put(
        "/api/template",
        params={"path": "projects"},
        json={"folder_path": "projects", "content": "# {{title}}\nCreated: {{date}}\n"},
    )
    assert template_response.status_code == 200
    assert template_response.json()["content"].startswith("# {{title}}")

    get_template_response = client.get("/api/template", params={"path": "projects"})
    assert get_template_response.status_code == 200
    assert get_template_response.json()["folder_path"] == "projects"

    client.post("/api/document", json={"path": "projects/roadmap.md", "node_type": "file"})
    upload_response = client.post(
        "/api/attachment",
        data={"note_path": "projects/roadmap.md"},
        files={"file": ("diagram.png", b"png-bytes", "image/png")},
    )
    assert upload_response.status_code == 201
    payload = upload_response.json()
    assert payload["path"].startswith("roadmap/")
    assert payload["url"].startswith("/workspace-assets/")
    assert (tmp_path / "_attachments").exists()


def test_template_collection_migrates_legacy_template_string(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    (tmp_path / "projects").mkdir()
    manager.templates_path.write_text('{"projects": "# Legacy template\\n"}', encoding="utf-8")

    collection = manager.load_template_collection("projects")

    assert collection.folder_path == "projects"
    assert len(collection.templates) == 1
    assert collection.templates[0].name == "Default"
    assert collection.templates[0].is_default is True
    assert collection.templates[0].content == "# Legacy template\n"


def test_template_collection_round_trip(client: TestClient) -> None:
    client.post("/api/document", json={"path": "projects", "node_type": "folder"})

    save_response = client.put(
        "/api/templates",
        params={"path": "projects"},
        json={
            "folder_path": "projects",
            "templates": [
                {"template_id": "blank", "name": "Blank", "content": "# {{title}}\n", "is_default": True},
                {"template_id": "meeting", "name": "Meeting", "content": "# Meeting\n", "is_default": False},
            ],
        },
    )
    assert save_response.status_code == 200

    get_response = client.get("/api/templates", params={"path": "projects"})
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["folder_path"] == "projects"
    assert len(payload["templates"]) == 2
    assert payload["templates"][0]["is_default"] is True


def test_note_history_snapshots_and_restore(client: TestClient) -> None:
    client.post("/api/document", json={"path": "notes/day.md", "node_type": "file"})
    first_save = client.put("/api/document", json={"path": "notes/day.md", "content": "# First"})
    assert first_save.status_code == 200
    manager = client.app.state.workspace
    original_timestamp = manager._current_timestamp
    timestamps = iter([
        "2026-03-26T10:00:00+02:00",
        "2026-03-26T10:00:00+02:00",
        "2026-03-26T10:03:30+02:00",
        "2026-03-26T10:03:30+02:00",
    ])
    manager._current_timestamp = lambda: next(timestamps)
    second_save = client.put("/api/document", json={"path": "notes/day.md", "content": "# Second"})
    manager._current_timestamp = original_timestamp
    assert second_save.status_code == 200

    history_response = client.get("/api/history", params={"path": "notes/day.md"})
    assert history_response.status_code == 200
    history = history_response.json()
    assert len(history["snapshots"]) >= 2
    older_snapshot = next(snapshot for snapshot in history["snapshots"] if "# First" in snapshot["content"])

    restore_response = client.post(
        "/api/history/restore",
        json={"path": "notes/day.md", "snapshot_id": older_snapshot["snapshot_id"]},
    )
    assert restore_response.status_code == 200
    assert "# First" in restore_response.json()["content"]


def test_note_history_coalesces_rapid_saves(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    asyncio.run(manager.create_node("notes/day.md", "file"))
    timestamps = iter([
        "2026-03-26T10:00:00+02:00",
        "2026-03-26T10:00:00+02:00",
        "2026-03-26T10:01:00+02:00",
        "2026-03-26T10:01:00+02:00",
    ])
    manager._current_timestamp = lambda: next(timestamps)

    asyncio.run(manager.save_document("notes/day.md", "# First"))
    asyncio.run(manager.save_document("notes/day.md", "# Second"))

    history = manager.get_note_history("notes/day.md")
    assert len(history.snapshots) == 1
    assert "# Second" in history.snapshots[0].content


def test_note_history_starts_new_snapshot_after_coalesce_window(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    asyncio.run(manager.create_node("notes/day.md", "file"))
    timestamps = iter([
        "2026-03-26T10:00:00+02:00",
        "2026-03-26T10:00:00+02:00",
        "2026-03-26T10:01:00+02:00",
        "2026-03-26T10:01:00+02:00",
        "2026-03-26T10:03:30+02:00",
        "2026-03-26T10:03:30+02:00",
    ])
    manager._current_timestamp = lambda: next(timestamps)

    asyncio.run(manager.save_document("notes/day.md", "# First"))
    asyncio.run(manager.save_document("notes/day.md", "# Second"))
    asyncio.run(manager.save_document("notes/day.md", "# Third"))

    history = manager.get_note_history("notes/day.md")
    assert len(history.snapshots) == 2
    assert "# Third" in history.snapshots[0].content
    assert "# Second" in history.snapshots[1].content


def test_snapshot_retention_limit(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    asyncio.run(manager.create_node("notes/day.md", "file"))
    base = datetime.datetime(2026, 3, 26, 10, 0, 0, tzinfo=datetime.timezone.utc)
    counter = {"value": 0}
    manager._current_timestamp = lambda: (base + datetime.timedelta(minutes=counter["value"] * 3)).isoformat(timespec="seconds")

    for index in range(25):
        counter["value"] = index
        asyncio.run(manager.save_document("notes/day.md", f"# Version {index}"))

    history = manager.get_note_history("notes/day.md")

    assert len(history.snapshots) == 20
    assert "# Version 24" in history.snapshots[0].content
    assert "# Version 5" in history.snapshots[-1].content


def test_restore_snapshot_creates_new_history_entry(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    manager.initialize()
    asyncio.run(manager.create_node("notes/day.md", "file"))
    timestamps = iter([
        "2026-03-26T10:00:00+02:00",
        "2026-03-26T10:00:00+02:00",
        "2026-03-26T10:03:30+02:00",
        "2026-03-26T10:03:30+02:00",
        "2026-03-26T10:04:00+02:00",
        "2026-03-26T10:04:00+02:00",
    ])
    manager._current_timestamp = lambda: next(timestamps)

    asyncio.run(manager.save_document("notes/day.md", "# First"))
    asyncio.run(manager.save_document("notes/day.md", "# Second"))
    original_history = manager.get_note_history("notes/day.md")
    older_snapshot = next(snapshot for snapshot in original_history.snapshots if "# First" in snapshot.content)

    restored = asyncio.run(manager.restore_snapshot(RestoreSnapshotRequest(path="notes/day.md", snapshot_id=older_snapshot.snapshot_id)))

    updated_history = manager.get_note_history("notes/day.md")
    assert "# First" in restored.content
    assert len(updated_history.snapshots) == 3
    assert "# First" in updated_history.snapshots[0].content
    assert "# Second" in updated_history.snapshots[1].content


def test_tree_hides_attachments_directory(client: TestClient, tmp_path: Path) -> None:
    attachments = tmp_path / "_attachments"
    attachments.mkdir(exist_ok=True)
    (attachments / "image.png").write_bytes(b"png")
    response = client.get("/api/tree")
    assert response.status_code == 200
    assert response.json() == []


def test_ollama_health_handles_unavailable_service(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_health(self, settings):
        request = httpx.Request("GET", f"{settings.base_url}/api/tags")
        raise httpx.ConnectError("unreachable", request=request)

    monkeypatch.setattr(OllamaService, "health", fake_health)
    response = client.get("/api/ollama/health")
    assert response.status_code == 503
