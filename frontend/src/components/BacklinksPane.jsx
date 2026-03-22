import React from "react";

export function BacklinksPane({ backlinks, onOpen }) {
  return (
    <section className="backlinks-panel">
      <div className="sidebar-header compact">
        <h3>Backlinks</h3>
        <p>{backlinks.length ? `${backlinks.length} linked notes` : "No incoming links yet"}</p>
      </div>
      <div className="backlinks-list">
        {backlinks.length ? (
          backlinks.map((item) => (
            <button key={item.path} type="button" className="backlink-card" onClick={() => onOpen(item.path)}>
              <strong>{item.name}</strong>
              <span>{item.excerpt}</span>
            </button>
          ))
        ) : (
          <p className="empty-state">Use [[Note Name]] in other notes to build connections.</p>
        )}
      </div>
    </section>
  );
}
