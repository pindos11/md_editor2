import React, { useEffect, useMemo, useRef, useState } from "react";

import { api } from "./api";
import { SearchPalette } from "./components/SearchPalette";
import { TemplateManagerModal } from "./components/TemplateManagerModal";
import { TemplatePickerModal } from "./components/TemplatePickerModal";
import { Toolbar } from "./components/Toolbar";
import { WorkspacePanels } from "./components/WorkspacePanels";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePaneLayout } from "./hooks/usePaneLayout";
import { useSearchPalette } from "./hooks/useSearchPalette";
import {
  buildAliasMap,
  buildVisibleContent,
  flattenFiles,
  getRelationItems,
  getWikiAutocomplete,
  moveBlock,
  parseBlocks,
  pathExists,
  renderPreview,
  updateFrontmatter,
} from "./editorModel";

const SLASH_COMMANDS = [
  { id: "heading", label: "h1", description: "Large section heading", insert: "# Heading" },
  { id: "todo", label: "todo", description: "Checklist item", insert: "- [ ] Task" },
  { id: "quote", label: "quote", description: "Quoted text block", insert: "> Quote" },
  { id: "callout", label: "callout", description: "Simple callout block", insert: "> [!NOTE]\n> Important note" },
  { id: "code", label: "code", description: "Fenced code block", insert: "```text\n\n```" },
  { id: "table", label: "table", description: "Two-column markdown table", insert: "| Column | Value |\n| --- | --- |\n| Item | Detail |" },
  { id: "meeting", label: "meeting", description: "Meeting note template", insert: "# Meeting\n\n## Agenda\n- \n\n## Notes\n- \n\n## Actions\n- [ ] " },
  { id: "daily", label: "daily", description: "Daily note template", insert: "# Daily Note\n\n## Focus\n- \n\n## Journal\n\n## Wins\n- " },
];
const UI_SCALE_STORAGE_KEY = "md-editor2:ui-scale";
const DEFAULT_OLLAMA_PROMPT = "Summarize the current note into 3-6 concise bullets. Focus on actionable points, decisions, and follow-ups.";
const DEFAULT_OLLAMA_PROMPT_PRESETS = [
  DEFAULT_OLLAMA_PROMPT,
  "Extract action items from the current note as a short checklist.",
  "Rewrite the current note for clarity while preserving the meaning.",
  "List open questions or ambiguities in the current note.",
];

function loadStoredUiScale() {
  if (typeof window === "undefined") {
    return 100;
  }
  const raw = Number(window.localStorage.getItem(UI_SCALE_STORAGE_KEY));
  return Number.isFinite(raw) ? Math.max(85, Math.min(125, raw)) : 100;
}

