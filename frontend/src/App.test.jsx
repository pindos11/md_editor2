import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, test, expect, vi } from "vitest";
import { App } from "./App";

async function openWorkspaceMenu() {
  fireEvent.click(await screen.findByRole("button", { name: "Menu" }));
}

const { apiMock, defaultViewSettings, defaultPromptPresets, mermaidMock, highlightMock } = vi.hoisted(() => {
  const defaultViewSettings = {
    filter_text: "",
    sort_by: "title",
    sort_direction: "asc",
    view_mode: "table",
    status_options: ["backlog", "active", "in-progress", "paused", "done"],
    visible_columns: []
  };
  const defaultPromptPresets = [
    "Summarize the current note into 3-6 concise bullets. Focus on actionable points, decisions, and follow-ups.",
    "Extract action items from the current note as a short checklist.",
    "Rewrite the current note for clarity while preserving the meaning.",
    "List open questions or ambiguities in the current note.",
  ];

  return {
    defaultViewSettings,
    defaultPromptPresets,
    mermaidMock: {
      initialize: vi.fn(),
      run: vi.fn().mockResolvedValue(undefined)
    },
    highlightMock: {
      highlightElement: vi.fn()
    },
    apiMock: {
      getTree: vi.fn().mockResolvedValue([
        { path: "note.md", name: "note.md", node_type: "file", children: [] },
        { path: "project.md", name: "project.md", node_type: "file", children: [] }
      ]),
      getDocument: vi.fn().mockImplementation((path) => {
        if (path === "projects/roadmap.md") {
          return Promise.resolve({
            path: "projects/roadmap.md",
            content: "---\nstatus: active\nowner: andrei\n---\n# Roadmap",
            html: "<h1>Roadmap</h1>",
            frontmatter: { status: "active", owner: "andrei" }
          });
        }
        return Promise.resolve({ path: "note.md", content: "# hi", html: "<h1>hi</h1>" });
      }),
      saveDocument: vi.fn().mockImplementation((path, content) =>
        Promise.resolve({ path, content, html: "<h1>saved</h1>" })
      ),
      createNode: vi.fn().mockResolvedValue({ status: "created" }),
      moveNode: vi.fn().mockResolvedValue({ status: "moved" }),
      deleteNode: vi.fn().mockResolvedValue({ status: "deleted" }),
      searchNotes: vi.fn().mockResolvedValue([{ path: "note.md", name: "note.md", snippet: "snippet" }]),
      getBacklinks: vi.fn().mockResolvedValue([{ path: "related.md", name: "related.md", excerpt: "links back" }]),
      getFolderTemplate: vi.fn().mockResolvedValue({ folder_path: "", content: "" }),
      saveFolderTemplate: vi.fn().mockResolvedValue({ folder_path: "", content: "" }),
      getTemplateCollection: vi.fn().mockResolvedValue({ folder_path: "", templates: [] }),
      saveTemplateCollection: vi.fn().mockImplementation((_path, payload) => Promise.resolve(payload)),
      getNoteHistory: vi.fn().mockResolvedValue({ path: "note.md", snapshots: [] }),
      restoreNoteSnapshot: vi.fn().mockResolvedValue({ path: "note.md", content: "# restored", html: "<h1>restored</h1>" }),
      uploadAttachment: vi.fn().mockResolvedValue({ name: "image.png", path: "note/image.png", url: "/workspace-assets/note/image.png" }),
      getUiState: vi.fn().mockResolvedValue({ kind: "none", path: "" }),
      saveUiState: vi.fn().mockResolvedValue({ kind: "none", path: "" }),
      getFolderDatabase: vi.fn().mockResolvedValue({
        folder_path: "projects",
        columns: ["status", "owner"],
        notes: [
          {
            path: "projects/roadmap.md",
            name: "roadmap.md",
            title: "Roadmap",
            frontmatter: { status: "active", owner: "andrei" }
          }
        ]
      }),
      getDatabaseViewSettings: vi.fn().mockResolvedValue(defaultViewSettings),
      saveDatabaseViewSettings: vi.fn().mockResolvedValue(defaultViewSettings),
      getDatabaseViews: vi.fn().mockResolvedValue({
        folder_path: "projects",
        active_view_id: "default",
        views: [{ view_id: "default", name: "Default", settings: defaultViewSettings }]
      }),
      saveDatabaseViews: vi.fn().mockImplementation((_path, views) => Promise.resolve(views)),
      getOllamaSettings: vi.fn().mockResolvedValue({ base_url: "http://127.0.0.1:11434", model: "llama3.2", think: false, prompt_presets: defaultPromptPresets }),
      saveOllamaSettings: vi.fn().mockResolvedValue({}),
      getOllamaHealth: vi.fn().mockResolvedValue({ status: "ok", model: "llama3.2" }),
      promptOllama: vi.fn().mockResolvedValue({ response: "Summary" })
    }
  };
});

