import React, { useRef, useState } from "react";

export function Toolbar({
  selectedPath,
  templateFolderPath,
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
  onRunPrompt,
  ollamaPrompt,
  onChangeOllamaPrompt,
  ollamaResponse,
  ollamaStats,
  ollamaResponseSource,
  ollamaRunning,
  onInsertOllamaResponse,
  onClearOllamaResponse,
}) {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ollamaOpen, setOllamaOpen] = useState(false);

  function runMenuAction(action) {
    action();
    setMenuOpen(false);
  }

  const promptPresets = ollamaSettings.prompt_presets || [];
  const selectedPresetValue = promptPresets.includes(ollamaPrompt) ? ollamaPrompt : "__custom__";

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
              <button type="button" onClick={() => runMenuAction(onSaveTemplate)} disabled={!templateFolderPath && !selectedPath}>Manage templates</button>
              <button type="button" onClick={() => runMenuAction(onClearTemplate)} disabled={!templateFolderPath && !selectedPath}>Clear template</button>
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
              <div className="ollama-model-row">
                <input
                  type="text"
                  value={ollamaSettings.model}
                  onChange={(event) => onChangeOllama({ ...ollamaSettings, model: event.target.value })}
                  placeholder="Model"
                />
                <label className="column-chip ollama-think-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(ollamaSettings.think)}
                    onChange={(event) => onChangeOllama({ ...ollamaSettings, think: event.target.checked })}
                  />
                  <span>Enable thinking</span>
                </label>
              </div>
              <label className="database-view-picker">
                <span>Preset prompt</span>
                <select
                  value={selectedPresetValue}
                  onChange={(event) => {
                    if (event.target.value !== "__custom__") {
                      onChangeOllamaPrompt(event.target.value);
                    }
                  }}
                >
                  {promptPresets.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset.length > 72 ? `${preset.slice(0, 71)}…` : preset}
                    </option>
                  ))}
                  <option value="__custom__">Custom prompt</option>
                </select>
              </label>
              <textarea
                className="ollama-prompt-input"
                value={ollamaPrompt}
                onChange={(event) => onChangeOllamaPrompt(event.target.value)}
                placeholder="Prompt or instruction for the current note"
                rows={4}
              />
              <div className="toolbar-popover-actions">
                <button type="button" onClick={onCheckOllama}>Check Ollama</button>
                <button type="button" onClick={onRunPrompt} disabled={!selectedPath || ollamaRunning}>
                  {ollamaRunning ? "Running..." : "Run on note"}
                </button>
              </div>
              <div className="toolbar-popover-actions">
                <button type="button" onClick={onInsertOllamaResponse} disabled={!selectedPath || !ollamaResponse.trim()}>
                  Insert into note
                </button>
                <button type="button" onClick={onClearOllamaResponse} disabled={!ollamaResponse.trim()}>
                  Clear response
                </button>
              </div>
              <textarea
                className="ollama-response"
                value={ollamaResponse}
                readOnly
                placeholder="Ollama response will appear here"
                rows={8}
              />
              {ollamaResponseSource ? <span className="ollama-status">Response for: {ollamaResponseSource}</span> : null}
              {ollamaStats ? <span className="ollama-status">{ollamaStats}</span> : null}
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