function formatOllamaDuration(nanoseconds) {
  if (!Number.isFinite(nanoseconds) || nanoseconds <= 0) {
    return "";
  }
  const milliseconds = nanoseconds / 1_000_000;
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(0)} ms`;
  }
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

export function App() {
  const [tree, setTree] = useState([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [saveState, setSaveState] = useState("idle");
  const [ollamaSettings, setOllamaSettings] = useState({
    base_url: "http://127.0.0.1:11434",
    model: "llama3.2",
    think: false,
    prompt_presets: DEFAULT_OLLAMA_PROMPT_PRESETS,
  });
  const [ollamaHealth, setOllamaHealth] = useState("not checked");
  const [ollamaPrompt, setOllamaPrompt] = useState(DEFAULT_OLLAMA_PROMPT);
  const [ollamaResponse, setOllamaResponse] = useState("");
  const [ollamaStats, setOllamaStats] = useState("");
  const [ollamaResponseSource, setOllamaResponseSource] = useState("");
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [backlinks, setBacklinks] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [slashState, setSlashState] = useState({ open: false, query: "", commands: [] });
  const [wikiState, setWikiState] = useState({ open: false, query: "", items: [] });
  const [collapsedHeadings, setCollapsedHeadings] = useState(new Set());
  const [database, setDatabase] = useState({ folder_path: "", columns: [], notes: [] });
  const [noteHistory, setNoteHistory] = useState({ path: "", snapshots: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [databaseViewSettings, setDatabaseViewSettings] = useState({
    filter_text: "",
    sort_by: "title",
    sort_direction: "asc",
    view_mode: "table",
    status_options: ["backlog", "active", "in-progress", "paused", "done"],
    visible_columns: [],
  });
  const [databaseViews, setDatabaseViews] = useState({
    folder_path: "",
    active_view_id: "default",
    views: [{ view_id: "default", name: "Default", settings: {
      filter_text: "",
      sort_by: "title",
      sort_direction: "asc",
      view_mode: "table",
      status_options: ["backlog", "active", "in-progress", "paused", "done"],
      visible_columns: [],
    } }],
  });
  const [viewMode, setViewMode] = useState("editor");
  const [uiScale, setUiScale] = useState(loadStoredUiScale);
  const [templateCollection, setTemplateCollection] = useState({ folder_path: "", templates: [] });
  const [templatePickerState, setTemplatePickerState] = useState({
    open: false,
    path: "",
    folderPath: "",
    title: "",
    includeFrontmatter: false,
    defaultStatus: "",
    openAfterCreate: false,
    refreshDatabase: false,
  });
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const saveTimer = useRef(null);
  const textareaRef = useRef(null);
  const skipAutosaveRef = useRef(false);

  const aliasMap = useMemo(() => buildAliasMap(tree), [tree]);
  const relationOptions = useMemo(() => flattenFiles(tree).map((node) => node.name.replace(/\.md$/i, "")), [tree]);
  const blocks = useMemo(() => parseBlocks(documentContent), [documentContent]);
  const layoutKey = selectedPath || selectedFolderPath || "__global__";
  const { dragState, startResize, workspaceRef, workspaceStyle } = usePaneLayout(layoutKey);

  function normalizeTargetLabel(rawTarget) {
    return String(rawTarget || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/\.md$/i, "")
      .split("/")
      .at(-1)
      ?.replace(/[-_]+/g, " ")
      .trim() || "New Note";
  }

  function slugifyLabel(rawLabel) {
    return rawLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "new-note";
  }

  function containingFolder(path) {
    const parts = path.split("/");
    parts.pop();
    return parts.join("/");
  }

  function currentFolderContext() {
    if (selectedFolderPath) {
      return selectedFolderPath;
    }
    if (selectedPath) {
      return selectedPath.endsWith(".md") ? containingFolder(selectedPath) : selectedPath;
    }
    return "";
  }

  function normalizeCreatedPath(rawPath, targetType) {
    const normalized = String(rawPath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized) {
      return "";
    }
    if (targetType !== "file") {
      return normalized.replace(/\/+$/, "");
    }
    return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
  }

  function deriveNotePath(rawTarget, folderPath = "") {
    const normalized = String(rawTarget || "").trim().replace(/\\/g, "/");
    if (!normalized) {
      return `${folderPath ? `${folderPath}/` : ""}new-note.md`;
    }
    if (normalized.toLowerCase().endsWith(".md")) {
      return normalized;
    }
    if (normalized.includes("/")) {
      return `${normalized}.md`;
    }
    return `${folderPath ? `${folderPath}/` : ""}${slugifyLabel(normalized)}.md`;
  }

  function getDefaultStatus() {
    return databaseViewSettings.status_options?.[0] || "backlog";
  }

  function normalizeViewId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "view";
  }

  function buildDefaultDatabaseViewSettings() {
    return {
      filter_text: "",
      sort_by: "title",
      sort_direction: "asc",
      view_mode: "table",
      status_options: ["backlog", "active", "in-progress", "paused", "done"],
      visible_columns: [],
    };
  }

  function normalizeDatabaseViews(payload, folderPath = "") {
    if (payload?.views?.length) {
      return payload;
    }
    return {
      folder_path: folderPath,
      active_view_id: "default",
      views: [{ view_id: "default", name: "Default", settings: payload || buildDefaultDatabaseViewSettings() }],
    };
  }

  function applyTemplatePlaceholders(template, title, folderPath = "") {
    return template
      .replaceAll("{{title}}", title)
      .replaceAll("{{date}}", new Date().toISOString().slice(0, 10))
      .replaceAll("{{folder}}", folderPath || "");
  }

  function getDefaultTemplateId(collection) {
    return collection.templates?.find((template) => template.is_default)?.template_id || "";
  }

  function getTemplateContentById(collection, templateId) {
    return collection.templates?.find((template) => template.template_id === templateId)?.content || "";
  }

  async function loadTemplateCollection(folderPath = "") {
    const payload = await api.getTemplateCollection(folderPath).catch(() => ({ folder_path: folderPath, templates: [] }));
    setTemplateCollection(payload);
    return payload;
  }

  async function buildNewNoteContent(title, options = {}) {
    const folderPath = options.folderPath || "";
    const includeFrontmatter = options.includeFrontmatter ?? false;
    const defaultContent = includeFrontmatter
      ? `---\nstatus: ${options.defaultStatus || getDefaultStatus()}\ntags:\ndue:\nowner:\n---\n# ${title}\n`
      : `# ${title}\n`;
    const templateContent = options.templateContent
      ?? getTemplateContentById(options.templateCollection || templateCollection, options.templateId || getDefaultTemplateId(options.templateCollection || templateCollection));
    if (!templateContent?.trim()) {
      return defaultContent;
    }
    return applyTemplatePlaceholders(templateContent, title, folderPath);
  }

  async function createMissingNote(rawTarget, options = {}) {
    const folderPath = options.folderPath || "";
    const openAfterCreate = options.openAfterCreate ?? false;
    const includeFrontmatter = options.includeFrontmatter ?? false;
    const path = deriveNotePath(rawTarget, folderPath);
    const title = options.title || normalizeTargetLabel(rawTarget);
    await api.createNode(path, "file");
    const content = await buildNewNoteContent(title, {
      folderPath,
      includeFrontmatter,
      defaultStatus: options.defaultStatus,
      templateContent: options.templateContent,
      templateCollection: options.templateCollection,
      templateId: options.templateId,
    });
    await api.saveDocument(path, content);
    await refreshTree(path);
    if (folderPath) {
      await loadDatabase(folderPath);
    }
    if (openAfterCreate) {
      await loadDocument(path);
    }
    setStatusMessage(`Created ${path}`);
    return { path, label: path.replace(/^.*\//, "").replace(/\.md$/i, "") };
  }

  async function refreshTree(nextSelection = selectedPath) {
    const nextTree = await api.getTree();
    setTree(nextTree);
    if (nextSelection && !pathExists(nextTree, nextSelection)) {
      setSelectedPath("");
      setDocumentContent("");
      setPreviewHtml("");
      setBacklinks([]);
      setCollapsedHeadings(new Set());
    }
    return nextTree;
  }

  async function loadBacklinks(path) {
    if (!path) {
      setBacklinks([]);
      return;
    }
    const items = await api.getBacklinks(path);
    setBacklinks(items);
  }

  async function loadHistory(path) {
    if (!path) {
      setNoteHistory({ path: "", snapshots: [] });
      return;
    }
    setHistoryLoading(true);
    try {
      const payload = await api.getNoteHistory(path);
      setNoteHistory(payload);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadDatabase(folderPath = "") {
    const payload = await api.getFolderDatabase(folderPath);
    setDatabase(payload);
  }

  async function loadDatabaseViews(folderPath = "") {
    const payload = normalizeDatabaseViews(await api.getDatabaseViews(folderPath), folderPath);
    setDatabaseViews(payload);
    const active = payload.views.find((view) => view.view_id === payload.active_view_id) || payload.views[0];
    setDatabaseViewSettings(active?.settings || buildDefaultDatabaseViewSettings());
  }

  function updateSlashState(value, selectionStart) {
    const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const lineEndIndex = value.indexOf("\n", selectionStart);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const currentLine = value.slice(lineStart, lineEnd);
    if (!currentLine.startsWith("/")) {
      setSlashState({ open: false, query: "", commands: [] });
      return;
    }
    const query = currentLine.slice(1).trim().toLowerCase();
    const commands = SLASH_COMMANDS.filter((command) => command.label.includes(query) || command.description.toLowerCase().includes(query));
    setSlashState({ open: commands.length > 0, query, commands });
  }

  function syncDerivedState(content, selection = cursorPosition, nextCollapsed = collapsedHeadings) {
    setPreviewHtml(renderPreview(buildVisibleContent(content, nextCollapsed)));
    updateSlashState(content, selection);
    setWikiState(getWikiAutocomplete(content, selection, tree));
  }

  async function loadDocument(path) {
    const payload = await api.getDocument(path);
    const folderPath = containingFolder(path);
    skipAutosaveRef.current = true;
    setSelectedPath(path);
    setSelectedFolderPath("");
    setViewMode("editor");
    setDocumentContent(payload.content);
    setCollapsedHeadings(new Set());
    setPreviewHtml(renderPreview(payload.content));
    setSaveState("saved");
    setStatusMessage(`Loaded ${path}`);
    setCursorPosition(payload.content.length);
    setWikiState({ open: false, query: "", items: [] });
    setTemplateManagerOpen(false);
    api.saveUiState({ kind: "file", path }).catch(() => {});
    await Promise.all([loadBacklinks(path), loadHistory(path), loadTemplateCollection(folderPath)]);
  }

  async function loadFolder(folderPath) {
    setSelectedFolderPath(folderPath);
    setSelectedPath("");
    setDocumentContent("");
    setPreviewHtml("");
    setBacklinks([]);
    setCollapsedHeadings(new Set());
    setNoteHistory({ path: "", snapshots: [] });
    setTemplateManagerOpen(false);
    setViewMode("database");
    await Promise.all([loadDatabase(folderPath), loadDatabaseViews(folderPath), loadTemplateCollection(folderPath)]);
    setStatusMessage(`Loaded database for ${folderPath || "workspace"}`);
    api.saveUiState({ kind: "folder", path: folderPath }).catch(() => {});
  }

  async function saveDatabaseField(notePath, column, rawValue) {
    const payload = await api.getDocument(notePath);
    const nextContent = updateFrontmatter(payload.content, column, rawValue);
    await api.saveDocument(notePath, nextContent);
    await loadDatabase(selectedFolderPath);
    setStatusMessage(`Updated ${column} for ${notePath}`);
  }

  async function moveBoardNote(notePath, nextStatus) {
    await saveDatabaseField(notePath, "status", nextStatus);
  }

  async function saveDatabaseViewSettings(nextSettings) {
    const nextCollection = {
      ...databaseViews,
      views: databaseViews.views.map((view) =>
        view.view_id === databaseViews.active_view_id ? { ...view, settings: nextSettings } : view
      ),
    };
    setDatabaseViewSettings(nextSettings);
    setDatabaseViews(nextCollection);
    await api.saveDatabaseViews(selectedFolderPath, nextCollection);
  }

  async function saveDatabaseViews(nextViews) {
    const active = nextViews.views.find((view) => view.view_id === nextViews.active_view_id) || nextViews.views[0];
    setDatabaseViews(nextViews);
    setDatabaseViewSettings(active?.settings || buildDefaultDatabaseViewSettings());
    await api.saveDatabaseViews(selectedFolderPath, nextViews);
  }

  async function selectDatabaseView(viewId) {
    const nextViews = { ...databaseViews, active_view_id: viewId };
    await saveDatabaseViews(nextViews);
  }

  async function createDatabaseView(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      return;
    }
    let nextId = normalizeViewId(cleanName);
    const existingIds = new Set(databaseViews.views.map((view) => view.view_id));
    let counter = 2;
    while (existingIds.has(nextId)) {
      nextId = `${normalizeViewId(cleanName)}-${counter}`;
      counter += 1;
    }
    const nextViews = {
      ...databaseViews,
      active_view_id: nextId,
      views: [...databaseViews.views, { view_id: nextId, name: cleanName, settings: { ...databaseViewSettings } }],
    };
    await saveDatabaseViews(nextViews);
  }

  async function renameDatabaseView(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      return;
    }
    const nextViews = {
      ...databaseViews,
      views: databaseViews.views.map((view) =>
        view.view_id === databaseViews.active_view_id ? { ...view, name: cleanName } : view
      ),
    };
    await saveDatabaseViews(nextViews);
  }

  async function deleteDatabaseView(viewId) {
    const remaining = databaseViews.views.filter((view) => view.view_id !== viewId);
    const safeViews = remaining.length ? remaining : [{ view_id: "default", name: "Default", settings: buildDefaultDatabaseViewSettings() }];
    const nextViews = {
      ...databaseViews,
      active_view_id: safeViews[0].view_id,
      views: safeViews,
    };
    await saveDatabaseViews(nextViews);
  }

  async function createDatabaseNote() {
    const rawTitle = window.prompt("New note title");
    if (!rawTitle) {
      return;
    }
    const slug = rawTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "new-note";
    const folderPrefix = selectedFolderPath ? `${selectedFolderPath}/` : "";
    const path = `${folderPrefix}${slug}.md`;
    const collection = await loadTemplateCollection(selectedFolderPath);
    if (collection.templates?.length) {
      setTemplatePickerState({
        open: true,
        path,
        folderPath: selectedFolderPath,
        title: rawTitle,
        includeFrontmatter: true,
        defaultStatus: getDefaultStatus(),
        openAfterCreate: false,
        refreshDatabase: true,
      });
      return;
    }
    await createMissingNote(rawTitle, {
      folderPath: selectedFolderPath,
      includeFrontmatter: true,
      defaultStatus: getDefaultStatus(),
    });
  }

  async function saveCurrentAsTemplate() {
    const folderPath = currentFolderContext();
    if (!folderPath && !selectedPath && !selectedFolderPath) {
      return;
    }
    await loadTemplateCollection(folderPath);
    setTemplateManagerOpen(true);
  }

  async function clearCurrentTemplate() {
    const folderPath = currentFolderContext();
    if (!folderPath && !selectedPath && !selectedFolderPath) {
      return;
    }
    await api.saveFolderTemplate(folderPath, "");
    await loadTemplateCollection(folderPath);
    setStatusMessage(`Cleared template for ${folderPath || "workspace"}`);
  }

  async function confirmTemplatePicker(templateId) {
    const state = templatePickerState;
    if (!state.path) {
      setTemplatePickerState((current) => ({ ...current, open: false }));
      return;
    }
    const collection = await loadTemplateCollection(state.folderPath);
    const templateContent = templateId === "__blank__" ? "" : getTemplateContentById(collection, templateId);
    await createMissingNote(state.path, {
      folderPath: state.folderPath,
      title: state.title,
      includeFrontmatter: state.includeFrontmatter,
      defaultStatus: state.defaultStatus,
      openAfterCreate: state.openAfterCreate,
      templateContent,
    });
    if (state.refreshDatabase) {
      await loadDatabase(state.folderPath);
    }
    setTemplatePickerState({
      open: false,
      path: "",
      folderPath: "",
      title: "",
      includeFrontmatter: false,
      defaultStatus: "",
      openAfterCreate: false,
      refreshDatabase: false,
    });
  }

  async function saveTemplateCollection(nextTemplates) {
    const folderPath = currentFolderContext();
    const payload = {
      folder_path: folderPath,
      templates: nextTemplates
        .map((template, index) => ({
          ...template,
          template_id: template.template_id || `template-${index + 1}`,
          name: String(template.name || "").trim() || `Template ${index + 1}`,
        }))
        .filter((template) => template.content.trim()),
    };
    await api.saveTemplateCollection(folderPath, payload);
    await loadTemplateCollection(folderPath);
    setTemplateManagerOpen(false);
    setStatusMessage(`Saved templates for ${folderPath || "workspace"}`);
  }

  async function restoreSnapshot(snapshotId) {
    if (!selectedPath || !snapshotId) {
      return;
    }
    const payload = await api.restoreNoteSnapshot(selectedPath, snapshotId);
    skipAutosaveRef.current = true;
    setDocumentContent(payload.content);
    setPreviewHtml(renderPreview(buildVisibleContent(payload.content, new Set())));
    setCollapsedHeadings(new Set());
    setSaveState("saved");
    setStatusMessage(`Restored snapshot for ${selectedPath}`);
    await Promise.all([refreshTree(selectedPath), loadBacklinks(selectedPath), loadHistory(selectedPath)]);
  }

  function buildAttachmentSnippet(payload, file) {
    const isImage = file.type.startsWith("image/");
    return isImage ? `![${payload.name}](${payload.url})` : `[${payload.name}](${payload.url})`;
  }

  function insertSnippetsAtPosition(baseContent, snippets, selectionStart) {
    const before = baseContent.slice(0, selectionStart);
    const after = baseContent.slice(selectionStart);
    const spacerBefore = before && !before.endsWith("\n") ? "\n" : "";
    const spacerAfter = after && !after.startsWith("\n") ? "\n" : "";
    const insertedBlock = snippets.join("\n");
    return {
      content: `${before}${spacerBefore}${insertedBlock}${spacerAfter}${after}`,
      cursorPosition: before.length + spacerBefore.length + insertedBlock.length,
    };
  }

  async function attachFilesToCurrentNote(files, insertionPoint = null) {
    if (!selectedPath || !files?.length) {
      return;
    }
    const uploaded = [];
    for (const file of files) {
      const payload = await api.uploadAttachment(selectedPath, file);
      uploaded.push(buildAttachmentSnippet(payload, file));
    }
    const selectionStart = insertionPoint ?? textareaRef.current?.selectionStart ?? documentContent.length;
    const { content: nextValue, cursorPosition: nextPos } = insertSnippetsAtPosition(documentContent, uploaded, selectionStart);
    setDocumentContent(nextValue);
    setStatusMessage(`Attached ${files.length === 1 ? files[0].name : `${files.length} files`}`);
    window.setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextPos, nextPos);
        setCursorPosition(nextPos);
      }
    }, 0);
  }

  async function attachFileToCurrentNote(file) {
    await attachFilesToCurrentNote(file ? [file] : []);
  }

  function extractFileList(items) {
    return Array.from(items || []).filter((file) => file instanceof File);
  }

  async function handleEditorPaste(files, selectionStart) {
    if (!files.length) {
      return;
    }
    await attachFilesToCurrentNote(files, selectionStart);
  }

  async function handleEditorDrop(files, selectionStart) {
    if (!files.length) {
      return;
    }
    await attachFilesToCurrentNote(files, selectionStart);
  }

  async function saveNow(pathOverride = selectedPath, contentOverride = documentContent) {
    if (!pathOverride) {
      return;
    }
    try {
      const payload = await api.saveDocument(pathOverride, contentOverride);
      setPreviewHtml(renderPreview(buildVisibleContent(payload.content, collapsedHeadings)));
      setSaveState("saved");
      setStatusMessage(`Saved ${payload.path}`);
      await refreshTree(pathOverride);
      await Promise.all([loadBacklinks(pathOverride), loadHistory(pathOverride)]);
    } catch (error) {
      setSaveState("error");
      setStatusMessage(error.message);
    }
  }

  const { searchOpen, setSearchOpen, searchQuery, setSearchQuery, searchResults, openSearchResult } = useSearchPalette(setStatusMessage, loadDocument);

  useKeyboardShortcuts({
    saveTimer,
    saveNow,
    setSearchOpen,
    setSlashState,
    setWikiState,
  });

  function applySlashCommand(commandId) {
    const command = SLASH_COMMANDS.find((item) => item.id === commandId);
    if (!command || !textareaRef.current) {
      return;
    }
    const value = documentContent;
    const selectionStart = textareaRef.current.selectionStart;
    const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const lineEndIndex = value.indexOf("\n", selectionStart);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const before = value.slice(0, lineStart);
    const after = value.slice(lineEnd);
    const spacer = before && !before.endsWith("\n\n") ? "\n" : "";
    const insert = `${spacer}${command.insert}`;
    const nextValue = `${before}${insert}${after ? `\n${after.replace(/^\n/, "")}` : ""}`;
    setDocumentContent(nextValue);
    setSlashState({ open: false, query: "", commands: [] });
    setWikiState({ open: false, query: "", items: [] });
    window.setTimeout(() => {
      const nextPos = before.length + insert.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextPos, nextPos);
      setCursorPosition(nextPos);
    }, 0);
  }

  function applyWikiLink(item) {
    if (!textareaRef.current || !wikiState.open) {
      return;
    }
    const value = documentContent;
    const before = value.slice(0, wikiState.rangeStart);
    const after = value.slice(wikiState.rangeEnd);
    const label = item.label.replace(/\.md$/i, "");
    const nextValue = `${before}${label}]]${after}`;
    const nextPos = before.length + label.length + 2;
    setDocumentContent(nextValue);
    setWikiState({ open: false, query: "", items: [] });
    window.setTimeout(() => {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextPos, nextPos);
      setCursorPosition(nextPos);
    }, 0);
  }

  function resolveWikiTarget(encodedTarget) {
    const decoded = decodeURIComponent(encodedTarget).toLowerCase();
    return aliasMap.get(decoded) || aliasMap.get(decoded.replace(/\.md$/i, "")) || "";
  }

  async function openWikiLink(encodedTarget) {
    const decodedTarget = decodeURIComponent(encodedTarget);
    const targetPath = resolveWikiTarget(encodedTarget);
    if (!targetPath) {
      if (!window.confirm(`Create note "${decodedTarget}"?`)) {
        setStatusMessage(`Wiki-link target not found: ${decodedTarget}`);
        return;
      }
      const folderPath = selectedPath ? containingFolder(selectedPath) : "";
      await createMissingNote(decodedTarget, { folderPath, openAfterCreate: true });
      return;
    }
    await loadDocument(targetPath);
  }

  async function openRelationTarget(rawTarget) {
    const relationItems = getRelationItems(rawTarget);
    const relationTarget = relationItems[0] || String(rawTarget || "").trim();
    const targetPath = aliasMap.get(relationTarget.toLowerCase()) || aliasMap.get(relationTarget.replace(/\.md$/i, "").toLowerCase()) || "";
    if (!targetPath) {
      if (!window.confirm(`Create note "${relationTarget}"?`)) {
        setStatusMessage(`Relation target not found: ${relationTarget}`);
        return;
      }
      await createMissingNote(relationTarget, {
        folderPath: selectedFolderPath,
        includeFrontmatter: Boolean(selectedFolderPath),
        defaultStatus: getDefaultStatus(),
      });
      return;
    }
    await loadDocument(targetPath);
  }

  async function createMissingRelationTarget(rawTarget) {
    const { label } = await createMissingNote(rawTarget, {
      folderPath: selectedFolderPath,
      includeFrontmatter: Boolean(selectedFolderPath),
      defaultStatus: getDefaultStatus(),
    });
    return label;
  }

  function jumpToOffset(offset) {
    if (!textareaRef.current) {
      return;
    }
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(offset, offset);
    setCursorPosition(offset);
  }

  function reorderBlock(blockIndex, direction) {
    const nextValue = moveBlock(documentContent, blocks, blockIndex, direction);
    if (nextValue === documentContent) {
      return;
    }
    setDocumentContent(nextValue);
    setStatusMessage("Reordered block");
  }

  function toggleHeadingCollapse(offset) {
    setCollapsedHeadings((current) => {
      const next = new Set(current);
      if (next.has(offset)) {
        next.delete(offset);
      } else {
        next.add(offset);
      }
      setPreviewHtml(renderPreview(buildVisibleContent(documentContent, next)));
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(uiScale));
  }, [uiScale]);

  useEffect(() => {
    async function initializeApp() {
      try {
        await refreshTree();
        api.getOllamaSettings().then(setOllamaSettings).catch((error) => setStatusMessage(error.message));
        loadDatabase("").catch((error) => setStatusMessage(error.message));
        loadDatabaseViews("").catch((error) => setStatusMessage(error.message));
        const uiState = await api.getUiState();
        if (uiState.kind === "file" && uiState.path) {
          await loadDocument(uiState.path);
          return;
        }
        if (uiState.kind === "folder") {
          await loadFolder(uiState.path || "");
        }
      } catch (error) {
        setStatusMessage(error.message);
      }
    }

    initializeApp();
  }, []);

  useEffect(() => {
    syncDerivedState(documentContent, cursorPosition);
  }, [documentContent, cursorPosition, collapsedHeadings, tree]);

  useEffect(() => {
    if (!selectedPath) {
      setSaveState("idle");
      return undefined;
    }
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return undefined;
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    setSaveState("saving");
    saveTimer.current = window.setTimeout(() => {
      saveNow().catch((error) => setStatusMessage(error.message));
    }, 700);
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [documentContent, selectedPath]);

  async function promptAndCreate(targetType) {
    const folderPrefix = currentFolderContext();
    const suggestedPath = folderPrefix ? `${folderPrefix}/` : "";
    const message = targetType === "file" ? "Enter note path, e.g. ideas/new-note.md" : "Enter folder path";
    const value = window.prompt(message, suggestedPath);
    if (!value) {
      return;
    }
    const path = normalizeCreatedPath(value, targetType);
    if (!path) {
      return;
    }
    if (targetType === "file") {
      const title = normalizeTargetLabel(path);
      const folderPath = containingFolder(path);
      const collection = await loadTemplateCollection(folderPath);
      if (collection.templates?.length) {
        setTemplatePickerState({
          open: true,
          path,
          folderPath,
          title,
          includeFrontmatter: false,
          defaultStatus: "",
          openAfterCreate: true,
          refreshDatabase: false,
        });
        return;
      }
      await createMissingNote(path, { folderPath, includeFrontmatter: false, openAfterCreate: true });
      return;
    }
    await api.createNode(path, targetType);
    await refreshTree(path);
  }

  async function renameSelected() {
    if (!selectedPath) {
      return;
    }
    const destination = window.prompt("Move or rename to", selectedPath);
    if (!destination || destination === selectedPath) {
      return;
    }
    await api.moveNode(selectedPath, destination);
    await refreshTree(destination);
    if (destination.endsWith(".md")) {
      await loadDocument(destination);
    }
  }

  async function deleteSelected() {
    if (!selectedPath || !window.confirm(`Delete ${selectedPath}?`)) {
      return;
    }
    await api.deleteNode(selectedPath);
    setSelectedPath("");
    setDocumentContent("");
    setPreviewHtml("");
    setBacklinks([]);
    setCollapsedHeadings(new Set());
    api.saveUiState({ kind: "none", path: "" }).catch(() => {});
    await refreshTree();
  }

  async function updateOllamaSettings(nextSettings) {
    setOllamaSettings(nextSettings);
    try {
      await api.saveOllamaSettings(nextSettings);
      setStatusMessage("Saved Ollama settings");
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function checkOllama() {
    try {
      const payload = await api.getOllamaHealth();
      setOllamaHealth(`${payload.status} (${payload.model})`);
    } catch (error) {
      setOllamaHealth(`error: ${error.message}`);
    }
  }

  async function runPrompt() {
    if (!selectedPath) {
      return;
    }
    try {
      setOllamaRunning(true);
      const instruction = ollamaPrompt.trim() || DEFAULT_OLLAMA_PROMPT;
      const payload = await api.promptOllama(`${instruction}\n\nMarkdown note:\n\n${documentContent}`);
      setOllamaResponse(payload.response || "");
      setOllamaResponseSource(selectedPath);
      const loadPart = formatOllamaDuration(payload.load_duration);
      const totalPart = formatOllamaDuration(payload.total_duration);
      const stats = [loadPart ? `load ${loadPart}` : "", totalPart ? `total ${totalPart}` : ""].filter(Boolean).join(" | ");
      setOllamaStats(stats);
      setStatusMessage(payload.response?.trim() ? `Ollama response ready${stats ? ` (${stats})` : ""}` : "Ollama returned an empty response");
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setOllamaRunning(false);
    }
  }

  function insertOllamaResponse() {
    if (!selectedPath || !ollamaResponse.trim()) {
      return;
    }
    const snippet = `\n\n## AI Notes\n\n${ollamaResponse.trim()}\n`;
    const selectionStart = textareaRef.current?.selectionStart ?? documentContent.length;
    const { content: nextValue, cursorPosition: nextPos } = insertSnippetsAtPosition(documentContent, [snippet.trim()], selectionStart);
    setDocumentContent(nextValue);
    setStatusMessage("Inserted Ollama response into note");
    window.setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextPos, nextPos);
        setCursorPosition(nextPos);
      }
    }, 0);
  }

  function handleEditorChange(value, selectionStart) {
    setDocumentContent(value);
    setCursorPosition(selectionStart);
  }

  function handleEditorKeyDown(event) {
    if (slashState.open && event.key === "Enter") {
      event.preventDefault();
      applySlashCommand(slashState.commands[0].id);
    }
    if (wikiState.open && event.key === "Enter") {
      event.preventDefault();
      applyWikiLink(wikiState.items[0]);
    }
    if (event.key === "Escape") {
      setSlashState({ open: false, query: "", commands: [] });
      setWikiState({ open: false, query: "", items: [] });
    }
  }

  return (
    <>
      <SearchPalette
        open={searchOpen}
        query={searchQuery}
        results={searchResults}
        onQueryChange={setSearchQuery}
        onClose={() => setSearchOpen(false)}
        onSelect={(path) => openSearchResult(path).catch((error) => setStatusMessage(error.message))}
      />
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Offline-first markdown workspace</p>
            <h1>Markdown notes with movable blocks, foldable sections, and connected links.</h1>
          </div>
          <p className="status">{statusMessage}</p>
        </header>

        <Toolbar
          selectedPath={selectedPath}
          templateFolderPath={currentFolderContext()}
          uiScale={uiScale}
          onCreateFile={() => promptAndCreate("file").catch((error) => setStatusMessage(error.message))}
          onCreateFolder={() => promptAndCreate("folder").catch((error) => setStatusMessage(error.message))}
          onQuickFind={() => setSearchOpen(true)}
          onRename={() => renameSelected().catch((error) => setStatusMessage(error.message))}
          onDelete={() => deleteSelected().catch((error) => setStatusMessage(error.message))}
          onSaveTemplate={() => saveCurrentAsTemplate().catch((error) => setStatusMessage(error.message))}
          onClearTemplate={() => clearCurrentTemplate().catch((error) => setStatusMessage(error.message))}
          onAttachFile={(file) => attachFileToCurrentNote(file).catch((error) => setStatusMessage(error.message))}
          onChangeUiScale={setUiScale}
          ollamaSettings={ollamaSettings}
          onChangeOllama={updateOllamaSettings}
          ollamaHealth={ollamaHealth}
          onCheckOllama={checkOllama}
          onRunPrompt={runPrompt}
          ollamaPrompt={ollamaPrompt}
          onChangeOllamaPrompt={setOllamaPrompt}
          ollamaResponse={ollamaResponse}
          ollamaStats={ollamaStats}
          ollamaResponseSource={ollamaResponseSource}
          ollamaRunning={ollamaRunning}
          onInsertOllamaResponse={insertOllamaResponse}
          onClearOllamaResponse={() => {
            setOllamaResponse("");
            setOllamaStats("");
            setOllamaResponseSource("");
          }}
        />

        <WorkspacePanels
          workspaceRef={workspaceRef}
          workspaceStyle={{ ...workspaceStyle, "--workspace-ui-scale": uiScale / 100 }}
          dragState={dragState}
          startResize={startResize}
          tree={tree}
          selectedPath={selectedPath}
          selectedFolderPath={selectedFolderPath}
          viewMode={viewMode}
          blocks={blocks}
          collapsedHeadings={collapsedHeadings}
          backlinks={backlinks}
          history={noteHistory}
          historyLoading={historyLoading}
          database={database}
          databaseViews={databaseViews}
          databaseViewSettings={databaseViewSettings}
          relationOptions={relationOptions}
          textareaRef={textareaRef}
          documentContent={documentContent}
          saveState={saveState}
          slashState={slashState}
          wikiState={wikiState}
          previewHtml={previewHtml}
          onSelectFile={(path) => loadDocument(path).catch((error) => setStatusMessage(error.message))}
          onSelectFolder={(path) => loadFolder(path).catch((error) => setStatusMessage(error.message))}
          onJumpToBlock={jumpToOffset}
          onMoveBlock={reorderBlock}
          onToggleHeadingCollapse={toggleHeadingCollapse}
          onOpenBacklink={(path) => loadDocument(path).catch((error) => setStatusMessage(error.message))}
          onRestoreSnapshot={(snapshotId) => restoreSnapshot(snapshotId).catch((error) => setStatusMessage(error.message))}
          onOpenNote={(path) => loadDocument(path).catch((error) => setStatusMessage(error.message))}
          onOpenRelation={(target) => openRelationTarget(target).catch((error) => setStatusMessage(error.message))}
          onCreateRelation={(target) => createMissingRelationTarget(target).catch((error) => setStatusMessage(error.message))}
          onSaveDatabaseField={(path, column, value) => saveDatabaseField(path, column, value).catch((error) => setStatusMessage(error.message))}
          onMoveBoardNote={(path, status) => moveBoardNote(path, status).catch((error) => setStatusMessage(error.message))}
          onChangeDatabaseViewSettings={(settings) => saveDatabaseViewSettings(settings).catch((error) => setStatusMessage(error.message))}
          onSelectDatabaseView={(viewId) => selectDatabaseView(viewId).catch((error) => setStatusMessage(error.message))}
          onCreateDatabaseView={(name) => createDatabaseView(name).catch((error) => setStatusMessage(error.message))}
          onRenameDatabaseView={(name) => renameDatabaseView(name).catch((error) => setStatusMessage(error.message))}
          onDeleteDatabaseView={(viewId) => deleteDatabaseView(viewId).catch((error) => setStatusMessage(error.message))}
          onCreateDatabaseNote={() => createDatabaseNote().catch((error) => setStatusMessage(error.message))}
          onEditorChange={handleEditorChange}
          onEditorCursorChange={setCursorPosition}
          onEditorKeyDown={handleEditorKeyDown}
          onEditorPaste={(files, selectionStart) => handleEditorPaste(extractFileList(files), selectionStart).catch((error) => setStatusMessage(error.message))}
          onEditorDrop={(files, selectionStart) => handleEditorDrop(extractFileList(files), selectionStart).catch((error) => setStatusMessage(error.message))}
          onSelectSlashCommand={applySlashCommand}
          onSelectWikiLink={applyWikiLink}
          onOpenWikiLink={(target) => openWikiLink(target).catch((error) => setStatusMessage(error.message))}
        />
        <TemplatePickerModal
          open={templatePickerState.open}
          folderPath={templatePickerState.folderPath}
          noteTitle={templatePickerState.title}
          templates={templateCollection.templates || []}
          onConfirm={(templateId) => confirmTemplatePicker(templateId).catch((error) => setStatusMessage(error.message))}
          onCancel={() => setTemplatePickerState((current) => ({ ...current, open: false }))}
        />
        <TemplateManagerModal
          open={templateManagerOpen}
          folderPath={currentFolderContext()}
          templates={templateCollection.templates || []}
          documentContent={documentContent}
          onSave={(templates) => saveTemplateCollection(templates).catch((error) => setStatusMessage(error.message))}
          onClose={() => setTemplateManagerOpen(false)}
        />
      </main>
    </>
  );
}
