import React, { useState } from "react";

function formatSnapshotTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

export function HistoryPanel({ selectedPath, history, loading, onRestore }) {
  const [collapsed, setCollapsed] = useState(true);

  if (!selectedPath) {
    return null;
  }

  return (
    <section className="history-panel">
      <div className="sidebar-header compact">
        <div className="collapsible-panel-header">
          <h3>History</h3>
          <button
            type="button"
            className="mini-btn"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
        <p>{loading ? "Loading snapshots..." : history.snapshots?.length ? `${history.snapshots.length} recent saves` : "No saved history yet"}</p>
      </div>
      {!collapsed ? (
        <div className="history-list">
          {history.snapshots?.length ? (
            history.snapshots.map((snapshot, index) => (
              <article key={snapshot.snapshot_id} className="history-card">
                <div className="history-card-copy">
                  <strong>{`#${history.snapshots.length - index} ${snapshot.title || "Snapshot"}`}</strong>
                  <span>ID {snapshot.snapshot_id.slice(-6)}</span>
                  <span>{formatSnapshotTimestamp(snapshot.created_at)}</span>
                </div>
                <button type="button" className="mini-btn" onClick={() => onRestore(snapshot.snapshot_id)}>
                  Restore
                </button>
              </article>
            ))
          ) : (
            <p className="empty-state">A snapshot is stored after each successful save.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
