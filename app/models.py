from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


NodeType = Literal["file", "folder"]


class TreeNode(BaseModel):
    path: str
    name: str
    node_type: NodeType
    children: list["TreeNode"] = Field(default_factory=list)


class DocumentResponse(BaseModel):
    path: str
    name: str
    content: str
    html: str
    frontmatter: dict[str, str | list[str]] = Field(default_factory=dict)


class SaveDocumentRequest(BaseModel):
    path: str
    content: str


class CreateNodeRequest(BaseModel):
    path: str
    node_type: NodeType


class MoveNodeRequest(BaseModel):
    source_path: str
    destination_path: str


class DeleteNodeRequest(BaseModel):
    path: str


class OllamaSettings(BaseModel):
    base_url: str = "http://127.0.0.1:11434"
    model: str = "qwen3.5:9b"
    think: bool = False
    prompt_presets: list[str] = Field(default_factory=lambda: [
        "Summarize the current note into 3-6 concise bullets. Focus on actionable points, decisions, and follow-ups.",
        "Extract action items from the current note as a short checklist.",
        "Rewrite the current note for clarity while preserving the meaning.",
        "List open questions or ambiguities in the current note.",
    ])


class OllamaPromptRequest(BaseModel):
    prompt: str


class OllamaPromptResponse(BaseModel):
    model: str
    response: str
    total_duration: int | None = None
    load_duration: int | None = None
    prompt_eval_count: int | None = None
    prompt_eval_duration: int | None = None
    eval_count: int | None = None
    eval_duration: int | None = None


class BacklinkItem(BaseModel):
    path: str
    name: str
    excerpt: str


class SearchResult(BaseModel):
    path: str
    name: str
    snippet: str


class FolderNoteSummary(BaseModel):
    path: str
    name: str
    title: str
    frontmatter: dict[str, str | list[str]] = Field(default_factory=dict)


class FolderDatabaseResponse(BaseModel):
    folder_path: str
    columns: list[str] = Field(default_factory=list)
    notes: list[FolderNoteSummary] = Field(default_factory=list)


class DatabaseViewSettings(BaseModel):
    filter_text: str = ""
    sort_by: str = "title"
    sort_direction: Literal["asc", "desc"] = "asc"
    view_mode: Literal["table", "board"] = "table"
    status_options: list[str] = Field(default_factory=lambda: ["backlog", "active", "in-progress", "paused", "done"])
    visible_columns: list[str] = Field(default_factory=list)


class NamedDatabaseView(BaseModel):
    view_id: str
    name: str
    settings: DatabaseViewSettings = Field(default_factory=DatabaseViewSettings)


class DatabaseViewCollection(BaseModel):
    folder_path: str = ""
    active_view_id: str = "default"
    views: list[NamedDatabaseView] = Field(default_factory=lambda: [NamedDatabaseView(view_id="default", name="Default")])


class UiState(BaseModel):
    kind: Literal["none", "file", "folder"] = "none"
    path: str = ""


class FolderTemplate(BaseModel):
    folder_path: str = ""
    content: str = ""


class TemplateEntry(BaseModel):
    template_id: str
    name: str
    content: str = ""
    is_default: bool = False


class TemplateCollection(BaseModel):
    folder_path: str = ""
    templates: list[TemplateEntry] = Field(default_factory=list)


class RestoreSnapshotRequest(BaseModel):
    path: str
    snapshot_id: str


class NoteSnapshot(BaseModel):
    snapshot_id: str
    path: str
    created_at: str
    title: str = ""
    content: str


class NoteHistory(BaseModel):
    path: str
    snapshots: list[NoteSnapshot] = Field(default_factory=list)


class AttachmentResponse(BaseModel):
    name: str
    path: str
    url: str
