import React, { useEffect, useMemo, useState } from "react";

const OPEN_FOLDERS_STORAGE_KEY = "md-editor2:open-folders";

function readStoredOpenFolders() {
  try {
    const raw = window.localStorage.getItem(OPEN_FOLDERS_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function collectFolderPaths(nodes, bucket = new Set()) {
  for (const node of nodes) {
    if (node.node_type === "folder") {
      bucket.add(node.path);
      collectFolderPaths(node.children || [], bucket);
    }
  }
  return bucket;
}

function collectAncestorFolders(nodes, targetPath, parents = [], bucket = new Set()) {
  for (const node of nodes) {
    if (node.path === targetPath) {
      parents.forEach((path) => bucket.add(path));
      if (node.node_type === "folder") {
        bucket.add(node.path);
      }
      return true;
    }
    if (node.children?.length) {
      if (collectAncestorFolders(node.children, targetPath, [...parents, node.path], bucket)) {
        return true;
      }
    }
  }
  return false;
}

function renderNodes(nodes, openFolders, selectedPath, selectedFolderPath, onToggleFolder, onSelectFile, onSelectFolder) {
  return nodes.map((node) => (
    <li key={node.path || node.name}>
      <div className="tree-row">
        {node.node_type === "folder" ? (
          <button
            type="button"
            className="tree-toggle"
            aria-label={openFolders.has(node.path) ? "Collapse folder" : "Expand folder"}
            onClick={() => onToggleFolder(node.path)}
          >
            {openFolders.has(node.path) ? "-" : "+"}
          </button>
        ) : (
          <span className="tree-spacer" />
        )}
        <button
          className={`tree-node ${selectedPath === node.path || selectedFolderPath === node.path ? "selected" : ""}`}
          onClick={() => (node.node_type === "file" ? onSelectFile(node.path) : onSelectFolder(node.path))}
          type="button"
        >
          <span>{node.name}</span>
        </button>
      </div>
      {node.children?.length > 0 && openFolders.has(node.path) ? (
        <ul>{renderNodes(node.children, openFolders, selectedPath, selectedFolderPath, onToggleFolder, onSelectFile, onSelectFolder)}</ul>
      ) : null}
    </li>
  ));
}

export function TreeView({ tree, selectedPath, selectedFolderPath, onSelectFile, onSelectFolder }) {
  const allFolderPaths = useMemo(() => collectFolderPaths(tree), [tree]);
  const selectedAncestors = useMemo(() => {
    const next = new Set();
    if (selectedPath) {
      collectAncestorFolders(tree, selectedPath, [], next);
    }
    if (selectedFolderPath) {
      collectAncestorFolders(tree, selectedFolderPath, [], next);
    }
    return next;
  }, [selectedFolderPath, selectedPath, tree]);
  const [openFolders, setOpenFolders] = useState(() => readStoredOpenFolders());

  useEffect(() => {
    if (!tree.length) {
      return;
    }
    setOpenFolders((current) => {
      const next = new Set([...current].filter((path) => allFolderPaths.has(path)));
      selectedAncestors.forEach((path) => next.add(path));
      return next;
    });
  }, [allFolderPaths, selectedAncestors, tree.length]);

  useEffect(() => {
    if (!tree.length) {
      return;
    }
    window.localStorage.setItem(OPEN_FOLDERS_STORAGE_KEY, JSON.stringify([...openFolders]));
  }, [openFolders, tree.length]);

  function toggleFolder(path) {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function handleSelectFolder(path) {
    setOpenFolders((current) => new Set(current).add(path));
    onSelectFolder(path);
  }

  if (!tree.length) {
    return <p className="empty-state">No markdown files yet.</p>;
  }

  return <ul className="tree-root">{renderNodes(tree, openFolders, selectedPath, selectedFolderPath, toggleFolder, onSelectFile, handleSelectFolder)}</ul>;
}
