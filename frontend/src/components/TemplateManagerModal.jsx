import React, { useEffect, useState } from "react";

function buildTemplateId(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `template-${Date.now()}`;
}

export function TemplateManagerModal({ open, folderPath, templates, documentContent, onSave, onClose }) {
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    if (open) {
      setDrafts(templates);
    }
  }, [open, templates]);

  if (!open) {
    return null;
  }

  function updateTemplate(templateId, patch) {
    setDrafts((current) => current.map((template) => (
      template.template_id === templateId ? { ...template, ...patch } : template
    )));
  }

  function addCurrentNoteAsTemplate() {
    const name = window.prompt("Template name", "New template");
    if (!name) {
      return;
    }
    const templateId = buildTemplateId(name);
    setDrafts((current) => [
      ...current,
      {
        template_id: templateId,
        name,
        content: documentContent,
        is_default: current.length === 0
      }
    ]);
  }

  function removeTemplate(templateId) {
    setDrafts((current) => {
      const next = current.filter((template) => template.template_id !== templateId);
      if (next.length && !next.some((template) => template.is_default)) {
        next[0] = { ...next[0], is_default: true };
      }
      return next;
    });
  }

  function setDefaultTemplate(templateId) {
    setDrafts((current) => current.map((template) => ({ ...template, is_default: template.template_id === templateId })));
  }

  return (
    <div className="modal-overlay" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-label="Manage templates">
        <div className="pane-header">
          <div>
            <h2>Manage Templates</h2>
            <p>{folderPath || "Workspace root"}</p>
          </div>
          <button type="button" className="mini-btn" onClick={addCurrentNoteAsTemplate}>
            Save current as new
          </button>
        </div>
        <div className="template-manager-list">
          {drafts.length ? drafts.map((template) => (
            <article key={template.template_id} className="template-manager-card">
              <div className="template-manager-head">
                <input
                  type="text"
                  value={template.name}
                  onChange={(event) => updateTemplate(template.template_id, { name: event.target.value })}
                  placeholder="Template name"
                />
                <label className="column-chip">
                  <input
                    type="radio"
                    name="default-template"
                    checked={template.is_default}
                    onChange={() => setDefaultTemplate(template.template_id)}
                  />
                  <span>Default</span>
                </label>
              </div>
              <textarea
                rows={8}
                value={template.content}
                onChange={(event) => updateTemplate(template.template_id, { content: event.target.value })}
                placeholder="Template markdown"
              />
              <div className="template-manager-actions">
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => updateTemplate(template.template_id, { content: documentContent })}
                >
                  Overwrite from current note
                </button>
                <button type="button" className="mini-btn" onClick={() => removeTemplate(template.template_id)}>
                  Delete
                </button>
              </div>
            </article>
          )) : <p className="empty-state">No templates saved for this folder yet.</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="mini-btn" onClick={onClose}>Cancel</button>
          <button type="button" onClick={() => onSave(drafts)}>Save templates</button>
        </div>
      </section>
    </div>
  );
}
