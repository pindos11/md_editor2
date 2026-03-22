import React, { useEffect, useMemo, useRef, useState } from "react";

import { api } from "./api";
import { SearchPalette } from "./components/SearchPalette";
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

export function App() {
  const [tree, setTree] = useState([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [saveState, setSaveState] = useState("idle");
  const [ollamaSettings, setOllamaSettings] = useState({ base_url: "http://127.0.0.1:11434", model: "llama3.2" });
  const [ollamaHealth, setOllamaHealth] = useState("not checked");
  const [backlinks, setBacklinks] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [slashState, setSlashState] = useState({ open: false, query: "", commands: [] });
  const [wikiState, setWikiState] = useState({ open: false, query: "", items: [] });
  const [collapsedHeadings, setCollapsedHeadings] = useState(new Set());
  const [database, setDatabase] = useState({ folder_path: "", columns: [], notes: [] });
  const [databaseViewSettings, setDatabaseViewSettings] = useState({
    filter_text: "",
    sort_by: "title",
    sort_direction: "asc",
    view_mode: "table",
    status_options: ["backlog", "active", "in-progress", "paused", "done"],
    visible_columns: [],
  });
  const [viewMode, setViewMode] = useState("editor");
  const saveTimer = useRef(null);
  const textareaRef = useRef(null);
  const skipAutosaveRef = useRef(false);

  const aliasMap = useMemo(() => buildAliasMap(tree), [tree]);
  const relationOptions = useMemo(() => flattenFiles(tree).map((node) => node.name.replace(/\.md$/i, "")), [tree]);
  const blocks = useMemo(() => parseBlocks(documentContent), [documentContent]);
  const { dragState, startResize, workspaceRef, workspaceStyle } = usePaneLayout();

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

  function applyTemplatePlaceholders(template, title, folderPath = "") {
    return template
      .replaceAll("{{title}}", title)
      .replaceAll("{{date}}", new Date().toISOString().slice(0, 10))
      .replaceAll("{{folder}}", folderPath || "");
  }

  async function buildNewNoteContent(title, options = {}) {
    const folderPath = options.folderPath || "";
    const includeFrontmatter = options.includeFrontmatter ?? false;
    const defaultContent = includeFrontmatter
      ? `---\nstatus: ${options.defaultStatus || getDefaultStatus()}\ntags:\ndue:\nowner:\n---\n# ${title}\n`
      : `# ${title}\n`;
    const template = await api.getFolderTemplate(folderPath).catch(() => ({ content: "" }));
    if (!template.content?.trim()) {
      return defaultContent;
    }
    return applyTemplatePlaceholders(template.content, title, folderPath);
  }

  async function createMissingNote(rawTarget, options = {}) {
    const folderPath = options.folderPath || "";
    const openAfterCreate = options.openAfterCreate ?? false;
    const includeFrontmatter = options.includeFrontmatter ?? false;
    const path = deriveNotePath(rawTarget, folderPath);
    const title = normalizeTargetLabel(rawTarget);
    await api.createNode(path, "file");
    const content = await buildNewNoteContent(title, {
      folderPath,
      includeFrontmatter,
      defaultStatus: options.defaultStatus,
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

  async function loadDatabase(folderPath = "") {
    const payload = await api.getFolderDatabase(folderPath);
    setDatabase(payload);
  }

  async function loadDatabaseViewSettings(folderPath = "") {
    const payload = await api.getDatabaseViewSettings(folderPath);
    setDatabaseViewSettings(payload);
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
    api.saveUiState({ kind: "file", path }).catch(() => {});
    await loadBacklinks(path);
  }

  async function loadFolder(folderPath) {
    setSelectedFolderPath(folderPath);
    setSelectedPath("");
    setDocumentContent("");
    setPreviewHtml("");
    setBacklinks([]);
    setCollapsedHeadings(new Set());
    setViewMode("database");
    await Promise.all([loadDatabase(folderPath), loadDatabaseViewSettings(folderPath)]);
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

  async function saveDatabaseViewSettings(nextSettings) {
    setDatabaseViewSettings(nextSettings);
    await api.saveDatabaseViewSettings(selectedFolderPath, nextSettings);
  }

  async function createDatabaseNote() {
    const rawTitle = window.prompt("New note title");
    if (!rawTitle) {
      return;
    }
    const slug = rawTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "new-note";
    const folderPrefix = selectedFolderPath ? `${selectedFolderPath}/` : "";
    const path = `${folderPrefix}${slug}.md`;
    await api.createNode(path, "file");
    const starter = await buildNewNoteContent(rawTitle, {
      folderPath: selectedFolderPath,
      includeFrontmatter: true,
      defaultStatus: getDefaultStatus(),
    });
    await api.saveDocument(path, starter);
    await Promise.all([loadDatabase(selectedFolderPath), refreshTree()]);
    setStatusMessage(`Created ${path}`);
  }

  async function saveCurrentAsTemplate() {
    if (!selectedPath) {
      return;
    }
    const folderPath = containingFolder(selectedPath);
    await api.saveFolderTemplate(folderPath, documentContent);
    setStatusMessage(`Saved template for ${folderPath || "workspace"}`);
  }

  async function clearCurrentTemplate() {
    if (!selectedPath) {
      return;
    }
    const folderPath = containingFolder(selectedPath);
    await api.saveFolderTemplate(folderPath, "");
    setStatusMessage(`Cleared template for ${folderPath || "workspace"}`);
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
      await loadBacklinks(pathOverride);
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
    async function initializeApp() {
      try {
        await refreshTree();
        api.getOllamaSettings().then(setOllamaSettings).catch((error) => setStatusMessage(error.message));
        loadDatabase("").catch((error) => setStatusMessage(error.message));
        loadDatabaseViewSettings("").catch((error) => setStatusMessage(error.message));
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
    await api.createNode(path, targetType);
    await refreshTree(path);
    if (targetType === "file") {
      const title = normalizeTargetLabel(path);
      const folderPath = containingFolder(path);
      const starter = await buildNewNoteContent(title, { folderPath, includeFrontmatter: false });
      await api.saveDocument(path, starter);
      await loadDocument(path);
    }
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
      const payload = await api.promptOllama(`Summarize this markdown note:\n\n${documentContent}`);
      window.alert(payload.response || "No response from Ollama.");
    } catch (error) {
      setStatusMessage(error.message);
    }
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
          onCreateFile={() => promptAndCreate("file").catch((error) => setStatusMessage(error.message))}
          onCreateFolder={() => promptAndCreate("folder").catch((error) => setStatusMessage(error.message))}
          onQuickFind={() => setSearchOpen(true)}
          onRename={() => renameSelected().catch((error) => setStatusMessage(error.message))}
          onDelete={() => deleteSelected().catch((error) => setStatusMessage(error.message))}
          onSaveTemplate={() => saveCurrentAsTemplate().catch((error) => setStatusMessage(error.message))}
          onClearTemplate={() => clearCurrentTemplate().catch((error) => setStatusMessage(error.message))}
          onAttachFile={(file) => attachFileToCurrentNote(file).catch((error) => setStatusMessage(error.message))}
          ollamaSettings={ollamaSettings}
          onChangeOllama={updateOllamaSettings}
          ollamaHealth={ollamaHealth}
          onCheckOllama={checkOllama}
          onRunPrompt={runPrompt}
        />

        <WorkspacePanels
          workspaceRef={workspaceRef}
          workspaceStyle={workspaceStyle}
          dragState={dragState}
          startResize={startResize}
          tree={tree}
          selectedPath={selectedPath}
          selectedFolderPath={selectedFolderPath}
          viewMode={viewMode}
          blocks={blocks}
          collapsedHeadings={collapsedHeadings}
          backlinks={backlinks}
          database={database}
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
          onOpenNote={(path) => loadDocument(path).catch((error) => setStatusMessage(error.message))}
          onOpenRelation={(target) => openRelationTarget(target).catch((error) => setStatusMessage(error.message))}
          onCreateRelation={(target) => createMissingRelationTarget(target).catch((error) => setStatusMessage(error.message))}
          onSaveDatabaseField={(path, column, value) => saveDatabaseField(path, column, value).catch((error) => setStatusMessage(error.message))}
          onChangeDatabaseViewSettings={(settings) => saveDatabaseViewSettings(settings).catch((error) => setStatusMessage(error.message))}
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
      </main>
    </>
  );
}
