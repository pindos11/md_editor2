import React, { useEffect, useMemo, useState } from "react";
import { getRelationItems, isRelationField } from "../editorModel";

const DEFAULT_STATUS_OPTIONS = ["backlog", "active", "in-progress", "paused", "done"];

function formatCellValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return value || "";
}

function inferInputType(column) {
  if (column === "status") {
    return "status";
  }
  if (column === "due") {
    return "date";
  }
  if (column === "tags") {
    return "tags";
  }
  return "text";
}

function includesFilter(note, filterText, columns) {
  const needle = filterText.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystacks = [note.title.toLowerCase(), note.name.toLowerCase()];
  for (const column of columns) {
    haystacks.push(String(formatCellValue(note.frontmatter[column])).toLowerCase());
  }
  return haystacks.some((value) => value.includes(needle));
}

function compareValues(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

function getDisplayValue(note, column, drafts) {
  const draftValue = drafts[note.path]?.[column];
  if (typeof draftValue === "string") {
    return draftValue;
  }
  return formatCellValue(note.frontmatter[column]);
}

function getStatusValue(note, drafts) {
  return getDisplayValue(note, "status", drafts).trim().toLowerCase();
}

function normalizeStatusOptions(statusOptions) {
  const cleaned = (statusOptions || []).map((option) => String(option || "").trim().toLowerCase()).filter(Boolean);
  return cleaned.length ? [...new Set(cleaned)] : DEFAULT_STATUS_OPTIONS;
}

function getBoardColumns(notes, drafts, statusOptions) {
  const foundStatuses = new Set();
  for (const note of notes) {
    const status = getStatusValue(note, drafts);
    if (status) {
      foundStatuses.add(status);
    }
  }
  const ordered = [...statusOptions];
  for (const status of foundStatuses) {
    if (!ordered.includes(status)) {
      ordered.push(status);
    }
  }
  ordered.push("unset");
  return ordered;
}

function updateDraft(setDrafts, notePath, column, value) {
  setDrafts((current) => ({
    ...current,
    [notePath]: {
      ...(current[notePath] || {}),
      [column]: value
    }
  }));
}

function getRelationQuery(value) {
  const parts = value.split(",");
  return parts.at(-1)?.trim() || "";
}

function applyRelationSuggestion(value, suggestion) {
  const parts = value.split(",");
  parts[parts.length - 1] = ` ${suggestion}`;
  return parts
    .join(",")
    .replace(/^ /, "")
    .replace(/\s*,\s*/g, ", ");
}

function FieldEditor({ column, value, statusOptions, relationSuggestions, relationCreateTarget, onCreateRelation, onChange, onBlur, onFocus }) {
  const inputType = inferInputType(column);
  if (inputType === "status") {
    return (
      <select className="database-cell-input" value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur}>
        <option value="">Unset</option>
        {statusOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (inputType === "date") {
    return <input type="date" className="database-cell-input" value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />;
  }
  return (
    <>
      <input
        type="text"
        className="database-cell-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={column === "tags" || isRelationField(column) ? "comma, separated" : "value"}
      />
      {relationSuggestions?.length ? (
        <div className="relation-suggestions" role="listbox" aria-label={`${column} suggestions`}>
          {relationSuggestions.map((suggestion) => (
            <button key={suggestion} type="button" className="relation-suggestion" onMouseDown={(event) => event.preventDefault()} onClick={() => onChange(applyRelationSuggestion(value, suggestion))}>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {relationCreateTarget ? (
        <div className="relation-suggestions">
          <button type="button" className="relation-suggestion create-relation" onMouseDown={(event) => event.preventDefault()} onClick={onCreateRelation}>
            Create "{relationCreateTarget}"
          </button>
        </div>
      ) : null}
    </>
  );
}

export function DatabaseView({
  folderPath,
  database,
  viewSettings,
  onOpenNote,
  onOpenRelation,
  onCreateRelation,
  onSaveField,
  onChangeViewSettings,
  onCreateNote,
  relationOptions
}) {
  const [drafts, setDrafts] = useState({});
  const [originals, setOriginals] = useState({});
  const [savingCell, setSavingCell] = useState("");
  const [activeRelationCell, setActiveRelationCell] = useState("");
  const [statusOptionsDraft, setStatusOptionsDraft] = useState("");
  const statusOptions = useMemo(() => normalizeStatusOptions(viewSettings.status_options), [viewSettings.status_options]);
  const visibleColumns = useMemo(() => {
    const configured = (viewSettings.visible_columns || []).filter((column) => database.columns.includes(column));
    return configured.length ? configured : database.columns;
  }, [database.columns, viewSettings.visible_columns]);

  useEffect(() => {
    const nextDrafts = {};
    const nextOriginals = {};
    for (const note of database.notes) {
      nextDrafts[note.path] = {};
      nextOriginals[note.path] = {};
      for (const column of database.columns) {
        const formatted = formatCellValue(note.frontmatter[column]);
        nextDrafts[note.path][column] = formatted;
        nextOriginals[note.path][column] = formatted;
      }
    }
    setDrafts(nextDrafts);
    setOriginals(nextOriginals);
  }, [database]);

  useEffect(() => {
    setStatusOptionsDraft(statusOptions.join(", "));
  }, [statusOptions]);

  const visibleNotes = useMemo(() => {
    const filtered = database.notes.filter((note) => includesFilter(note, viewSettings.filter_text, database.columns));
    const sorted = [...filtered].sort((left, right) => {
      const leftValue = viewSettings.sort_by === "title" ? left.title : getDisplayValue(left, viewSettings.sort_by, drafts);
      const rightValue = viewSettings.sort_by === "title" ? right.title : getDisplayValue(right, viewSettings.sort_by, drafts);
      const result = compareValues(leftValue, rightValue);
      return viewSettings.sort_direction === "asc" ? result : -result;
    });
    return sorted;
  }, [database, drafts, viewSettings]);

  const boardColumns = useMemo(() => {
    const columns = getBoardColumns(visibleNotes, drafts, statusOptions);
    return columns.length ? columns : ["unset"];
  }, [drafts, statusOptions, visibleNotes]);

  const relationSuggestions = useMemo(() => {
    if (!activeRelationCell) {
      return [];
    }
    const [notePath, column] = activeRelationCell.split(":");
    if (!isRelationField(column)) {
      return [];
    }
    const currentValue = drafts[notePath]?.[column] ?? "";
    const query = getRelationQuery(currentValue).toLowerCase();
    const currentItems = new Set(getRelationItems(currentValue).map((item) => item.toLowerCase()));
    return relationOptions
      .filter((option) => !currentItems.has(option.toLowerCase()))
      .filter((option) => !query || option.toLowerCase().includes(query))
      .slice(0, 6);
  }, [activeRelationCell, drafts, relationOptions]);

  const relationCreateTarget = useMemo(() => {
    if (!activeRelationCell) {
      return "";
    }
    const [notePath, column] = activeRelationCell.split(":");
    if (!isRelationField(column)) {
      return "";
    }
    const currentValue = drafts[notePath]?.[column] ?? "";
    const query = getRelationQuery(currentValue).trim();
    if (!query) {
      return "";
    }
    const exactMatch = relationOptions.some((option) => option.toLowerCase() === query.toLowerCase());
    return exactMatch ? "" : query;
  }, [activeRelationCell, drafts, relationOptions]);

  function toggleSort(column) {
    if (viewSettings.sort_by === column) {
      onChangeViewSettings({
        ...viewSettings,
        sort_direction: viewSettings.sort_direction === "asc" ? "desc" : "asc"
      });
      return;
    }
    onChangeViewSettings({
      ...viewSettings,
      sort_by: column,
      sort_direction: "asc"
    });
  }

  function changeViewMode(nextMode) {
    onChangeViewSettings({
      ...viewSettings,
      view_mode: nextMode
    });
  }

  function saveStatusOptions(rawValue) {
    const nextOptions = rawValue
      .split(",")
      .map((option) => option.trim().toLowerCase())
      .filter(Boolean);
    onChangeViewSettings({
      ...viewSettings,
      status_options: nextOptions
    });
  }

  function toggleVisibleColumn(column) {
    const current = visibleColumns.includes(column);
    const nextColumns = current ? visibleColumns.filter((item) => item !== column) : [...visibleColumns, column];
    onChangeViewSettings({
      ...viewSettings,
      visible_columns: nextColumns
    });
  }

  async function saveFieldValue(notePath, column, value) {
    const cellId = `${notePath}:${column}`;
    const originalValue = originals[notePath]?.[column] ?? "";
    if (value === originalValue) {
      return;
    }
    setSavingCell(cellId);
    setOriginals((current) => ({
      ...current,
      [notePath]: {
        ...(current[notePath] || {}),
        [column]: value
      }
    }));
    try {
      await onSaveField(notePath, column, value);
    } finally {
      setSavingCell("");
    }
  }

  async function saveField(notePath, column) {
    const value = drafts[notePath]?.[column] ?? "";
    await saveFieldValue(notePath, column, value);
  }

  async function createRelationTarget(notePath, column) {
    const currentValue = drafts[notePath]?.[column] ?? "";
    const target = getRelationQuery(currentValue).trim();
    if (!target) {
      return;
    }
    const createdLabel = await onCreateRelation(target);
    const nextValue = applyRelationSuggestion(currentValue, createdLabel);
    updateDraft(setDrafts, notePath, column, nextValue);
    await saveFieldValue(notePath, column, nextValue);
  }

  return (
    <section className="pane database-pane">
      <div className="pane-header">
        <div>
          <h2>Database</h2>
          <p>{folderPath || "Workspace root"}</p>
        </div>
        <button type="button" onClick={onCreateNote}>New Note</button>
      </div>
      <div className="database-controls">
        <input
          type="text"
          value={viewSettings.filter_text}
          onChange={(event) => onChangeViewSettings({ ...viewSettings, filter_text: event.target.value })}
          placeholder="Filter by title or field value"
        />
        <div className="database-view-toggle" role="group" aria-label="Database view mode">
          <button type="button" className={viewSettings.view_mode === "table" ? "mini-btn active" : "mini-btn"} onClick={() => changeViewMode("table")}>
            Table
          </button>
          <button type="button" className={viewSettings.view_mode === "board" ? "mini-btn active" : "mini-btn"} onClick={() => changeViewMode("board")}>
            Board
          </button>
        </div>
        <span className="database-meta">
          {visibleNotes.length} of {database.notes.length} notes
        </span>
      </div>
      <div className="database-settings">
        <label className="database-settings-field">
          <span>Status options</span>
          <input
            type="text"
            value={statusOptionsDraft}
            onChange={(event) => setStatusOptionsDraft(event.target.value)}
            onBlur={() => saveStatusOptions(statusOptionsDraft)}
            placeholder="backlog, active, done"
          />
        </label>
        {database.columns.length ? (
          <div className="database-settings-field">
            <span>Visible columns</span>
            <div className="column-chip-list">
              {database.columns.map((column) => (
                <label key={column} className="column-chip">
                  <input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => toggleVisibleColumn(column)} />
                  <span>{column}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {database.notes.length ? (
        viewSettings.view_mode === "board" ? (
          <div className="database-board" aria-label="Status board">
            {boardColumns.map((status) => {
              const columnNotes = visibleNotes.filter((note) => {
                const noteStatus = getStatusValue(note, drafts);
                return status === "unset" ? !noteStatus : noteStatus === status;
              });
              return (
                <section key={status} className="board-column">
                  <div className="board-column-header">
                    <h3>{status === "unset" ? "Unset" : status}</h3>
                    <span>{columnNotes.length}</span>
                  </div>
                  <div className="board-card-list">
                    {columnNotes.length ? (
                      columnNotes.map((note) => (
                        <article key={note.path} className="board-card">
                          <button type="button" className="database-link board-card-link" onClick={() => onOpenNote(note.path)}>
                            {note.title}
                          </button>
                          <FieldEditor
                            column="status"
                            value={drafts[note.path]?.status ?? ""}
                            statusOptions={statusOptions}
                            onChange={(value) => {
                              updateDraft(setDrafts, note.path, "status", value);
                              saveFieldValue(note.path, "status", value).catch(() => {});
                            }}
                            onBlur={() => {}}
                          />
                          <div className="board-card-meta">
                            {visibleColumns.includes("owner") && drafts[note.path]?.owner ? <span>Owner: {drafts[note.path].owner}</span> : null}
                            {visibleColumns.includes("due") && drafts[note.path]?.due ? <span>Due: {drafts[note.path].due}</span> : null}
                            {visibleColumns.includes("tags") && drafts[note.path]?.tags ? <span>Tags: {drafts[note.path].tags}</span> : null}
                            {visibleColumns
                              .filter((column) => isRelationField(column))
                              .flatMap((column) =>
                                getRelationItems(drafts[note.path]?.[column] ?? note.frontmatter[column]).map((item) => (
                                  <button key={`${note.path}-${column}-${item}`} type="button" className="relation-chip" onClick={() => onOpenRelation(item)}>
                                    {column}: {item}
                                  </button>
                                ))
                              )}
                          </div>
                          {savingCell === `${note.path}:status` ? <span className="cell-saving">Saving...</span> : null}
                        </article>
                      ))
                    ) : (
                      <p className="board-empty">No notes in this column.</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="database-table-wrap">
            <table className="database-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="database-heading-btn" onClick={() => toggleSort("title")}>
                      Title {viewSettings.sort_by === "title" ? (viewSettings.sort_direction === "asc" ? "^" : "v") : ""}
                    </button>
                  </th>
                  {visibleColumns.map((column) => (
                    <th key={column}>
                      <button type="button" className="database-heading-btn" onClick={() => toggleSort(column)}>
                        {column} {viewSettings.sort_by === column ? (viewSettings.sort_direction === "asc" ? "^" : "v") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleNotes.map((note) => (
                  <tr key={note.path}>
                    <td>
                      <button type="button" className="database-link" onClick={() => onOpenNote(note.path)}>
                        {note.title}
                      </button>
                    </td>
                    {visibleColumns.map((column) => {
                      const cellId = `${note.path}:${column}`;
                      return (
                        <td key={`${note.path}-${column}`}>
                          <FieldEditor
                            column={column}
                            value={drafts[note.path]?.[column] ?? ""}
                            statusOptions={statusOptions}
                            onChange={(value) => updateDraft(setDrafts, note.path, column, value)}
                            relationSuggestions={activeRelationCell === `${note.path}:${column}` ? relationSuggestions : []}
                            relationCreateTarget={activeRelationCell === `${note.path}:${column}` ? relationCreateTarget : ""}
                            onCreateRelation={() => createRelationTarget(note.path, column).catch(() => {})}
                            onFocus={() => setActiveRelationCell(isRelationField(column) ? `${note.path}:${column}` : "")}
                            onBlur={() => {
                              setActiveRelationCell("");
                              saveField(note.path, column).catch(() => {});
                            }}
                          />
                          {isRelationField(column) ? (
                            <div className="relation-list">
                              {getRelationItems(drafts[note.path]?.[column] ?? note.frontmatter[column]).map((item) => (
                                <button key={`${note.path}-${column}-${item}`} type="button" className="relation-chip" onClick={() => onOpenRelation(item)}>
                                  {item}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {savingCell === cellId ? <span className="cell-saving">Saving...</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <p className="empty-state">No markdown notes with frontmatter in this folder yet.</p>
      )}
    </section>
  );
}
