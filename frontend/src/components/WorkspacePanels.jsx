import React from "react";

import { BacklinksPane } from "./BacklinksPane";
import { BlockOutline } from "./BlockOutline";
import { DatabaseView } from "./DatabaseView";
import { EditorPane } from "./EditorPane";
import { HistoryPanel } from "./HistoryPanel";
import { PreviewPane } from "./PreviewPane";
import { TreeView } from "./TreeView";


export function WorkspacePanels({
  workspaceRef,
  workspaceStyle,
  dragState,
  startResize,
  tree,
  selectedPath,
  selectedFolderPath,
  viewMode,
  blocks,
  collapsedHeadings,
  backlinks,
  history,
  historyLoading,
  database,
  databaseViews,
  databaseViewSettings,
  relationOptions,
  textareaRef,
  documentContent,
  saveState,
  slashState,
  wikiState,
  previewHtml,
  onSelectFile,
  onSelectFolder,
  onJumpToBlock,
  onMoveBlock,
  onToggleHeadingCollapse,
  onOpenBacklink,
  onRestoreSnapshot,
  onOpenNote,
  onOpenRelation,
  onCreateRelation,
  onMoveBoardNote,
  onSaveDatabaseField,
  onChangeDatabaseViewSettings,
  onSelectDatabaseView,
  onCreateDatabaseView,
  onRenameDatabaseView,
  onDeleteDatabaseView,
  onCreateDatabaseNote,
  onEditorChange,
  onEditorCursorChange,
  onEditorKeyDown,
  onEditorPaste,
  onEditorDrop,
  onSelectSlashCommand,
  onSelectWikiLink,
  onOpenWikiLink,
}) {
  return (
    <section ref={workspaceRef} className={`workspace enhanced ${dragState ? "resizing" : ""}`} style={workspaceStyle}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Workspace</h2>
          <p>{selectedPath || selectedFolderPath || "Pick a note to start editing"}</p>
        </div>
        <div className="tree-scroll">
          <TreeView
            tree={tree}
            selectedPath={selectedPath}
            selectedFolderPath={selectedFolderPath}
            onSelectFile={onSelectFile}
            onSelectFolder={onSelectFolder}
          />
        </div>
        {viewMode === "editor" ? (
          <BlockOutline
            blocks={blocks}
            collapsedHeadings={collapsedHeadings}
            onJump={onJumpToBlock}
            onMove={onMoveBlock}
            onToggleCollapse={onToggleHeadingCollapse}
          />
        ) : null}
        <BacklinksPane backlinks={backlinks} onOpen={onOpenBacklink} />
        {viewMode === "editor" ? (
          <HistoryPanel
            selectedPath={selectedPath}
            history={history}
            loading={historyLoading}
            onRestore={onRestoreSnapshot}
          />
        ) : null}
      </aside>

      <button type="button" className="pane-resizer" aria-label="Resize sidebar" onPointerDown={() => startResize("left")} />

      {viewMode === "database" ? (
        <DatabaseView
          folderPath={selectedFolderPath}
          database={database}
          databaseViews={databaseViews}
          viewSettings={databaseViewSettings}
          relationOptions={relationOptions}
          onOpenNote={onOpenNote}
          onOpenRelation={onOpenRelation}
          onCreateRelation={onCreateRelation}
          onSaveField={onSaveDatabaseField}
          onMoveBoardNote={onMoveBoardNote}
          onChangeViewSettings={onChangeDatabaseViewSettings}
          onSelectView={onSelectDatabaseView}
          onCreateView={onCreateDatabaseView}
          onRenameView={onRenameDatabaseView}
          onDeleteView={onDeleteDatabaseView}
          onCreateNote={onCreateDatabaseNote}
        />
      ) : (
        <EditorPane
          ref={textareaRef}
          content={documentContent}
          onChange={onEditorChange}
          onCursorChange={onEditorCursorChange}
          onKeyDown={onEditorKeyDown}
          onPasteFiles={onEditorPaste}
          onDropFiles={onEditorDrop}
          saveState={saveState}
          currentPath={selectedPath}
          slashState={slashState}
          wikiState={wikiState}
          onSelectCommand={onSelectSlashCommand}
          onSelectWikiLink={onSelectWikiLink}
        />
      )}

      <button
        type="button"
        className="pane-resizer"
        aria-label={viewMode === "database" ? "Resize database help" : "Resize preview"}
        onPointerDown={() => startResize("right")}
      />

      {viewMode === "database" ? (
        <section className="pane database-help">
          <div className="pane-header">
            <div>
              <h2>Folder View</h2>
              <p>Frontmatter-backed table for markdown notes in this folder</p>
            </div>
          </div>
          <div className="database-info">
            <p>Click a row title to open the note in the editor.</p>
            <p>Preferred frontmatter fields: <code>status</code>, <code>tags</code>, <code>due</code>, <code>owner</code>.</p>
            <pre>{`---\nstatus: in-progress\ntags:\n  - app\n  - ui\ndue: 2026-03-25\nowner: andrei\n---`}</pre>
          </div>
        </section>
      ) : (
        <PreviewPane html={previewHtml} onOpenWikiLink={onOpenWikiLink} />
      )}
    </section>
  );
}
