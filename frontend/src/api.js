async function request(path, options = {}) {
  const headers =
    options.body instanceof FormData
      ? { ...(options.headers || {}) }
      : {
          "Content-Type": "application/json",
          ...(options.headers || {})
        };
  const response = await fetch(path, {
    headers,
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: "Request failed." }));
    throw new Error(payload.detail || "Request failed.");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  getTree() {
    return request("/api/tree");
  },
  getDocument(path) {
    return request(`/api/document?path=${encodeURIComponent(path)}`);
  },
  saveDocument(path, content) {
    return request("/api/document", {
      method: "PUT",
      body: JSON.stringify({ path, content })
    });
  },
  createNode(path, nodeType) {
    return request("/api/document", {
      method: "POST",
      body: JSON.stringify({ path, node_type: nodeType })
    });
  },
  moveNode(sourcePath, destinationPath) {
    return request("/api/document", {
      method: "PATCH",
      body: JSON.stringify({ source_path: sourcePath, destination_path: destinationPath })
    });
  },
  deleteNode(path) {
    return request("/api/document", {
      method: "DELETE",
      body: JSON.stringify({ path })
    });
  },
  searchNotes(query) {
    return request(`/api/search?query=${encodeURIComponent(query)}`);
  },
  getBacklinks(path) {
    return request(`/api/backlinks?path=${encodeURIComponent(path)}`);
  },
  getFolderTemplate(path) {
    return request(`/api/template?path=${encodeURIComponent(path || "")}`);
  },
  saveFolderTemplate(path, content) {
    return request(`/api/template?path=${encodeURIComponent(path || "")}`, {
      method: "PUT",
      body: JSON.stringify({ folder_path: path || "", content })
    });
  },
  uploadAttachment(notePath, file) {
    const body = new FormData();
    body.append("note_path", notePath);
    body.append("file", file);
    return request("/api/attachment", {
      method: "POST",
      body
    });
  },
  getUiState() {
    return request("/api/ui-state");
  },
  saveUiState(state) {
    return request("/api/ui-state", {
      method: "PUT",
      body: JSON.stringify(state)
    });
  },
  getFolderDatabase(path) {
    return request(`/api/database?path=${encodeURIComponent(path || "")}`);
  },
  getDatabaseViewSettings(path) {
    return request(`/api/database/view-settings?path=${encodeURIComponent(path || "")}`);
  },
  saveDatabaseViewSettings(path, settings) {
    return request(`/api/database/view-settings?path=${encodeURIComponent(path || "")}`, {
      method: "PUT",
      body: JSON.stringify(settings)
    });
  },
  getOllamaSettings() {
    return request("/api/ollama/settings");
  },
  saveOllamaSettings(settings) {
    return request("/api/ollama/settings", {
      method: "PUT",
      body: JSON.stringify(settings)
    });
  },
  getOllamaHealth() {
    return request("/api/ollama/health");
  },
  promptOllama(prompt) {
    return request("/api/ollama/prompt", {
      method: "POST",
      body: JSON.stringify({ prompt })
    });
  }
};
