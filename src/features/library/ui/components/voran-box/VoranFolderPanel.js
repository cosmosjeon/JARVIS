import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Folder,
  FolderPlus,
  FolderTree as TreeIcon,
} from 'lucide-react';
import { Button } from 'shared/ui/button';
import { Input } from 'shared/ui/input';
import { getRuntime, constants as runtimeConstants } from 'shared/utils/platform';
import { cn } from 'shared/utils';
import VoranTreeListItem from './VoranTreeListItem';

const VoranFolderPanel = ({
  folders,
  selectedFolderId,
  navigationMode,
  currentFolderIndex,
  onSelectVoranBox,
  onSelectFolder,
  folderTreeCounts,
  dragOverTarget,
  activePreviewFolderId,
  onDragOver,
  onDragLeave,
  onDrop,
  showCreateFolder,
  onOpenCreateFolder,
  onCancelCreateFolder,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  onCreateInputKeyDown,
  trees,
  draggedTreeIds,
  localSelectedTreeId,
  onTreeMouseDown,
  onTreeDragStart,
  onTreeDragEnd,
  onTreeClick,
  onTreeDoubleClick,
  contextMenuTreeId,
  onToggleContextMenu,
  onStartEditing,
  onCancelEditing,
  onTreeDelete,
  editingTreeId,
  editingTreeName,
  onEditingTreeNameChange,
  onTreeRename,
  formatDate,
}) => {
  const chipBaseClass = 'flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-card/70 px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card';
  const chipHoverClass = 'hover:border-border/70 hover:bg-card hover:text-foreground';
  const chipActiveClass = 'border-primary/60 bg-primary/10 text-card-foreground ring-1 ring-primary/30';
  const chipDragTargetClass = 'ring-2 ring-primary/50 bg-primary/15 text-card-foreground';
  const chipPreviewClass = 'ring-1 ring-primary/30 bg-primary/12 shadow-md';

  return (
    <div className="flex-1 bg-card/40 flex flex-col">
    <div className="px-4 pt-3 pb-0">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-card-foreground">폴더 관리</h3>
        <Button
          variant="ghost"
          size="sm"
          aria-label="새 폴더 만들기"
          onClick={onOpenCreateFolder}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-card-foreground"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div className="px-4 py-2 border-b border-border/60">
      <div className="flex gap-2 overflow-x-auto">
        <button
          type="button"
          className={cn(
            chipBaseClass,
            !(selectedFolderId === null || (navigationMode && currentFolderIndex === 0)) && chipHoverClass,
            (selectedFolderId === null || (navigationMode && currentFolderIndex === 0)) && chipActiveClass,
            dragOverTarget?.type === 'voran' && chipDragTargetClass
          )}
          onClick={onSelectVoranBox}
        >
          <Box className="h-3 w-3 text-muted-foreground" />
          <span className="text-card-foreground">BOX</span>
          <span className="text-xs text-muted-foreground bg-border px-1 py-0.5 rounded-full">{folderTreeCounts.voranCount}</span>
        </button>

        {folders.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-center">
            <p className="text-sm text-muted-foreground">폴더가 없습니다</p>
          </div>
        ) : (
          folders.map((folder, index) => {
            const folderIndex = index + 1;
            const isNavigationSelected = navigationMode && folderIndex === currentFolderIndex;
            const isDragTarget = dragOverTarget?.type === 'folder' && dragOverTarget?.id === folder.id;
            const isPreview = activePreviewFolderId === folder.id;
            return (
              <button
                type="button"
                key={folder.id}
                className={cn(
                  chipBaseClass,
                  !(selectedFolderId === folder.id || isNavigationSelected) && chipHoverClass,
                  (selectedFolderId === folder.id || isNavigationSelected) && chipActiveClass,
                  isDragTarget && chipDragTargetClass,
                  isPreview && chipPreviewClass
                )}
                onClick={() => onSelectFolder(folder, folderIndex)}
                onDragOver={(event) => onDragOver(event, 'folder', folder.id)}
                onDragLeave={onDragLeave}
                onDrop={(event) => onDrop(event, 'folder', folder.id)}
              >
                <Folder className="h-3 w-3 text-muted-foreground" />
                <span className="text-card-foreground">{folder.name}</span>
                <span className="text-xs text-muted-foreground bg-border px-1 py-0.5 rounded-full">{folderTreeCounts[folder.id] || 0}</span>
              </button>
            );
          })
        )}
      </div>
    </div>

    <AnimatePresence>
      {showCreateFolder && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-b border-border/60 px-4 py-3"
        >
          <div className="space-y-2">
            <Input
              value={newFolderName}
              onChange={(event) => onNewFolderNameChange(event.target.value)}
              onKeyDown={onCreateInputKeyDown}
              placeholder="폴더 이름"
              className="h-8 text-sm bg-card/70 border-border focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onCreateFolder}
                disabled={!newFolderName.trim()}
                className="h-6 px-2 text-xs"
              >
                생성
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelCreateFolder}
                className="h-6 px-2 text-xs"
              >
                취소
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <div className="flex-1 overflow-y-auto px-4 py-3 transition-colors">
      {selectedFolderId ? (
        <div
          className={cn(
            'h-full',
            dragOverTarget?.type === 'folder' && dragOverTarget?.id === selectedFolderId && 'bg-primary/10 ring-1 ring-primary/30 rounded-lg'
          )}
          onDragOver={(event) => onDragOver(event, 'folder', selectedFolderId)}
          onDragLeave={onDragLeave}
          onDrop={(event) => onDrop(event, 'folder', selectedFolderId)}
        >
          {(() => {
            const folderTrees = trees.filter((tree) => tree.folderId === selectedFolderId);
            if (folderTrees.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                  <TreeIcon className="h-8 w-8 text-muted-foreground/70 mb-2" />
                  <p className="text-sm text-muted-foreground">이 폴더에 트리가 없습니다</p>
                  {dragOverTarget?.type === 'folder' && dragOverTarget?.id === selectedFolderId && (
                    <div className="mt-2 text-xs text-primary font-medium">여기에 트리를 놓으면 이 폴더로 이동합니다</div>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-0">
                {folderTrees.map((tree, index) => {
                  const isSelected = tree.id === localSelectedTreeId;
                  const isDragging = draggedTreeIds.includes(tree.id);
                  const isEditing = editingTreeId === tree.id;
                  return (
                    <div key={tree.id}>
                      {index > 0 && <div className="border-t border-border/50 my-1" />}
                      <VoranTreeListItem
                        tree={tree}
                        isSelected={isSelected}
                        isDragging={isDragging}
                        isEditing={isEditing}
                        editingValue={editingTreeName}
                        onEditingChange={onEditingTreeNameChange}
                        onCommitRename={(value) => onTreeRename(tree.id, value)}
                        onCancelEditing={onCancelEditing}
                        onMouseDown={(event) => {
                          if (event.button !== 0 || isEditing) {
                            return;
                          }
                          onTreeMouseDown(tree, event);
                        }}
                        onDragStart={(event) => {
                          if (isEditing) {
                            event.preventDefault();
                            return;
                          }
                          onTreeDragStart(event, tree.id);
                        }}
                        onDragEnd={onTreeDragEnd}
                        onClick={(event) => {
                          if (!isEditing) {
                            onTreeClick(tree, event);
                          }
                        }}
                        onDoubleClick={() => {
                          const runtime = getRuntime();
                          if (runtime === runtimeConstants.RUNTIME_ELECTRON) {
                            onTreeDoubleClick(tree);
                          }
                        }}
                        showContextMenu={contextMenuTreeId === tree.id}
                        onContextMenuToggle={() => onToggleContextMenu(tree.id)}
                        onStartEditing={() => onStartEditing(tree)}
                        onDelete={() => onTreeDelete(tree.id)}
                        formatDate={formatDate}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="flex items-center gap-3 mb-4">
            <Box className="h-12 w-12 opacity-80 text-muted-foreground" />
            <div className="text-left">
              <h3 className="text-lg font-semibold text-card-foreground mb-1">라이브러리</h3>
              <p className="text-sm text-muted-foreground">라이브러리에서 열 트리를 선택하세요.</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground/80">
            <p>• 폴더를 클릭하여 트리를 확인하세요</p>
            <p>• 키보드로 빠르게 탐색할 수 있습니다</p>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};


export default VoranFolderPanel;
