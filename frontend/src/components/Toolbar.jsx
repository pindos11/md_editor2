import React, { useRef, useState } from "react";

export function Toolbar({
  selectedPath,
  uiScale,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onQuickFind,
  onChangeUiScale,
  ollamaSettings,
  onSaveTemplate,
  onClearTemplate,
  onAttachFile,
  onChangeOllama,
  ollamaHealth,
  onCheckOllama,
  onRunPrompt
}) {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ollamaOpen, setOllamaOpen] = useState(false);

  function runMenuAction(action) {
    action();
    setMenuOpen(false);
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group compact-toolbar">
        <div className="toolbar-menu-wrap">
          <button type="button" className="toolbar-pill" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>
            Menu
          </button>
          {menuOpen ? (
            <div className="toolbar-popover" role="menu" aria-label="Workspace actions">
              <label className="toolbar-scale" aria-label="Scale">
                <span>Scale {uiScale}%</span>
                <input
                  type="range"
                  min="85"
                  max="125"
                  step="5"
                  value={uiScale}
                  onChange={(event) => onChangeUiScale(Number(event.target.value))}
                />
              </label>
              <button type="button" onClick={() => runMenuAction(onCreateFile)}>New note</button>
              <button type="button" onClick={() => runMenuAction(onCreateFolder)}>New folder</button>
              <button type="button" onClick={() => runMenuAction(onQuickFind)}>Quick find</button>
              <button type="button" onClick={() => runMenuAction(onRename)} disabled={!selectedPath}>Rename / move</button>
              <button type="button" onClick={() => runMenuAction(onDelete)} disabled={!selectedPath}>Delete</button>
              <button type="button" onClick={() => runMenuAction(onSaveTemplate)} disabled={!selectedPath}>Save as template</button>
              <button type="button" onClick={() => runMenuAction(onClearTemplate)} disabled={!selectedPath}>Clear template</button>
              <button type="button" onClick={() => {
                fileInputRef.current?.click();
                setMenuOpen(false);
              }} disabled={!selectedPath}>Attach file</button>
            </div>
          ) : null}
        </div>
        <div className="toolbar-menu-wrap">
          <button type="button" className="toolbar-pill" aria-expanded={ollamaOpen} onClick={() => setOllamaOpen((current) => !current)}>
            Ollama
          </button>
          {ollamaOpen ? (
            <div className="toolbar-popover ollama-popover" aria-label="Ollama controls">
              <input
                type="text"
                value={ollamaSettings.base_url}
                onChange={(event) => onChangeOllama({ ...ollamaSettings, base_url: event.target.value })}
                placeholder="Ollama URL"
              />
              <input
                type="text"
                value={ollamaSettings.model}
                onChange={(event) => onChangeOllama({ ...ollamaSettings, model: event.target.value })}
                placeholder="Model"
              />
              <div className="toolbar-popover-actions">
                <button type="button" onClick={onCheckOllama}>Check Ollama</button>
                <button type="button" onClick={onRunPrompt} disabled={!selectedPath}>Summarize</button>
              </div>
              <span className="ollama-status">{ollamaHealth}</span>
            </div>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onAttachFile(file);
            }
            event.target.value = "";
          }}
        />
      </div>
      <p className="toolbar-context">{selectedPath || "Workspace actions and local AI controls"}</p>
    </div>
  );
}
