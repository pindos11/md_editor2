import React, { useEffect, useRef } from "react";

let mermaidModulePromise = null;
let mermaidInitialized = false;
let highlighterModulePromise = null;

async function loadMermaid() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import("mermaid").then((module) => module.default);
  }
  const mermaid = await mermaidModulePromise;
  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false });
    mermaidInitialized = true;
  }
  return mermaid;
}

async function loadHighlighter() {
  if (!highlighterModulePromise) {
    highlighterModulePromise = import("highlight.js/lib/common").then((module) => module.default);
  }
  return highlighterModulePromise;
}

export function PreviewPane({ html, onOpenWikiLink }) {
  const previewRef = useRef(null);

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const mermaidBlocks = Array.from(previewNode.querySelectorAll("pre > code.language-mermaid"));
    if (!mermaidBlocks.length) {
      return;
    }
    const nodes = mermaidBlocks.map((codeNode, index) => {
      const preNode = codeNode.parentElement;
      const container = document.createElement("div");
      container.className = "mermaid";
      container.id = `mermaid-${index}-${Date.now()}`;
      container.textContent = codeNode.textContent || "";
      preNode.replaceWith(container);
      return container;
    });
    loadMermaid()
      .then((mermaid) => mermaid.run({ nodes }))
      .catch(() => {});
  }, [html]);

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const codeBlocks = Array.from(previewNode.querySelectorAll("pre > code[class*='language-']"))
      .filter((node) => !node.classList.contains("language-mermaid"));
    if (!codeBlocks.length) {
      return;
    }
    loadHighlighter()
      .then((hljs) => {
        codeBlocks.forEach((node) => hljs.highlightElement(node));
      })
      .catch(() => {});
  }, [html]);

  function handleClick(event) {
    const anchor = event.target.closest("a[data-wikilink]");
    if (!anchor) {
      return;
    }
    event.preventDefault();
    onOpenWikiLink(anchor.dataset.wikilink);
  }

  return (
    <section className="pane">
      <div className="pane-header">
        <div>
          <h2>Preview</h2>
          <p>Rendered markdown with wiki-links</p>
        </div>
      </div>
      <article ref={previewRef} className="preview" onClick={handleClick} dangerouslySetInnerHTML={{ __html: html || "<p>Nothing to preview.</p>" }} />
    </section>
  );
}