vi.mock("./api", () => ({ api: apiMock }));
vi.mock("mermaid", () => ({ default: mermaidMock }));
vi.mock("highlight.js/lib/common", () => ({ default: highlightMock }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  apiMock.getTree.mockResolvedValue([
    { path: "note.md", name: "note.md", node_type: "file", children: [] },
    { path: "project.md", name: "project.md", node_type: "file", children: [] }
  ]);
  apiMock.searchNotes.mockResolvedValue([{ path: "note.md", name: "note.md", snippet: "snippet" }]);
  apiMock.getBacklinks.mockResolvedValue([{ path: "related.md", name: "related.md", excerpt: "links back" }]);
  apiMock.getFolderTemplate.mockResolvedValue({ folder_path: "", content: "" });
  apiMock.saveFolderTemplate.mockResolvedValue({ folder_path: "", content: "" });
  apiMock.getTemplateCollection.mockResolvedValue({ folder_path: "", templates: [] });
  apiMock.saveTemplateCollection.mockImplementation((_path, payload) => Promise.resolve(payload));
  apiMock.getNoteHistory.mockResolvedValue({ path: "note.md", snapshots: [] });
  apiMock.restoreNoteSnapshot.mockResolvedValue({ path: "note.md", content: "# restored", html: "<h1>restored</h1>" });
  apiMock.uploadAttachment.mockResolvedValue({ name: "image.png", path: "note/image.png", url: "/workspace-assets/note/image.png" });
  apiMock.getUiState.mockResolvedValue({ kind: "none", path: "" });
  apiMock.saveUiState.mockResolvedValue({ kind: "none", path: "" });
  apiMock.getDocument.mockImplementation((path) => {
    if (path === "projects/roadmap.md") {
      return Promise.resolve({
        path: "projects/roadmap.md",
        content: "---\nstatus: active\nowner: andrei\n---\n# Roadmap",
        html: "<h1>Roadmap</h1>",
        frontmatter: { status: "active", owner: "andrei" }
      });
    }
    return Promise.resolve({ path: "note.md", content: "# hi", html: "<h1>hi</h1>" });
  });
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status", "owner"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "active", owner: "andrei" }
      }
    ]
  });
  apiMock.getDatabaseViewSettings.mockResolvedValue(defaultViewSettings);
  apiMock.saveDatabaseViewSettings.mockResolvedValue(defaultViewSettings);
  apiMock.getDatabaseViews.mockResolvedValue({
    folder_path: "projects",
    active_view_id: "default",
    views: [{ view_id: "default", name: "Default", settings: defaultViewSettings }]
  });
  apiMock.getOllamaSettings.mockResolvedValue({ base_url: "http://127.0.0.1:11434", model: "llama3.2", think: false, prompt_presets: defaultPromptPresets });
  apiMock.saveDatabaseViews.mockImplementation((_path, views) => Promise.resolve(views));
  mermaidMock.initialize.mockClear();
  mermaidMock.run.mockClear();
  highlightMock.highlightElement.mockClear();
});

test("loads the tree and edits a selected document", async () => {
  render(<App />);
  const treeButton = await screen.findByRole("button", { name: /note.md/i });
  fireEvent.click(treeButton);
  const editor = await screen.findByLabelText("Markdown editor");
  fireEvent.change(editor, { target: { value: "# edit", selectionStart: 6 } });
  await waitFor(() => expect(screen.getByText("Saved note.md")).toBeInTheDocument());
  expect(screen.getByText("saved")).toBeInTheDocument();
  expect(screen.getByText(/related.md/i)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Blocks" })).toBeInTheDocument();
  await waitFor(() => expect(apiMock.saveUiState).toHaveBeenCalledWith({ kind: "file", path: "note.md" }));
});

test("shows Ollama response in the toolbar and inserts it into the note", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /note.md/i }));
  await screen.findByLabelText("Markdown editor");
  fireEvent.click(screen.getByRole("button", { name: "Ollama" }));
  expect(screen.getByLabelText(/Enable thinking/i)).not.toBeChecked();
  const promptBox = screen.getByPlaceholderText(/Prompt or instruction for the current note/i);
  fireEvent.change(promptBox, { target: { value: "Summarize in one sentence." } });
  fireEvent.click(screen.getByRole("button", { name: "Run on note" }));
  await waitFor(() =>
    expect(apiMock.promptOllama).toHaveBeenCalledWith(expect.stringContaining("Summarize in one sentence."))
  );
  expect(await screen.findByDisplayValue("Summary")).toBeInTheDocument();
  expect(screen.getByText("Response for: note.md")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Insert into note" }));
  const editor = await screen.findByLabelText("Markdown editor");
  expect(editor.value).toContain("## AI Notes");
  expect(editor.value).toContain("Summary");
});

test("allows choosing a preset prompt for Ollama", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /note.md/i }));
  await screen.findByLabelText("Markdown editor");
  fireEvent.click(screen.getByRole("button", { name: "Ollama" }));
  const presetSelect = screen.getByRole("combobox", { name: "Preset prompt" });
  fireEvent.change(presetSelect, { target: { value: "Extract action items from the current note as a short checklist." } });
  fireEvent.click(screen.getByRole("button", { name: "Run on note" }));
  await waitFor(() =>
    expect(apiMock.promptOllama).toHaveBeenCalledWith(expect.stringContaining("Extract action items from the current note as a short checklist."))
  );
});

