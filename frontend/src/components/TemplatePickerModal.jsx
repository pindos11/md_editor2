import React, { useEffect, useState } from "react";

function getInitialTemplateId(templates) {
  const defaultTemplate = templates.find((template) => template.is_default);
  return defaultTemplate?.template_id || "__blank__";
}

export function TemplatePickerModal({ open, folderPath, noteTitle, templates, onConfirm, onCancel }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(getInitialTemplateId(templates));

  useEffect(() => {
    if (open) {
      setSelectedTemplateId(getInitialTemplateId(templates));
    }
  }, [open, templates]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-label="Choose template">
        <div className="pane-header">
          <div>
            <h2>Choose Template</h2>
            <p>{folderPath || "Workspace root"} {noteTitle ? `for ${noteTitle}` : ""}</p>
          </div>
        </div>
        <div className="template-picker-list">
          <label className="template-option">
            <input
              type="radio"
              name="template-choice"
              checked={selectedTemplateId === "__blank__"}
              onChange={() => setSelectedTemplateId("__blank__")}
            />
            <span>Blank note</span>
          </label>
          {templates.map((template) => (
            <label key={template.template_id} className="template-option">
              <input
                type="radio"
                name="template-choice"
                checked={selectedTemplateId === template.template_id}
                onChange={() => setSelectedTemplateId(template.template_id)}
              />
              <span>{template.name}{template.is_default ? " (Default)" : ""}</span>
            </label>
          ))}
        </div>
        <div className="template-preview">
          {selectedTemplateId === "__blank__"
            ? <pre># {noteTitle || "New Note"}</pre>
            : <pre>{templates.find((template) => template.template_id === selectedTemplateId)?.content || ""}</pre>}
        </div>
        <div className="modal-actions">
          <button type="button" className="mini-btn" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={() => onConfirm(selectedTemplateId)}>Create note</button>
        </div>
      </section>
    </div>
  );
}
