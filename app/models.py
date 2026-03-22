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
    model: str = "llama3.2"


class OllamaPromptRequest(BaseModel):
    prompt: str


class OllamaPromptResponse(BaseModel):
    model: str
    response: str


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


class UiState(BaseModel):
    kind: Literal["none", "file", "folder"] = "none"
    path: str = ""


class FolderTemplate(BaseModel):
    folder_path: str = ""
    content: str = ""


class AttachmentResponse(BaseModel):
    name: str
    path: str
    url: str