test("restores the last open file on startup", async () => {
  apiMock.getUiState.mockResolvedValue({ kind: "file", path: "note.md" });
  render(<App />);
  expect(await screen.findByLabelText("Markdown editor")).toHaveValue("# hi");
  await waitFor(() => expect(apiMock.getDocument).toHaveBeenCalledWith("note.md"));
});

test("restores the last open folder on startup", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getUiState.mockResolvedValue({ kind: "folder", path: "projects" });
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Database" })).toBeInTheDocument();
  expect(await screen.findByText("Roadmap")).toBeInTheDocument();
  await waitFor(() => expect(apiMock.getFolderDatabase).toHaveBeenCalledWith("projects"));
});

test("does not render frontmatter in preview", async () => {
  apiMock.getDocument.mockResolvedValueOnce({
    path: "note.md",
    content: "---\nstatus: active\n---\n# Hello",
    html: "<h1>Hello</h1>",
    frontmatter: { status: "active" }
  });
  render(<App />);
  const treeButton = await screen.findByRole("button", { name: /note.md/i });
  fireEvent.click(treeButton);
  expect(await screen.findByText("Hello")).toBeInTheDocument();
  const preview = document.querySelector(".preview");
  expect(preview).not.toBeNull();
  expect(within(preview).queryByText(/status: active/i)).not.toBeInTheDocument();
});

test("renders mermaid diagrams from fenced code blocks in preview", async () => {
  apiMock.getDocument.mockResolvedValueOnce({
    path: "note.md",
    content: "```mermaid\ngraph TD\nA-->B\n```",
    html: "<pre><code class=\"language-mermaid\">graph TD\nA--&gt;B\n</code></pre>",
    frontmatter: {}
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /note.md/i }));
  await waitFor(() => expect(mermaidMock.run).toHaveBeenCalled());
  expect(document.querySelector(".preview .mermaid")).not.toBeNull();
});

test("highlights named code blocks in preview", async () => {
  apiMock.getDocument.mockResolvedValueOnce({
    path: "note.md",
    content: "```python\nprint('hi')\n```",
    html: "<pre><code class=\"language-python\">print('hi')</code></pre>",
    frontmatter: {}
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /note.md/i }));
  await waitFor(() => expect(highlightMock.highlightElement).toHaveBeenCalled());
});

test("opens quick find and shows results", async () => {
  render(<App />);
  await openWorkspaceMenu();
  fireEvent.click(await screen.findByRole("button", { name: /quick find/i }));
  const searchInput = await screen.findByPlaceholderText(/search by title or content/i);
  fireEvent.change(searchInput, { target: { value: "no" } });
  await waitFor(() => expect(apiMock.searchNotes).toHaveBeenCalledWith("no"));
  expect(await screen.findByText("snippet")).toBeInTheDocument();
});

test("shows wiki-link suggestions while typing", async () => {
  render(<App />);
  const treeButton = (await screen.findAllByRole("button", { name: /note\.md/i }))[0];
  fireEvent.click(treeButton);
  const editor = await screen.findByLabelText("Markdown editor");
  fireEvent.change(editor, { target: { value: "[[pro", selectionStart: 5 } });
  expect((await screen.findAllByRole("button", { name: /project/i })).length).toBeGreaterThan(0);
});

test("opens a folder database view", async () => {
  apiMock.getTree.mockResolvedValue([
    { path: "projects", name: "projects", node_type: "folder", children: [] },
    { path: "note.md", name: "note.md", node_type: "file", children: [] }
  ]);
  render(<App />);
  const folderButton = await screen.findByRole("button", { name: /projects/i });
  fireEvent.click(folderButton);
  expect(await screen.findByRole("heading", { name: "Database" })).toBeInTheDocument();
  expect(await screen.findByText("Roadmap")).toBeInTheDocument();
  expect(apiMock.getFolderDatabase).toHaveBeenCalledWith("projects");
  expect(apiMock.getDatabaseViews).toHaveBeenCalledWith("projects");
});

test("prefills new note prompt from the selected folder and appends .md automatically", async () => {
  apiMock.getTree.mockResolvedValue([
    { path: "projects", name: "projects", node_type: "folder", children: [] }
  ]);
  globalThis.prompt = vi.fn().mockReturnValue("projects/new-idea");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  await openWorkspaceMenu();
  fireEvent.click(screen.getByRole("button", { name: "New note" }));
  expect(globalThis.prompt).toHaveBeenCalledWith("Enter note path, e.g. ideas/new-note.md", "projects/");
  await waitFor(() => expect(apiMock.createNode).toHaveBeenCalledWith("projects/new-idea.md", "file"));
  expect(apiMock.saveDocument).toHaveBeenCalledWith("projects/new-idea.md", expect.stringContaining("# new idea"));
});

