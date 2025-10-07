import React, { useMemo } from 'react';
import { ScrollArea } from 'shared/ui/scroll-area';
import { Button } from 'shared/ui/button';
import { Badge } from 'shared/ui/badge';
import { cn } from 'shared/utils';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder as FolderIcon,
  Monitor,
  Plus,
  Sparkles,
} from 'lucide-react';

const LibrarySidebar = ({
  folders,
  trees,
  voranTrees,
  selectedTreeId,
  selectedFolderId,
  expandedFolders,
  navSelectedIds,
  draggedTreeIds,
  dragOverFolderId,
  dragOverVoranBox,
  onManageVoranBox,
  onCreateFolder,
  onCreateTree,
  canCreateTree = true,
  isLoading = false,
  onToggleFolder,
  onSelectTree,
  onOpenTree,
  onDeleteTree,
  onDragStart,
  onDragEnd,
  onDropToFolder,
  onDropToVoran,
  onFolderDragOver,
  onFolderDragLeave,
  onVoranDragOver,
  onVoranDragLeave,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const folderTreeMap = useMemo(() => {
    return folders.reduce((acc, folder) => {
      acc.set(
        folder.id,
        trees.filter((tree) => tree.folderId === folder.id),
      );
      return acc;
    }, new Map());
  }, [folders, trees]);

  const toggleLabel = collapsed ? '사이드바 펼치기' : '사이드바 접기';
  const handleToggleCollapsed = () => {
    if (onToggleCollapsed) {
      onToggleCollapsed();
    }
  };
  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;

  const renderToggleButton = (isCollapsed, className = '') => (
    <button
      type="button"
      onClick={handleToggleCollapsed}
      className={cn(
        'rounded-full border border-border bg-card shadow-md transition hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background flex items-center justify-center',
        isCollapsed ? 'h-10 w-10' : 'h-8 w-8',
        className,
      )}
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <ToggleIcon className={isCollapsed ? 'h-5 w-5' : 'h-4 w-4'} />
    </button>
  );

  return (
    <aside
      className={cn(
        'relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-card text-card-foreground transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[60px]' : 'w-[320px]',
      )}
      aria-expanded={!collapsed}
    >
      {collapsed ? (
        <div className="flex flex-1 items-center justify-center">
          {renderToggleButton(true)}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-border px-5 py-6">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-w-0 justify-between rounded-lg border border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-card/90 hover:shadow-md"
              onClick={onManageVoranBox}
            >
              <span className="flex items-center gap-2">
                <FolderIcon className="h-4 w-4 text-muted-foreground" />
                VORAN BOX
              </span>
              <span className="text-xs text-muted-foreground">관리</span>
            </Button>
            {renderToggleButton(false, 'ml-1 flex-shrink-0')}
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 px-4 py-6">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-sm text-foreground shadow-sm transition hover:border-border hover:bg-accent/30 sm:flex-1"
                  onClick={onCreateFolder}
                >
                  <span className="flex items-center gap-2">
                    <FolderIcon className="h-4 w-4 text-muted-foreground" />
                    New Folder
                  </span>
                  <span className="text-xs text-muted-foreground">+</span>
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-sm sm:w-auto"
                  onClick={onCreateTree}
                  disabled={!canCreateTree || isLoading}
                >
                  <Plus className="h-4 w-4" />
                  새 트리 만들기
                </Button>
              </div>

              {folders.map((folder) => {
                const folderTrees = folderTreeMap.get(folder.id) || [];
                const isFolderSelected = selectedFolderId === folder.id;
                const hasSelectedTree = folderTrees.some((tree) => tree.id === selectedTreeId);
                const isDragTarget = dragOverFolderId === folder.id;
                const isExpanded = expandedFolders.has(folder.id);
                const isActiveFolder = isFolderSelected || hasSelectedTree;

                return (
                  <div key={folder.id} className="space-y-2">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => onToggleFolder(folder.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        onFolderDragOver(folder.id);
                      }}
                      onDragLeave={() => onFolderDragLeave(folder.id)}
                      onDrop={(event) => onDropToFolder(event, folder.id)}
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-lg border border-transparent bg-card/70 px-3 py-2 text-left text-sm font-medium shadow-sm transition-colors',
                        isActiveFolder && 'border-primary/60 bg-primary/10 text-foreground',
                        !isActiveFolder && 'text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground',
                        isDragTarget && 'ring-2 ring-primary/50',
                      )}
                    >
                      {folderTrees.length > 0 ? (
                        isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                      ) : (
                        <FolderIcon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                      )}
                      <span className="flex-1 truncate">{folder.name}</span>
                      <Badge
                        variant="secondary"
                        className="ml-auto rounded-full border border-border/60 bg-card px-2 py-0 text-[11px] font-medium text-muted-foreground"
                      >
                        {folderTrees.length}
                      </Badge>
                    </button>

                    {isExpanded && folderTrees.length > 0 && (
                      <div className="ml-5 space-y-1.5">
                        {folderTrees.map((tree) => {
                          const isActiveTree = tree.id === selectedTreeId;
                          const isSelectedInNav = navSelectedIds.includes(tree.id);
                          const isDragging = draggedTreeIds.includes(tree.id);

                          return (
                            <button
                              key={tree.id}
                              type="button"
                              tabIndex={-1}
                              draggable
                              onClick={() => onSelectTree(tree.id, { folderId: folder.id })}
                              onDoubleClick={() => onOpenTree(tree.id)}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                onDeleteTree(tree.id);
                              }}
                              onDragStart={(event) => onDragStart(event, tree.id)}
                              onDragEnd={onDragEnd}
                              className={cn(
                                'group flex w-full items-center gap-2 rounded-md border border-transparent bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors',
                                isActiveTree && 'border-primary/60 bg-primary/10 text-foreground',
                                !isActiveTree && 'text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground',
                                !isActiveTree && isSelectedInNav && 'border-primary/40 text-foreground/90',
                                isDragging && 'opacity-60',
                              )}
                            >
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full bg-primary/50 transition-colors',
                                  (isActiveTree || isSelectedInNav) && 'bg-primary',
                                  'group-hover:bg-primary',
                                )}
                              />
                              <span className="flex-1 truncate">{tree.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="space-y-1.5 pt-2">
                <div
                  className={cn(
                    'flex items-center justify-between rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition',
                    dragOverVoranBox && 'border-primary/60 bg-primary/10 text-primary-foreground',
                  )}
                  onDragOver={(event) => {
                    event.preventDefault();
                    onVoranDragOver();
                  }}
                  onDragLeave={onVoranDragLeave}
                  onDrop={(event) => {
                    onVoranDragLeave();
                    onDropToVoran(event);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    VORAN BOX
                  </span>
                  <Badge
                    variant="outline"
                    className="rounded-full border-border/70 px-2 py-0 text-[11px] font-medium text-muted-foreground/80"
                  >
                    {voranTrees.length}
                  </Badge>
                </div>

                {voranTrees.length > 0 ? (
                  voranTrees.map((tree) => {
                    const isActiveTree = tree.id === selectedTreeId;
                    const isSelectedInNav = navSelectedIds.includes(tree.id);
                    const isDragging = draggedTreeIds.includes(tree.id);

                    return (
                      <button
                        key={tree.id}
                        type="button"
                        tabIndex={-1}
                        draggable
                        onClick={() => onSelectTree(tree.id)}
                        onDoubleClick={() => onOpenTree(tree.id)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          onDeleteTree(tree.id);
                        }}
                        onDragStart={(event) => onDragStart(event, tree.id)}
                        onDragEnd={onDragEnd}
                        className={cn(
                          'group flex w-full items-center gap-2 rounded-md border border-transparent bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors',
                          isActiveTree && 'border-primary/60 bg-primary/10 text-foreground',
                          !isActiveTree && 'text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground',
                          !isActiveTree && isSelectedInNav && 'border-primary/40 text-foreground/90',
                          isDragging && 'opacity-60',
                        )}
                      >
                        <Monitor
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-colors',
                            (isActiveTree || isSelectedInNav) && 'text-primary',
                            'group-hover:text-primary',
                          )}
                        />
                        <span className="flex-1 truncate">{tree.title}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground/70">
                    폴더 밖에 있는 트리가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  );
};

export default LibrarySidebar;
