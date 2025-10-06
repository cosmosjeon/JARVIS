import React from 'react';
import { ChevronDown, ChevronUp, FolderTree as TreeIcon, X } from 'lucide-react';
import { Button } from 'shared/ui/button';
import { cn } from 'shared/utils';
import VoranTreeListItem from './VoranTreeListItem';

const VoranTreeListPanel = ({
  treeCount,
  loading,
  voranTrees,
  canScrollUp,
  canScrollDown,
  onScrollUp,
  onScrollDown,
  onClose,
  navigationMode,
  localSelectedTreeId,
  dragOverTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  listRef,
  selectedTreeIds,
  draggedTreeIds,
  editingTreeId,
  editingTreeName,
  onEditingTreeNameChange,
  contextMenuTreeId,
  onToggleContextMenu,
  onStartEditing,
  onCancelEditing,
  onTreeRename,
  onTreeDelete,
  onTreeMouseDown,
  onTreeDragStart,
  onTreeDragEnd,
  onTreeClick,
  onTreeDoubleClick,
  formatDate,
}) => (
  <div
    className={cn(
      'flex-1 border-r border-border/60 bg-card/40 transition-colors',
      dragOverTarget?.type === 'voran' && 'bg-blue-900/25 border-blue-500/60'
    )}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    <div className="border-b border-border/60 px-4 h-[87px] flex flex-col justify-center">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-card-foreground">VORAN BOX</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{treeCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onScrollUp}
            disabled={!canScrollUp}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-card-foreground disabled:opacity-30"
            title="위로 스크롤"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onScrollDown}
            disabled={!canScrollDown}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-card-foreground disabled:opacity-30"
            title="아래로 스크롤"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-card-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">저장된 트리들을 관리하세요</p>
      {navigationMode && localSelectedTreeId && (
        <div className="mt-2 text-xs text-blue-400 font-medium">탭키로 폴더를 선택하고 엔터로 저장하세요</div>
      )}
      {dragOverTarget?.type === 'voran' && (
        <div className="mt-2 text-xs text-blue-400 font-medium">여기에 트리를 놓으면 VORAN BOX로 이동합니다</div>
      )}
    </div>

    <div className="flex-1 overflow-y-auto px-4 py-3" ref={listRef}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">로딩 중...</div>
        </div>
      ) : voranTrees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <TreeIcon className="h-8 w-8 text-muted-foreground/70 mb-2" />
          <p className="text-sm text-muted-foreground">저장된 트리가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-0">
          {voranTrees.map((tree, index) => {
            const isSelected = selectedTreeIds.includes(tree.id);
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
                    if (isEditing) return;
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
                    if (!isEditing) {
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
      )}
    </div>

  </div>
);


export default VoranTreeListPanel;