test("prefills new note prompt from the selected file folder", async () => {
  apiMock.getTree.mockResolvedValue([
    { path: "notes/source.md", name: "source.md", node_type: "file", children: [] }
  ]);
  globalThis.prompt = vi.fn().mockReturnValue("notes/follow-up.md");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /source\.md/i }));
  await waitFor(() => expect(apiMock.getDocument).toHaveBeenCalledWith("notes/source.md"));
  await openWorkspaceMenu();
  fireEvent.click(screen.getByRole("button", { name: "New note" }));
  expect(globalThis.prompt).toHaveBeenCalledWith("Enter note path, e.g. ideas/new-note.md", "notes/");
});

test("collapses and expands folders in the tree", async () => {
  apiMock.getTree.mockResolvedValue([
    {
      path: "projects",
      name: "projects",
      node_type: "folder",
      children: [{ path: "projects/roadmap.md", name: "roadmap.md", node_type: "file", children: [] }]
    }
  ]);
  render(<App />);
  await screen.findByRole("button", { name: /projects/i });
  expect(screen.queryByRole("button", { name: /roadmap\.md/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Expand folder" }));
  expect(await screen.findByRole("button", { name: /roadmap\.md/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse folder" }));
  expect(screen.queryByRole("button", { name: /roadmap\.md/i })).not.toBeInTheDocument();
});

test("selecting one folder does not expand unrelated folders", async () => {
  const tree = [
    {
      path: "projects",
      name: "projects",
      node_type: "folder",
      children: [{ path: "projects/roadmap.md", name: "roadmap.md", node_type: "file", children: [] }]
    },
    {
      path: "archive",
      name: "archive",
      node_type: "folder",
      children: [{ path: "archive/old.md", name: "old.md", node_type: "file", children: [] }]
    }
  ];
  apiMock.getTree.mockResolvedValue(tree);
  const { unmount } = render(<App />);
  const folderButtons = await screen.findAllByRole("button", { name: /projects|archive/i });
  fireEvent.click(folderButtons.find((button) => button.textContent === "projects"));
  expect(await screen.findByRole("heading", { name: "Database" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: /roadmap\.md/i })).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /old\.md/i })).not.toBeInTheDocument();
  unmount();
});

test("restores persisted open folders from localStorage", async () => {
  apiMock.getTree.mockResolvedValue([
    {
      path: "projects",
      name: "projects",
      node_type: "folder",
      children: [{ path: "projects/roadmap.md", name: "roadmap.md", node_type: "file", children: [] }]
    },
    {
      path: "archive",
      name: "archive",
      node_type: "folder",
      children: [{ path: "archive/old.md", name: "old.md", node_type: "file", children: [] }]
    }
  ]);
  window.localStorage.setItem("md-editor2:open-folders", JSON.stringify(["projects"]));
  render(<App />);
  await screen.findAllByRole("button", { name: /projects|archive/i });
  await waitFor(() => expect(screen.getByRole("button", { name: /roadmap\.md/i })).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /old\.md/i })).not.toBeInTheDocument();
});

test("shows resizers for the main workspace panes", async () => {
  render(<App />);
  expect(await screen.findByRole("button", { name: "Resize sidebar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resize preview" })).toBeInTheDocument();
});

test("loads persisted pane widths from localStorage", async () => {
  window.localStorage.setItem("md-editor2:pane-sizes", JSON.stringify({ left: 360, right: 500 }));
  render(<App />);
  await screen.findByRole("button", { name: "Resize sidebar" });
  const workspace = document.querySelector(".workspace.enhanced");
  expect(workspace).not.toBeNull();
  expect(workspace.style.gridTemplateColumns).toContain("360px");
  expect(workspace.style.gridTemplateColumns).toContain("500px");
});

test("loads persisted pane widths for the selected item and keeps them for new items", async () => {
  window.localStorage.setItem("md-editor2:pane-sizes", JSON.stringify({
    "__global__": { left: 320, right: 420 },
    "note.md": { left: 380, right: 540 }
  }));
  apiMock.getUiState.mockResolvedValue({ kind: "file", path: "note.md" });
  render(<App />);
  await screen.findByLabelText("Markdown editor");
  const workspace = document.querySelector(".workspace.enhanced");
  expect(workspace.style.gridTemplateColumns).toContain("380px");
  expect(workspace.style.gridTemplateColumns).toContain("540px");
  fireEvent.click(await screen.findByRole("button", { name: /project\.md/i }));
  await waitFor(() => expect(apiMock.getDocument).toHaveBeenCalledWith("project.md"));
  expect(workspace.style.gridTemplateColumns).toContain("380px");
  expect(workspace.style.gridTemplateColumns).toContain("540px");
});

test("persists and restores workspace scale", async () => {
  window.localStorage.setItem("md-editor2:ui-scale", "115");
  render(<App />);
  await screen.findByRole("button", { name: "Menu" });
  const workspace = document.querySelector(".workspace.enhanced");
  expect(workspace.style.getPropertyValue("--workspace-ui-scale")).toBe("1.15");
  await openWorkspaceMenu();
  const scaleInput = screen.getByRole("slider", { name: "Scale" });
  fireEvent.change(scaleInput, { target: { value: "105" } });
  await waitFor(() => expect(window.localStorage.getItem("md-editor2:ui-scale")).toBe("105"));
});

test("saves inline database edits", async () => {
  apiMock.getTree.mockResolvedValue([
    { path: "projects", name: "projects", node_type: "folder", children: [] }
  ]);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const statusInput = await screen.findByDisplayValue("active");
  fireEvent.change(statusInput, { target: { value: "paused" } });
  fireEvent.blur(statusInput);
  await waitFor(() => expect(apiMock.saveDocument).toHaveBeenCalled());
  const [, savedContent] = apiMock.saveDocument.mock.calls.at(-1);
  expect(savedContent).toContain("status: paused");
  expect(apiMock.getFolderDatabase).toHaveBeenCalledWith("projects");
});

test("renders created and updated fields as datetime editors", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["created", "updated"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { created: "2026-03-25T12:30", updated: "2026-03-25T12:45" }
      }
    ]
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const createdInput = await screen.findByDisplayValue("2026-03-25T12:30");
  const updatedInput = await screen.findByDisplayValue("2026-03-25T12:45");
  expect(createdInput).toHaveAttribute("type", "datetime-local");
  expect(updatedInput).toHaveAttribute("type", "datetime-local");
});

