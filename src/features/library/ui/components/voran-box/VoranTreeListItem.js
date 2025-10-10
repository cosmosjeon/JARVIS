import React from 'react';
import { motion } from 'framer-motion';
import {
  FolderTree as TreeIcon,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
} from 'lucide-react';
import { Button } from 'shared/ui/button';
import { Input } from 'shared/ui/input';
import { cn } from 'shared/utils';

const VoranTreeListItem = ({
  tree,
  isSelected,
  isDragging,
  isEditing,
  editingValue,
  onEditingChange,
  onCommitRename,
  onCancelEditing,
  onMouseDown,
  onDragStart,
  onDragEnd,
  onClick,
  onDoubleClick,
  showContextMenu,
  onContextMenuToggle,
  onStartEditing,
  onDelete,
  formatDate,
}) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    draggable={!isEditing}
    onMouseDown={onMouseDown}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    className={cn(
      'group relative flex items-center gap-2 rounded-lg border border-transparent bg-card/80 px-2.5 py-2 text-sm shadow-sm transition-colors',
      !isEditing && 'cursor-pointer hover:border-border/70 hover:bg-card',
      isSelected && 'border-primary/60 bg-primary/10 text-card-foreground ring-1 ring-primary/40 shadow-md',
      isDragging && 'border-dashed border-primary/50 bg-primary/5 opacity-80 ring-1 ring-primary/40'
    )}
  >
    <TreeIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
    <div className="flex-1 min-w-0">
      {isEditing ? (
        <Input
          value={editingValue}
          onChange={(event) => onEditingChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onCommitRename(editingValue);
            } else if (event.key === 'Escape') {
              onCancelEditing();
            }
          }}
          onBlur={() => onCommitRename(editingValue)}
          className="h-6 text-xs bg-border border-border text-card-foreground"
          autoFocus
        />
      ) : (
        <>
          <div className="font-medium text-card-foreground truncate text-xs">
            {tree.title || '제목 없는 트리'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            <span className="text-xs">{formatDate(tree.updatedAt)}</span>
            <span>•</span>
            <span className="text-xs">{tree.treeData?.nodes?.length || 0}개 노드</span>
          </div>
        </>
      )}
    </div>
    {!isEditing && (
      <div className="relative context-menu-container">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100 transition-opacity bg-border/60 hover:bg-border/50"
          onClick={(event) => {
            event.stopPropagation();
            onContextMenuToggle();
          }}
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
        {showContextMenu && (
          <div className="absolute right-0 top-6 z-50 bg-muted border border-border rounded-md shadow-lg py-1 min-w-[120px]">
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-xs text-card-foreground hover:bg-border flex items-center gap-2"
              onClick={(event) => {
                event.stopPropagation();
                onStartEditing();
              }}
            >
              <Edit className="h-3 w-3" />
              이름 고치기
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-border flex items-center gap-2"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
              지우기
            </button>
          </div>
        )}
      </div>
    )}
  </motion.div>
);


export default VoranTreeListItem;
