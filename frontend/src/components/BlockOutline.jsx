import React from "react";

export function BlockOutline({ blocks, collapsedHeadings, onJump, onMove, onToggleCollapse }) {
  return (
    <section className="block-outline">
      <div className="sidebar-header compact">
        <h3>Blocks</h3>
        <p>{blocks.length ? `${blocks.length} blocks` : "No content blocks yet"}</p>
      </div>
      <div className="block-list">
        {blocks.length ? (
          blocks.map((block, index) => {
            const isCollapsed = block.type === "heading" && collapsedHeadings.has(block.startOffset);
            return (
              <div key={block.id} className={`block-card block-${block.type}`}>
                <button type="button" className="block-main" onClick={() => onJump(block.startOffset)}>
                  <strong>{block.title || "Untitled block"}</strong>
                  <span>{block.type}{block.level ? ` · h${block.level}` : ""}</span>
                </button>
                <div className="block-actions">
                  {block.type === "heading" ? (
                    <button type="button" className="mini-btn" onClick={() => onToggleCollapse(block.startOffset)}>
                      {isCollapsed ? "Expand" : "Collapse"}
                    </button>
                  ) : null}
                  <button type="button" className="mini-btn" onClick={() => onMove(index, "up")} disabled={index === 0}>
                    Up
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => onMove(index, "down")}
                    disabled={index === blocks.length - 1}
                  >
                    Down
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="empty-state">Write a note to generate editable blocks.</p>
        )}
      </div>
    </section>
  );
}