test("renders exported UTC timestamps in datetime editors", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["created", "updated"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { created: "2025-09-23 20:45:54Z", updated: "2025-09-23 20:45:54Z" }
      }
    ]
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  expect(await screen.findAllByDisplayValue("2025-09-23T20:45")).toHaveLength(2);
});

test("clamps very long generated titles in database tables", async () => {
  const veryLongTitle = "https://example.com/" + "a".repeat(140);
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: veryLongTitle,
        frontmatter: { status: "active" }
      }
    ]
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const titleButton = await screen.findByRole("button", { name: /https:\/\/example\.com\//i });
  expect(titleButton.textContent.length).toBeLessThan(veryLongTitle.length);
});

test("does not save unchanged inline database cells on blur", async () => {
  apiMock.getTree.mockResolvedValue([
    { path: "projects", name: "projects", node_type: "folder", children: [] }
  ]);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const statusInput = await screen.findByDisplayValue("active");
  fireEvent.focus(statusInput);
  fireEvent.blur(statusInput);
  await waitFor(() => expect(apiMock.saveDocument).not.toHaveBeenCalled());
});

test("supports multiple named database views per folder", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status", "owner", "due"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "active", owner: "andrei", due: "2026-03-25" }
      }
    ]
  });
  apiMock.getDatabaseViews.mockResolvedValue({
    folder_path: "projects",
    active_view_id: "planning",
    views: [
      {
        view_id: "planning",
        name: "Planning",
        settings: { ...defaultViewSettings, visible_columns: ["status", "owner"] }
      },
      {
        view_id: "delivery",
        name: "Delivery",
        settings: { ...defaultViewSettings, visible_columns: ["status", "due"], view_mode: "board" }
      }
    ]
  });
  globalThis.prompt = vi.fn()
    .mockReturnValueOnce("Ops")
    .mockReturnValueOnce("Delivery Board");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
    const viewSelect = await screen.findByLabelText("View");
  expect(viewSelect).toHaveValue("planning");
  fireEvent.change(viewSelect, { target: { value: "delivery" } });
  await waitFor(() =>
    expect(apiMock.saveDatabaseViews).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({ active_view_id: "delivery" })
    )
  );
  fireEvent.click(screen.getByRole("button", { name: "Save as new view" }));
  await waitFor(() =>
    expect(apiMock.saveDatabaseViews).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        views: expect.arrayContaining([expect.objectContaining({ name: "Ops" })])
      })
    )
  );
  fireEvent.click(screen.getByRole("button", { name: "Rename view" }));
  await waitFor(() =>
    expect(apiMock.saveDatabaseViews).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        views: expect.arrayContaining([expect.objectContaining({ name: "Delivery Board" })])
      })
    )
  );
});

test("persists database filter settings and creates notes", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  globalThis.prompt = vi.fn().mockReturnValue("Sprint Plan");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const filterInput = await screen.findByPlaceholderText(/filter by title or field value/i);
  fireEvent.change(filterInput, { target: { value: "road" } });
  await waitFor(() => expect(apiMock.saveDatabaseViews).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "New Note" }));
  await waitFor(() => expect(apiMock.createNode).toHaveBeenCalledWith("projects/sprint-plan.md", "file"));
  expect(apiMock.saveDocument).toHaveBeenCalledWith("projects/sprint-plan.md", expect.stringContaining("# Sprint Plan"));
  await waitFor(() => expect(apiMock.getTree).toHaveBeenCalledTimes(2));
});

