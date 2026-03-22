import React, { forwardRef, useEffect, useRef } from "react";

export const EditorPane = forwardRef(function EditorPane(
  {
    content,
    onChange,
    onCursorChange,
    onKeyDown,
    onPasteFiles,
    onDropFiles,
    saveState,
    currentPath,
    slashState,
    wikiState,
    onSelectCommand,
    onSelectWikiLink
  },
  ref
) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(520, textarea.scrollHeight)}px`;
  }, [content]);

  function assignRefs(node) {
    textareaRef.current = node;
    if (typeof ref === "function") {
      ref(node);
      return;
    }
    if (ref) {
      ref.current = node;
    }
  }

  function handlePaste(event) {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) {
      return;
    }
    event.preventDefault();
    onPasteFiles(files, event.currentTarget.selectionStart);
  }

  function handleDrop(event) {
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) {
      return;
    }
    event.preventDefault();
    onDropFiles(files, event.currentTarget.selectionStart);
  }

  return (
    <section className="pane editor-pane">
      <div className="pane-header">
        <div>
          <h2>Editor</h2>
          <p>{currentPath || "Select a note"}</p>
        </div>
        <span className={`save-chip ${saveState}`}>{saveState}</span>
      </div>
      <div className="editor-shell">
        {slashState.open ? (
          <div className="slash-menu" role="listbox" aria-label="Slash commands">
            {slashState.commands.map((command) => (
              <button
                key={command.id}
                type="button"
                className="slash-command"
                onClick={() => onSelectCommand(command.id)}
              >
                <strong>/{command.label}</strong>
                <span>{command.description}</span>
              </button>
            ))}
          </div>
        ) : null}
        {wikiState.open ? (
          <div className="wiki-menu" role="listbox" aria-label="Wiki-link suggestions">
            {wikiState.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="slash-command"
                onClick={() => onSelectWikiLink(item)}
              >
                <strong>{item.label}</strong>
                <span>{item.path}</span>
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          ref={assignRefs}
          aria-label="Markdown editor"
          className="editor"
          value={content}
          onChange={(event) => onChange(event.target.value, event.target.selectionStart)}
          onClick={(event) => onCursorChange(event.target.selectionStart)}
          onKeyUp={(event) => onCursorChange(event.target.selectionStart)}
          onSelect={(event) => onCursorChange(event.target.selectionStart)}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          placeholder="Write markdown here... Use / for commands."
        />
      </div>
    </section>
  );
});
