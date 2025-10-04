import React, { useMemo } from 'react';
import { ScrollArea } from 'shared/ui/scroll-area';
import { Button } from 'shared/ui/button';
import { Badge } from 'shared/ui/badge';
import { cn } from 'shared/utils';
import {
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  Monitor,
  Sparkles,
} from 'lucide-react';

const LibrarySidebar = ({
  logoSrc,
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

  return (
    <aside className="flex h-full w-[320px] flex-col border-r border-border bg-card text-card-foreground overflow-hidden">
      <div className="border-b border-border px-5 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
            {logoSrc ? <img src={logoSrc} alt="VORAN" className="h-7 w-7" /> : null}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
              Knowledge Library
            </p>
            <h1 className="text-lg font-semibold leading-tight text-card-foreground">
              저장된 트리
            </h1>
            <p className="text-xs text-muted-foreground">
              라이브러리에서 열 트리를 선택하세요.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between rounded-lg border border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-card/90 hover:shadow-md"
          onClick={onManageVoranBox}
        >
          <span className="flex items-center gap-2">
            <FolderIcon className="h-4 w-4 text-muted-foreground" />
            VORAN BOX
          </span>
          <span className="text-xs text-muted-foreground">관리</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 px-4 py-6">
          <Button
            type="button"
            variant="outline"
            className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-sm text-foreground shadow-sm transition hover:border-border hover:bg-accent/30"
            onClick={onCreateFolder}
          >
            <span className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              New Folder
            </span>
            <span className="text-xs text-muted-foreground">+</span>
          </Button>

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
                              'group-hover:bg-primary'
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
                        'group-hover:text-primary'
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
    </aside>
  );
};

export default LibrarySidebar;