test("uses folder template for new database notes", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getTemplateCollection.mockResolvedValue({
    folder_path: "projects",
    templates: [
      { template_id: "default", name: "Default", content: "# {{title}}\nCreated: {{date}}\nFolder: {{folder}}\n", is_default: true }
    ]
  });
  globalThis.prompt = vi.fn().mockReturnValue("Sprint Plan");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  fireEvent.click(screen.getByRole("button", { name: "New Note" }));
  fireEvent.click(await screen.findByRole("button", { name: "Create note" }));
  await waitFor(() => expect(apiMock.createNode).toHaveBeenCalledWith("projects/sprint-plan.md", "file"));
  expect(apiMock.saveDocument).toHaveBeenCalledWith(
    "projects/sprint-plan.md",
    expect.stringContaining("# Sprint Plan")
  );
  expect(apiMock.saveDocument.mock.calls.at(-1)[1]).toContain("Folder: projects");
});

test("uploads attachment and inserts markdown link into the editor", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /note.md/i }));
  await screen.findByLabelText("Markdown editor");
  const fileInput = document.querySelector('input[type="file"]');
  const file = new File(["png-data"], "image.png", { type: "image/png" });
  fireEvent.change(fileInput, { target: { files: [file] } });
  await waitFor(() => expect(apiMock.uploadAttachment).toHaveBeenCalledWith("note.md", file));
  await waitFor(async () => {
    const editor = await screen.findByLabelText("Markdown editor");
    expect(editor.value).toContain("![image.png](/workspace-assets/note/image.png)");
  });
});

test("pastes image attachments into the editor", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /note.md/i }));
  const editor = await screen.findByLabelText("Markdown editor");
  const file = new File(["png-data"], "paste.png", { type: "image/png" });
  fireEvent.paste(editor, { clipboardData: { files: [file] } });
  await waitFor(() => expect(apiMock.uploadAttachment).toHaveBeenCalledWith("note.md", file));
  expect(editor.value).toContain("![image.png](/workspace-assets/note/image.png)");
});

test("drops file attachments into the editor", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /note.md/i }));
  const editor = await screen.findByLabelText("Markdown editor");
  const file = new File(["pdf-data"], "spec.pdf", { type: "application/pdf" });
  apiMock.uploadAttachment.mockResolvedValueOnce({
    name: "spec.pdf",
    path: "note/spec.pdf",
    url: "/workspace-assets/note/spec.pdf"
  });
  fireEvent.drop(editor, { dataTransfer: { files: [file] } });
  await waitFor(() => expect(apiMock.uploadAttachment).toHaveBeenCalledWith("note.md", file));
  expect(editor.value).toContain("[spec.pdf](/workspace-assets/note/spec.pdf)");
});

test("manages templates for the current folder", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "notes/source.md", name: "source.md", node_type: "file", children: [] }]);
  apiMock.getDocument.mockResolvedValue({
    path: "notes/source.md",
    content: "# Source\nBody",
    html: "<h1>Source</h1><p>Body</p>",
    frontmatter: {}
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /source\.md/i }));
  await openWorkspaceMenu();
  fireEvent.click(await screen.findByRole("button", { name: "Manage templates" }));
  const namePrompt = vi.spyOn(globalThis, "prompt").mockReturnValueOnce("Source Template");
  fireEvent.click(await screen.findByRole("button", { name: "Save current as new" }));
  namePrompt.mockRestore();
  fireEvent.click(await screen.findByRole("button", { name: "Save templates" }));
  await waitFor(() => expect(apiMock.saveTemplateCollection).toHaveBeenCalledWith(
    "notes",
    expect.objectContaining({
      templates: [expect.objectContaining({ name: "Source Template", content: "# Source\nBody" })]
    })
  ));
});

test("clears the current folder template", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "notes/source.md", name: "source.md", node_type: "file", children: [] }]);
  apiMock.getDocument.mockResolvedValue({
    path: "notes/source.md",
    content: "# Source\nBody",
    html: "<h1>Source</h1><p>Body</p>",
    frontmatter: {}
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /source\.md/i }));
  await openWorkspaceMenu();
  fireEvent.click(await screen.findByRole("button", { name: "Clear template" }));
  await waitFor(() => expect(apiMock.saveFolderTemplate).toHaveBeenCalledWith("notes", ""));
});

