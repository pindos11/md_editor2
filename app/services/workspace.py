from __future__ import annotations

import asyncio
import datetime
import re
import shutil
from pathlib import Path
from urllib.parse import quote

import markdown

import json

from app.models import (
    AttachmentResponse,
    BacklinkItem,
    DatabaseViewCollection,
    DatabaseViewSettings,
    DocumentResponse,
    FolderTemplate,
    FolderDatabaseResponse,
    FolderNoteSummary,
    NamedDatabaseView,
    OllamaSettings,
    SearchResult,
    TreeNode,
    UiState,
)


METADATA_DIR = ".mdeditor"
ATTACHMENTS_DIR = "_attachments"
CONFIG_FILE = "config.json"
DB_VIEWS_FILE = "db_views.json"
UI_STATE_FILE = "ui_state.json"
TEMPLATES_FILE = "templates.json"
WIKI_LINK_PATTERN = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
FRONTMATTER_PATTERN = re.compile(r"\A---\n(.*?)\n---\n?", re.DOTALL)
AUTO_TITLE_LIMIT = 140


class WorkspaceError(Exception):
    pass


class WorkspaceManager:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.metadata_dir = self.root / METADATA_DIR
        self.attachments_dir = self.root / ATTACHMENTS_DIR
        self.config_path = self.metadata_dir / CONFIG_FILE
        self.db_views_path = self.metadata_dir / DB_VIEWS_FILE
        self.ui_state_path = self.metadata_dir / UI_STATE_FILE
        self.templates_path = self.metadata_dir / TEMPLATES_FILE
        self._write_lock = asyncio.Lock()

    def initialize(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        self.metadata_dir.mkdir(exist_ok=True)
        self.attachments_dir.mkdir(exist_ok=True)
        if not self.config_path.exists():
            settings = OllamaSettings()
            self.config_path.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
        if not self.db_views_path.exists():
            self.db_views_path.write_text("{}", encoding="utf-8")
        if not self.ui_state_path.exists():
            self.ui_state_path.write_text(UiState().model_dump_json(indent=2), encoding="utf-8")
        if not self.templates_path.exists():
            self.templates_path.write_text("{}", encoding="utf-8")

    def _normalize_relative_path(self, raw_path: str) -> Path:
        if not raw_path:
            return Path(".")
        candidate = Path(raw_path)
        if candidate.is_absolute():
            raise WorkspaceError("Absolute paths are not allowed.")
        normalized = Path(*[part for part in candidate.parts if part not in ("", ".")])
        if any(part == ".." for part in normalized.parts):
            raise WorkspaceError("Path traversal is not allowed.")
        return normalized

    def resolve_path(self, raw_path: str) -> Path:
        relative = self._normalize_relative_path(raw_path)
        candidate = (self.root / relative).resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise WorkspaceError("Path escapes the configured root.") from exc
        if self.metadata_dir == candidate or self.metadata_dir in candidate.parents:
            raise WorkspaceError("Internal metadata is not accessible through the API.")
        return candidate

    def resolve_attachment_path(self, raw_path: str) -> Path:
        relative = self._normalize_relative_path(raw_path)
        candidate = (self.attachments_dir / relative).resolve()
        try:
            candidate.relative_to(self.attachments_dir)
        except ValueError as exc:
            raise WorkspaceError("Attachment path escapes the attachments root.") from exc
        return candidate

    def to_relative(self, path: Path) -> str:
        relative = path.relative_to(self.root).as_posix()
        return "" if relative == "." else relative

    def _list_markdown_files(self) -> list[Path]:
        return sorted(
            [path for path in self.root.rglob("*.md") if self.metadata_dir not in path.parents],
            key=lambda path: self.to_relative(path).lower(),
        )

    def _note_keys(self, path: Path) -> set[str]:
        relative = self.to_relative(path)
        no_ext = relative[:-3] if relative.lower().endswith(".md") else relative
        name = path.stem
        keys = {relative.lower(), no_ext.lower(), name.lower()}
        keys.add(path.name.lower())
        return keys

    def _resolve_wiki_target(self, target: str) -> Path | None:
        normalized = target.strip().replace("\\", "/")
        if not normalized:
            return None
        target_keys = {normalized.lower()}
        if normalized.lower().endswith(".md"):
            target_keys.add(normalized[:-3].lower())
        else:
            target_keys.add(f"{normalized.lower()}.md")
        for path in self._list_markdown_files():
            if self._note_keys(path) & target_keys:
                return path
        return None

    def _render_markdown(self, content: str) -> str:
        def replace(match: re.Match[str]) -> str:
            raw_target = match.group(1).strip()
            label = (match.group(2) or raw_target).strip()
            return f"[{label}](wikilink:{raw_target})"

        prepared = WIKI_LINK_PATTERN.sub(replace, content)
        return markdown.markdown(prepared, extensions=["extra", "tables", "fenced_code"])

    def _extract_wiki_links(self, content: str) -> list[str]:
        return [match.group(1).strip() for match in WIKI_LINK_PATTERN.finditer(content)]

    def _parse_frontmatter(self, content: str) -> tuple[dict[str, str | list[str]], str]:
        match = FRONTMATTER_PATTERN.match(content)
        if not match:
            return {}, content
        raw_frontmatter = match.group(1)
        body = content[match.end():]
        metadata: dict[str, str | list[str]] = {}
        current_key: str | None = None
        list_buffer: list[str] = []
        for raw_line in raw_frontmatter.splitlines():
            line = raw_line.rstrip()
            if not line.strip():
                continue
            if line.lstrip().startswith("- ") and current_key:
                list_buffer.append(line.lstrip()[2:].strip())
                metadata[current_key] = list_buffer
                continue
            if ":" not in line:
                current_key = None
                list_buffer = []
                continue
            key, value = line.split(":", 1)
            current_key = key.strip()
            cleaned_value = value.strip()
            if cleaned_value:
                metadata[current_key] = cleaned_value
                list_buffer = []
            else:
                metadata[current_key] = []
                list_buffer = []
        return metadata, body

    def _title_from_body(self, body: str, fallback_name: str) -> str:
        for line in body.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            heading = re.match(r"^#{1,6}\s+(.*)$", stripped)
            if heading:
                return heading.group(1).strip()
            return stripped
        return fallback_name

    def _normalize_auto_title(self, value: str, fallback_name: str) -> str:
        title = re.sub(r"\s+", " ", (value or "").strip()) or fallback_name
        if len(title) <= AUTO_TITLE_LIMIT:
            return title
        return f"{title[:AUTO_TITLE_LIMIT - 1].rstrip()}…"

    def _current_timestamp(self) -> str:
        return datetime.datetime.now().astimezone().replace(second=0, microsecond=0).isoformat(timespec="minutes")

    def _serialize_frontmatter(self, frontmatter: dict[str, str | list[str]], body: str) -> str:
        entries = list(frontmatter.items())
        if not entries:
            return body.lstrip("\n")
        lines: list[str] = []
        for key, value in entries:
            if isinstance(value, list):
                if not value:
                    lines.append(f"{key}:")
                else:
                    lines.append(f"{key}:")
                    lines.extend(f"  - {item}" for item in value)
            else:
                lines.append(f"{key}: {value}")
        frontmatter_text = "\n".join(lines)
        normalized_body = body.lstrip("\n")
        return f"---\n{frontmatter_text}\n---\n{normalized_body}"

    def _slugify_name(self, value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
        return slug or "untitled"

    def _sanitize_filename(self, filename: str) -> str:
        cleaned = Path(filename or "attachment").name
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", cleaned).strip(".-")
        return cleaned or "attachment"

    def build_tree(self) -> list[TreeNode]:
        def walk(directory: Path) -> list[TreeNode]:
            nodes: list[TreeNode] = []
            for entry in sorted(directory.iterdir(), key=lambda item: (item.is_file(), item.name.lower())):
                if entry.name in {METADATA_DIR, ATTACHMENTS_DIR}:
                    continue
                if entry.is_dir():
                    nodes.append(
                        TreeNode(
                            path=self.to_relative(entry),
                            name=entry.name,
                            node_type="folder",
                            children=walk(entry),
                        )
                    )
                elif entry.suffix.lower() == ".md":
                    nodes.append(
                        TreeNode(
                            path=self.to_relative(entry),
                            name=entry.name,
                            node_type="file",
                        )
                    )
            return nodes

        return walk(self.root)

    def get_document(self, raw_path: str) -> DocumentResponse:
        document_path = self.resolve_path(raw_path)
        if not document_path.exists() or not document_path.is_file():
            raise FileNotFoundError(raw_path)
        if document_path.suffix.lower() != ".md":
            raise WorkspaceError("Only markdown files are supported.")
        content = document_path.read_text(encoding="utf-8")
        frontmatter, body = self._parse_frontmatter(content)
        html = self._render_markdown(body)
        return DocumentResponse(
            path=self.to_relative(document_path),
            name=document_path.name,
            content=content,
            html=html,
            frontmatter=frontmatter,
        )

    async def save_document(self, raw_path: str, content: str) -> DocumentResponse:
        document_path = self.resolve_path(raw_path)
        if document_path.suffix.lower() != ".md":
            raise WorkspaceError("Only markdown files are supported.")
        document_path.parent.mkdir(parents=True, exist_ok=True)
        existing_frontmatter: dict[str, str | list[str]] = {}
        if document_path.exists():
            existing_content = document_path.read_text(encoding="utf-8")
            existing_frontmatter, _ = self._parse_frontmatter(existing_content)
        frontmatter, body = self._parse_frontmatter(content)
        timestamp = self._current_timestamp()
        incoming_updated = str(frontmatter.get("updated", "")).strip() if "updated" in frontmatter else ""
        existing_updated = str(existing_frontmatter.get("updated", "")).strip() if "updated" in existing_frontmatter else ""
        frontmatter["created"] = str(frontmatter.get("created") or existing_frontmatter.get("created") or timestamp)
        if not str(frontmatter.get("title", "")).strip():
            frontmatter["title"] = self._normalize_auto_title(
                self._title_from_body(body, document_path.stem),
                document_path.stem,
            )
        if incoming_updated and incoming_updated != existing_updated:
            frontmatter["updated"] = incoming_updated
        else:
            frontmatter["updated"] = timestamp
        normalized_content = self._serialize_frontmatter(frontmatter, body)
        async with self._write_lock:
            document_path.write_text(normalized_content, encoding="utf-8")
        return self.get_document(raw_path)

    async def create_node(self, raw_path: str, node_type: str) -> None:
        target = self.resolve_path(raw_path)
        if target.exists():
            raise WorkspaceError("Path already exists.")
        async with self._write_lock:
            if node_type == "folder":
                target.mkdir(parents=True, exist_ok=False)
            else:
                if target.suffix.lower() != ".md":
                    raise WorkspaceError("Files must end with .md.")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("# New Note\n", encoding="utf-8")

    async def move_node(self, source_path: str, destination_path: str) -> None:
        source = self.resolve_path(source_path)
        destination = self.resolve_path(destination_path)
        if not source.exists():
            raise FileNotFoundError(source_path)
        if destination.exists():
            raise WorkspaceError("Destination already exists.")
        async with self._write_lock:
            destination.parent.mkdir(parents=True, exist_ok=True)
            source.rename(destination)

    async def delete_node(self, raw_path: str) -> None:
        target = self.resolve_path(raw_path)
        if not target.exists():
            raise FileNotFoundError(raw_path)
        async with self._write_lock:
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()

    async def save_attachment(self, note_path: str, filename: str, content: bytes) -> AttachmentResponse:
        document_path = self.resolve_path(note_path)
        if not document_path.exists() or not document_path.is_file() or document_path.suffix.lower() != ".md":
            raise FileNotFoundError(note_path)
        note_folder = self._slugify_name(document_path.stem)
        safe_name = self._sanitize_filename(filename)
        target = self.attachments_dir / note_folder / safe_name
        target.parent.mkdir(parents=True, exist_ok=True)
        base = target.stem
        suffix = target.suffix
        counter = 2
        while target.exists():
            target = target.with_name(f"{base}-{counter}{suffix}")
            counter += 1
        async with self._write_lock:
            target.write_bytes(content)
        relative = target.relative_to(self.attachments_dir).as_posix()
        return AttachmentResponse(
            name=target.name,
            path=relative,
            url=f"/workspace-assets/{quote(relative)}",
        )

    def search_notes(self, query: str) -> list[SearchResult]:
        needle = query.strip().lower()
        if len(needle) < 2:
            return []
        results: list[SearchResult] = []
        for path in self._list_markdown_files():
            content = path.read_text(encoding="utf-8")
            haystacks = [path.name.lower(), self.to_relative(path).lower(), content.lower()]
            if not any(needle in haystack for haystack in haystacks):
                continue
            snippet_source = content.replace("\n", " ").strip()
            location = snippet_source.lower().find(needle)
            if location == -1:
                snippet = snippet_source[:120]
            else:
                start = max(0, location - 30)
                end = min(len(snippet_source), location + len(needle) + 60)
                snippet = snippet_source[start:end]
            results.append(SearchResult(path=self.to_relative(path), name=path.name, snippet=snippet))
        return results[:20]

    def get_folder_database(self, raw_path: str) -> FolderDatabaseResponse:
        folder_path = self.resolve_path(raw_path) if raw_path else self.root
        if not folder_path.exists() or not folder_path.is_dir():
            raise FileNotFoundError(raw_path)
        notes: list[FolderNoteSummary] = []
        columns: set[str] = set()
        for entry in sorted(folder_path.iterdir(), key=lambda item: item.name.lower()):
            if entry.name == METADATA_DIR or entry.is_dir() or entry.suffix.lower() != ".md":
                continue
            content = entry.read_text(encoding="utf-8")
            frontmatter, body = self._parse_frontmatter(content)
            columns.update(frontmatter.keys())
            notes.append(
                FolderNoteSummary(
                    path=self.to_relative(entry),
                    name=entry.name,
                    title=self._title_from_body(body, entry.stem),
                    frontmatter=frontmatter,
                )
            )
        preferred = ["status", "tags", "due", "owner"]
        ordered_columns = [column for column in preferred if column in columns]
        ordered_columns.extend(sorted(column for column in columns if column not in ordered_columns))
        return FolderDatabaseResponse(
            folder_path=self.to_relative(folder_path),
            columns=ordered_columns,
            notes=notes,
        )

    def get_backlinks(self, raw_path: str) -> list[BacklinkItem]:
        target_path = self.resolve_path(raw_path)
        target_keys = self._note_keys(target_path)
        backlinks: list[BacklinkItem] = []
        for path in self._list_markdown_files():
            if path == target_path:
                continue
            content = path.read_text(encoding="utf-8")
            links = self._extract_wiki_links(content)
            if not links:
                continue
            resolved = [self._resolve_wiki_target(link) for link in links]
            if any(match and match == target_path for match in resolved):
                excerpt = content.replace("\n", " ").strip()[:140]
                backlinks.append(BacklinkItem(path=self.to_relative(path), name=path.name, excerpt=excerpt))
                continue
            if any(link.lower() in target_keys for link in links):
                excerpt = content.replace("\n", " ").strip()[:140]
                backlinks.append(BacklinkItem(path=self.to_relative(path), name=path.name, excerpt=excerpt))
        return backlinks

    def load_settings(self) -> OllamaSettings:
        self.initialize()
        return OllamaSettings.model_validate_json(self.config_path.read_text(encoding="utf-8"))

    async def save_settings(self, settings: OllamaSettings) -> OllamaSettings:
        async with self._write_lock:
            self.config_path.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
        return settings

    def load_database_view_settings(self, raw_path: str) -> DatabaseViewSettings:
        collection = self.load_database_views(raw_path)
        active = next((view for view in collection.views if view.view_id == collection.active_view_id), None)
        return active.settings if active else DatabaseViewSettings()

    async def save_database_view_settings(self, raw_path: str, settings: DatabaseViewSettings) -> DatabaseViewSettings:
        collection = self.load_database_views(raw_path)
        updated = False
        for index, view in enumerate(collection.views):
            if view.view_id == collection.active_view_id:
                collection.views[index] = NamedDatabaseView(view_id=view.view_id, name=view.name, settings=settings)
                updated = True
                break
        if not updated:
            collection.views.append(NamedDatabaseView(view_id=collection.active_view_id, name="Default", settings=settings))
        await self.save_database_views(raw_path, collection)
        return settings

    def _normalize_database_views(self, raw_path: str, stored: object) -> DatabaseViewCollection:
        key = raw_path or ""
        if isinstance(stored, dict) and "views" in stored:
            collection = DatabaseViewCollection.model_validate({"folder_path": key, **stored})
        else:
            collection = DatabaseViewCollection(
                folder_path=key,
                active_view_id="default",
                views=[
                    NamedDatabaseView(
                        view_id="default",
                        name="Default",
                        settings=DatabaseViewSettings.model_validate(stored or {}),
                    )
                ],
            )
        if not collection.views:
            collection.views = [NamedDatabaseView(view_id="default", name="Default")]
        if not any(view.view_id == collection.active_view_id for view in collection.views):
            collection.active_view_id = collection.views[0].view_id
        return collection

    def load_database_views(self, raw_path: str) -> DatabaseViewCollection:
        self.initialize()
        key = raw_path or ""
        payload = json.loads(self.db_views_path.read_text(encoding="utf-8"))
        return self._normalize_database_views(key, payload.get(key, {}))

    async def save_database_views(self, raw_path: str, collection: DatabaseViewCollection) -> DatabaseViewCollection:
        self.initialize()
        key = raw_path or ""
        stored = self._normalize_database_views(key, collection.model_dump())
        async with self._write_lock:
            payload = json.loads(self.db_views_path.read_text(encoding="utf-8"))
            payload[key] = {
                "active_view_id": stored.active_view_id,
                "views": [view.model_dump() for view in stored.views],
            }
            self.db_views_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return stored

    def load_ui_state(self) -> UiState:
        self.initialize()
        state = UiState.model_validate_json(self.ui_state_path.read_text(encoding="utf-8"))
        if state.kind != "none" and state.path:
            try:
                target = self.resolve_path(state.path)
            except WorkspaceError:
                return UiState()
            if not target.exists():
                return UiState()
            if state.kind == "file" and (not target.is_file() or target.suffix.lower() != ".md"):
                return UiState()
            if state.kind == "folder" and not target.is_dir():
                return UiState()
        return state

    async def save_ui_state(self, state: UiState) -> UiState:
        self.initialize()
        if state.kind != "none" and state.path:
            target = self.resolve_path(state.path)
            if not target.exists():
                return UiState()
            if state.kind == "file" and (not target.is_file() or target.suffix.lower() != ".md"):
                raise WorkspaceError("UI state file target must be a markdown file.")
            if state.kind == "folder" and not target.is_dir():
                raise WorkspaceError("UI state folder target must be a folder.")
        async with self._write_lock:
            self.ui_state_path.write_text(state.model_dump_json(indent=2), encoding="utf-8")
        return state

    def load_folder_template(self, raw_path: str) -> FolderTemplate:
        self.initialize()
        folder_path = self.resolve_path(raw_path) if raw_path else self.root
        if not folder_path.exists() or not folder_path.is_dir():
            raise FileNotFoundError(raw_path)
        payload = json.loads(self.templates_path.read_text(encoding="utf-8"))
        key = self.to_relative(folder_path)
        return FolderTemplate(folder_path=key, content=payload.get(key, ""))

    async def save_folder_template(self, raw_path: str, template: FolderTemplate) -> FolderTemplate:
        self.initialize()
        folder_path = self.resolve_path(raw_path) if raw_path else self.root
        if not folder_path.exists() or not folder_path.is_dir():
            raise FileNotFoundError(raw_path)
        key = self.to_relative(folder_path)
        stored = FolderTemplate(folder_path=key, content=template.content)
        async with self._write_lock:
            payload = json.loads(self.templates_path.read_text(encoding="utf-8"))
            payload[key] = stored.content
            self.templates_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return stored

    def render_template(self, raw_path: str, title: str, fallback: str) -> str:
        template = self.load_folder_template(raw_path).content
        if not template.strip():
            return fallback
        return (
            template.replace("{{title}}", title)
            .replace("{{date}}", datetime.date.today().isoformat())
            .replace("{{folder}}", raw_path or "")
        )
