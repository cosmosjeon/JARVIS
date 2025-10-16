import React from "react";
import useVoranBoxManagerState from "features/library/hooks/useVoranBoxManagerState";
import { Dialog, DialogContent } from "shared/ui/dialog";
import VoranTreeListPanel from "./voran-box/VoranTreeListPanel";
import VoranFolderPanel from "./voran-box/VoranFolderPanel";
import VoranKeyboardGuide from "./voran-box/VoranKeyboardGuide";

const VoranBoxManager = ({
    isVisible,
    onClose,
    trees = [],
    folders = [],
    onTreeSelect,
    onTreeMoveToFolder,
    onTreeOpen,
    onTreeRename,
    onTreeDelete,
    onFolderCreate,
    onFolderSelect,
    selectedFolderId,
    loading = false,
}) => {
    const manager = useVoranBoxManagerState({
        isVisible,
        onClose,
        trees,
        folders,
        onTreeSelect,
        onTreeMoveToFolder,
        onTreeOpen,
        onTreeRename,
        onTreeDelete,
        onFolderCreate,
        onFolderSelect,
        selectedFolderId,
    });

    const {
        voranTrees,
        folderTreeCounts,
        canScrollUp,
        canScrollDown,
        scrollUp,
        scrollDown,
        handleClose,
        navigationMode,
        currentFolderIndex,
        localSelectedTreeId,
        dragOverTarget,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        voranListRef,
        selectedTreeIds,
        draggedTreeIds,
        editingTreeId,
        editingTreeName,
        setEditingTreeName,
        contextMenuTreeId,
        toggleContextMenu,
        startEditing,
        cancelEditing,
        handleTreeRename,
        handleTreeDelete,
        handleTreeDragStart,
        handleTreeDragEnd,
        handleTreeMouseDown,
        handleTreeClick,
        handleTreeDoubleClick,
        handleVoranBoxSelect,
        handleFolderChipSelect,
        handleFolderCreate,
        handleCancelCreateFolder,
        handleKeyDown,
        newFolderName,
        setNewFolderName,
        showCreateFolder,
        setShowCreateFolder,
        isDragging,
        activePreviewFolderId,
        formatDate,
    } = manager;

    return (
        <Dialog
            open={isVisible}
            onOpenChange={(openState) => {
                if (!openState) {
                    handleClose();
                }
            }}
        >
            <DialogContent 
                className="sm:max-w-6xl max-w-[90vw] w-full h-[80vh] p-0 border border-border bg-card shadow-xl overflow-hidden"
                style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    maxHeight: '80vh',
                    height: '80vh'
                }}
            >
                <div className="relative flex h-full w-full flex-1 min-h-0">
                    <div className="flex h-full w-full min-h-0">
                        <VoranTreeListPanel
                            treeCount={voranTrees.length}
                            loading={loading}
                            voranTrees={voranTrees}
                            canScrollUp={canScrollUp}
                            canScrollDown={canScrollDown}
                            onScrollUp={scrollUp}
                            onScrollDown={scrollDown}
                            navigationMode={navigationMode}
                            localSelectedTreeId={localSelectedTreeId}
                            dragOverTarget={dragOverTarget}
                            onDragOver={(event) => handleDragOver(event, "voran", null)}
                            onDragLeave={handleDragLeave}
                            onDrop={(event) => handleDrop(event, "voran", null)}
                            listRef={voranListRef}
                            selectedTreeIds={selectedTreeIds}
                            draggedTreeIds={draggedTreeIds}
                            editingTreeId={editingTreeId}
                            editingTreeName={editingTreeName}
                            onEditingTreeNameChange={setEditingTreeName}
                            contextMenuTreeId={contextMenuTreeId}
                            onToggleContextMenu={toggleContextMenu}
                            onStartEditing={startEditing}
                            onCancelEditing={cancelEditing}
                            onTreeRename={handleTreeRename}
                            onTreeDelete={handleTreeDelete}
                            onTreeMouseDown={(tree, event) => handleTreeMouseDown(tree, event, { notify: false })}
                            onTreeDragStart={handleTreeDragStart}
                            onTreeDragEnd={handleTreeDragEnd}
                            onTreeClick={handleTreeClick}
                            onTreeDoubleClick={handleTreeDoubleClick}
                            formatDate={formatDate}
                        />

                        <VoranFolderPanel
                            folders={folders}
                            selectedFolderId={selectedFolderId}
                            navigationMode={navigationMode}
                            currentFolderIndex={currentFolderIndex}
                            onSelectVoranBox={handleVoranBoxSelect}
                            onSelectFolder={handleFolderChipSelect}
                            folderTreeCounts={folderTreeCounts}
                            dragOverTarget={dragOverTarget}
                            activePreviewFolderId={activePreviewFolderId}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            showCreateFolder={showCreateFolder}
                            onOpenCreateFolder={() => setShowCreateFolder(true)}
                            onCancelCreateFolder={handleCancelCreateFolder}
                            newFolderName={newFolderName}
                            onNewFolderNameChange={setNewFolderName}
                            onCreateFolder={handleFolderCreate}
                            onCreateInputKeyDown={handleKeyDown}
                            trees={trees}
                            draggedTreeIds={draggedTreeIds}
                            localSelectedTreeId={localSelectedTreeId}
                            onTreeMouseDown={(tree, event) => handleTreeMouseDown(tree, event, { notify: false })}
                            onTreeDragStart={handleTreeDragStart}
                            onTreeDragEnd={handleTreeDragEnd}
                            onTreeClick={handleTreeClick}
                            onTreeDoubleClick={handleTreeDoubleClick}
                            contextMenuTreeId={contextMenuTreeId}
                            onToggleContextMenu={toggleContextMenu}
                            onStartEditing={startEditing}
                            onCancelEditing={cancelEditing}
                            onTreeDelete={handleTreeDelete}
                            editingTreeId={editingTreeId}
                            editingTreeName={editingTreeName}
                            onEditingTreeNameChange={setEditingTreeName}
                            onTreeRename={handleTreeRename}
                            formatDate={formatDate}
                        />
                    </div>


                    <VoranKeyboardGuide />
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VoranBoxManager;