test("uses per-folder status options and visible columns", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status", "owner", "due"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "queued", owner: "andrei", due: "2026-03-25" }
      }
    ]
  });
  apiMock.getDatabaseViews.mockResolvedValue({
    folder_path: "projects",
    active_view_id: "default",
    views: [{
      view_id: "default",
      name: "Default",
      settings: {
        ...defaultViewSettings,
        status_options: ["queued", "doing", "done"],
        visible_columns: ["status", "owner"],
        view_mode: "board"
      }
    }]
  });
  globalThis.prompt = vi.fn().mockReturnValue("Launch Plan");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  expect(await screen.findByRole("heading", { name: "queued" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "doing" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "done" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Table" }));
  expect(await screen.findByRole("button", { name: "owner" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "due" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "New Note" }));
  await waitFor(() =>
    expect(apiMock.saveDocument).toHaveBeenCalledWith("projects/launch-plan.md", expect.stringContaining("status: queued"))
  );
});

test("persists visible column and status option changes", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status", "owner", "due"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "active", owner: "andrei", due: "2026-03-25" }
      }
    ]
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const statusOptionsInput = await screen.findByDisplayValue("backlog, active, in-progress, paused, done");
  fireEvent.change(statusOptionsInput, { target: { value: "queued, doing, done" } });
  fireEvent.blur(statusOptionsInput);
  await waitFor(() =>
    expect(apiMock.saveDatabaseViews).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        views: [expect.objectContaining({ settings: expect.objectContaining({ status_options: ["queued", "doing", "done"] }) })]
      })
    )
  );
  fireEvent.click(screen.getByLabelText("due"));
  await waitFor(() =>
    expect(apiMock.saveDatabaseViews).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        views: [expect.objectContaining({ settings: expect.objectContaining({ visible_columns: ["status", "owner"] }) })]
      })
    )
  );
});

test("status options input keeps in-progress punctuation until blur", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status", "owner"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "active", owner: "andrei" }
      }
    ]
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const statusOptionsInput = await screen.findByDisplayValue("backlog, active, in-progress, paused, done");
  fireEvent.change(statusOptionsInput, { target: { value: "queued, " } });
  expect(statusOptionsInput).toHaveValue("queued, ");
  expect(apiMock.saveDatabaseViews).not.toHaveBeenCalledWith(
    "projects",
    expect.objectContaining({
      views: [expect.objectContaining({ settings: expect.objectContaining({ status_options: ["queued"] }) })]
    })
  );
  fireEvent.blur(statusOptionsInput);
  await waitFor(() =>
    expect(apiMock.saveDatabaseViews).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        views: [expect.objectContaining({ settings: expect.objectContaining({ status_options: ["queued"] }) })]
      })
    )
  );
});

test("switches database to board mode and groups notes by status", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status", "owner", "due"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "active", owner: "andrei", due: "2026-03-25" }
      },
      {
        path: "projects/release.md",
        name: "release.md",
        title: "Release",
        frontmatter: { status: "done", owner: "vika" }
      }
    ]
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Board" }));
  await waitFor(() =>
    expect(apiMock.saveDatabaseViews).toHaveBeenCalledWith(
      "projects",
      expect.objectContaining({
        views: [expect.objectContaining({ settings: expect.objectContaining({ view_mode: "board" }) })]
      })
    )
  );
  expect(await screen.findByRole("heading", { name: "active" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "done" })).toBeInTheDocument();
  expect(screen.getByText("Roadmap")).toBeInTheDocument();
  expect(screen.getByText("Release")).toBeInTheDocument();
});

test("board status changes save immediately without blur", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status", "owner"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "backlog", owner: "andrei" }
      }
    ]
  });
  apiMock.getDocument.mockResolvedValue({
    path: "projects/roadmap.md",
    content: "---\nstatus: backlog\nowner: andrei\n---\n# Roadmap",
    html: "<h1>Roadmap</h1>",
    frontmatter: { status: "backlog", owner: "andrei" }
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Board" }));
  const statusInput = await screen.findByDisplayValue("backlog");
  fireEvent.change(statusInput, { target: { value: "" } });
  await waitFor(() => expect(apiMock.saveDocument).toHaveBeenCalled());
  const [, savedContent] = apiMock.saveDocument.mock.calls.at(-1);
  expect(savedContent).not.toContain("status: backlog");
});

test("drags a board card to another status column", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "backlog" }
      }
    ]
  });
  apiMock.getDocument.mockResolvedValue({
    path: "projects/roadmap.md",
    content: "---\nstatus: backlog\n---\n# Roadmap",
    html: "<h1>Roadmap</h1>",
    frontmatter: { status: "backlog" }
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Board" }));
  const card = await screen.findByRole("button", { name: "Roadmap" });
  const doneColumn = screen.getByRole("heading", { name: "done" }).closest(".board-column");
  fireEvent.dragStart(card.closest(".board-card"));
  fireEvent.dragOver(doneColumn.querySelector(".board-card-list"));
  fireEvent.drop(doneColumn.querySelector(".board-card-list"), {
    dataTransfer: {
      getData: () => "projects/roadmap.md"
    }
  });
  await waitFor(() => expect(apiMock.saveDocument).toHaveBeenCalled());
  expect(apiMock.saveDocument.mock.calls.at(-1)[1]).toContain("status: done");
});

test("loads note history and restores a snapshot", async () => {
  apiMock.getNoteHistory.mockResolvedValue({
    path: "note.md",
    snapshots: [
      { snapshot_id: "snap-1", path: "note.md", created_at: "2026-03-25T10:00:00Z", title: "Older", content: "# Older" }
    ]
  });
  apiMock.restoreNoteSnapshot.mockResolvedValue({
    path: "note.md",
    content: "# Older",
    html: "<h1>Older</h1>",
    frontmatter: {}
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /note\.md/i }));
  expect(screen.queryByText(/Older/)).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "Expand" }));
  expect(await screen.findByText(/Older/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(apiMock.restoreNoteSnapshot).toHaveBeenCalledWith("note.md", "snap-1"));
  expect(await screen.findByLabelText("Markdown editor")).toHaveValue("# Older");
});

