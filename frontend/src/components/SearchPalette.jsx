import React from "react";

export function SearchPalette({ open, query, results, onQueryChange, onClose, onSelect }) {
  if (!open) {
    return null;
  }

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <div className="palette-header">
          <h2>Quick Find</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by title or content"
        />
        <div className="palette-results">
          {results.length ? (
            results.map((result) => (
              <button key={result.path} type="button" className="palette-result" onClick={() => onSelect(result.path)}>
                <strong>{result.name}</strong>
                <span>{result.snippet}</span>
              </button>
            ))
          ) : (
            <p className="empty-state">Type at least two characters to search notes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