test("relation fields save as lists and open linked notes", async () => {
  apiMock.getTree.mockResolvedValue([
    { path: "projects", name: "projects", node_type: "folder", children: [] },
    { path: "note.md", name: "note.md", node_type: "file", children: [] },
    { path: "project.md", name: "project.md", node_type: "file", children: [] }
  ]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["status", "related"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { status: "active", related: ["project", "note"] }
      }
    ]
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  expect(await screen.findByRole("button", { name: "project" })).toBeInTheDocument();
  const relatedInput = await screen.findByDisplayValue("project, note");
  fireEvent.change(relatedInput, { target: { value: "project, note" } });
  fireEvent.blur(relatedInput);
  fireEvent.click(screen.getByRole("button", { name: "project" }));
  await waitFor(() => expect(apiMock.getDocument).toHaveBeenCalledWith("project.md"));
});

test("relation fields show autocomplete suggestions from workspace notes", async () => {
  apiMock.getTree.mockResolvedValue([
    { path: "projects", name: "projects", node_type: "folder", children: [] },
    { path: "project-alpha.md", name: "project-alpha.md", node_type: "file", children: [] },
    { path: "project-beta.md", name: "project-beta.md", node_type: "file", children: [] }
  ]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["related"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { related: [] }
      }
    ]
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const relatedInput = (await screen.findAllByPlaceholderText("comma, separated"))[0];
  fireEvent.focus(relatedInput);
  fireEvent.change(relatedInput, { target: { value: "pro" } });
  expect(await screen.findByRole("button", { name: "project-alpha" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "project-alpha" }));
  expect(relatedInput).toHaveValue("project-alpha");
});

test("creates a missing relation note from the relation field", async () => {
  apiMock.getTree.mockResolvedValue([{ path: "projects", name: "projects", node_type: "folder", children: [] }]);
  apiMock.getFolderDatabase.mockResolvedValue({
    folder_path: "projects",
    columns: ["related"],
    notes: [
      {
        path: "projects/roadmap.md",
        name: "roadmap.md",
        title: "Roadmap",
        frontmatter: { related: [] }
      }
    ]
  });
  apiMock.getDocument.mockResolvedValue({
    path: "projects/roadmap.md",
    content: "# Roadmap",
    html: "<h1>Roadmap</h1>",
    frontmatter: {}
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /projects/i }));
  const relatedInput = (await screen.findAllByPlaceholderText("comma, separated"))[0];
  fireEvent.focus(relatedInput);
  fireEvent.change(relatedInput, { target: { value: "Missing Relation" } });
  fireEvent.click(await screen.findByRole("button", { name: 'Create "Missing Relation"' }));
  await waitFor(() => expect(apiMock.createNode).toHaveBeenCalledWith("projects/missing-relation.md", "file"));
  expect(apiMock.saveDocument).toHaveBeenCalledWith("projects/missing-relation.md", expect.stringContaining("# Missing Relation"));
  const lastCall = apiMock.saveDocument.mock.calls.at(-1);
  expect(lastCall[0]).toBe("projects/roadmap.md");
  expect(lastCall[1]).toContain("related:");
  expect(lastCall[1]).toContain("- missing-relation");
});

test("creates a missing wiki-link note when opening an unknown target", async () => {
  globalThis.confirm = vi.fn().mockReturnValue(true);
  apiMock.getDocument.mockResolvedValueOnce({
    path: "notes/source.md",
    content: "[[Missing Wiki]]",
    html: '<p><a href="#" data-wikilink="Missing%20Wiki">Missing Wiki</a></p>',
    frontmatter: {}
  });
  apiMock.getDocument.mockImplementation((path) => {
    if (path === "notes/missing-wiki.md") {
      return Promise.resolve({
        path: "notes/missing-wiki.md",
        content: "# Missing Wiki",
        html: "<h1>Missing Wiki</h1>",
        frontmatter: {}
      });
    }
    return Promise.resolve({ path: "note.md", content: "# hi", html: "<h1>hi</h1>" });
  });
  apiMock.getTree.mockResolvedValue([
    { path: "notes/source.md", name: "source.md", node_type: "file", children: [] }
  ]);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /source\.md/i }));
  fireEvent.click(await screen.findByText("Missing Wiki"));
  await waitFor(() => expect(apiMock.createNode).toHaveBeenCalledWith("notes/missing-wiki.md", "file"));
  expect(apiMock.saveDocument).toHaveBeenCalledWith("notes/missing-wiki.md", expect.stringContaining("# Missing Wiki"));
  await waitFor(() => expect(apiMock.getDocument).toHaveBeenCalledWith("notes/missing-wiki.md"));
});
