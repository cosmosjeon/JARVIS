import React, { useMemo, useState } from 'react';
import { ScrollArea } from 'shared/ui/scroll-area';
import { Button } from 'shared/ui/button';
import { Badge } from 'shared/ui/badge';
import { cn } from 'shared/utils';
import ContextMenu from 'shared/ui/ContextMenu';
import FolderSelectModal from 'shared/ui/FolderSelectModal';
import {
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder as FolderIcon,
  GitBranch,
  Monitor,
  Move,
  Plus,
  Trash2,
} from 'lucide-react';

const FALLBACK_THEME_LABEL = '테마';

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
  onCycleTheme = () => {},
  onRefresh = () => {},
  onSignOut = () => {},
  activeThemeLabel,
  ActiveThemeIcon,
  user,
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

  const ThemeIcon = ActiveThemeIcon;
  const userLabel = user?.email || user?.user_metadata?.full_name || '게스트';
  const themeLabel = activeThemeLabel || FALLBACK_THEME_LABEL;

  const canSignOut = Boolean(user);

  // 컨텍스트 메뉴 상태
  const [folderSelectModal, setFolderSelectModal] = useState({
    open: false,
    targetTreeId: null,
    targetTreeName: '',
  });

  const toggleLabel = collapsed ? '사이드바 펼치기' : '사이드바 접기';
  const handleToggleCollapsed = () => {
    if (onToggleCollapsed) {
      onToggleCollapsed();
    }
  };

  // 컨텍스트 메뉴 핸들러들
  const handleMoveTree = (treeId, treeName) => {
    setFolderSelectModal({
      open: true,
      targetTreeId: treeId,
      targetTreeName: treeName,
    });
  };

  const handleDeleteTree = (treeId) => {
    if (onDeleteTree) {
      onDeleteTree(treeId);
    }
  };

  const handleFolderSelect = (folderId, folderName) => {
    // 트리를 선택된 폴더로 이동
    if (onMoveTreesToFolder) {
      onMoveTreesToFolder([folderSelectModal.targetTreeId], folderId);
    }
    setFolderSelectModal({
      open: false,
      targetTreeId: null,
      targetTreeName: '',
    });
  };

  const handleFolderSelectCancel = () => {
    setFolderSelectModal({
      open: false,
      targetTreeId: null,
      targetTreeName: '',
    });
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
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
      aria-expanded={!collapsed}
    >
      {collapsed ? (
        <div className="flex flex-1 items-center justify-center">
          {renderToggleButton(true)}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-border px-3 pt-8 pb-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-w-0 justify-between rounded-lg border border-border/70 bg-card px-2 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-card/90 hover:shadow-md"
              onClick={onManageVoranBox}
            >
              <span className="flex items-center gap-1.5">
                <Box className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">BOX</span>
              </span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">관리</span>
            </Button>
            {renderToggleButton(false, 'ml-4 flex-shrink-0')}
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2 px-2 py-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-1.5 py-1.5 text-left text-xs text-foreground shadow-sm transition hover:border-border hover:bg-accent/30 sm:flex-1"
                  onClick={onCreateFolder}
                >
                  <span className="flex items-center gap-1.5">
                    <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">새 폴더</span>
                  </span>
                  <span className="text-xs text-muted-foreground">+</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-1.5 py-1.5 text-xs font-medium shadow-sm transition hover:border-border hover:bg-accent/30 sm:flex-1"
                  onClick={onCreateTree}
                  disabled={!canCreateTree || isLoading}
                >
                  <span className="flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span className="truncate">새 트리</span>
                  </span>
                  <span className="text-xs text-muted-foreground">+</span>
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
                        'group flex w-full items-center gap-1.5 rounded-lg border border-transparent bg-card/70 px-1.5 py-1.5 text-left text-xs font-medium shadow-sm transition-colors',
                        isActiveFolder && 'border-primary/60 bg-primary/10 text-foreground',
                        !isActiveFolder && 'text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground',
                        isDragTarget && 'ring-2 ring-primary/50',
                      )}
                    >
                      {folderTrees.length > 0 ? (
                        isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <FolderIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                      )}
                      <span className="flex-1 truncate text-xs">{folder.name}</span>
                      <Badge
                        variant="secondary"
                        className="ml-auto rounded-full border border-border/60 bg-card px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                      >
                        {folderTrees.length}
                      </Badge>
                    </button>

                    {isExpanded && folderTrees.length > 0 && (
                      <div className="ml-4 space-y-1.5">
                        {folderTrees.map((tree) => {
                          const isActiveTree = tree.id === selectedTreeId;
                          const isSelectedInNav = navSelectedIds.includes(tree.id);
                          const isDragging = draggedTreeIds.includes(tree.id);

                          return (
                            <ContextMenu
                              key={tree.id}
                              items={[
                                {
                                  label: '옮기기',
                                  icon: <Move className="h-4 w-4" />,
                                  onClick: () => handleMoveTree(tree.id, tree.title),
                                },
                                {
                                  label: '삭제',
                                  icon: <Trash2 className="h-4 w-4" />,
                                  onClick: () => handleDeleteTree(tree.id),
                                  danger: true,
                                },
                              ]}
                            >
                              <button
                                type="button"
                                tabIndex={-1}
                                draggable
                                onClick={() => onSelectTree(tree.id, { folderId: folder.id })}
                                onDoubleClick={() => onOpenTree(tree.id)}
                                onDragStart={(event) => onDragStart(event, tree.id)}
                                onDragEnd={onDragEnd}
                                className={cn(
                                  'group flex w-full items-center gap-1.5 rounded-md border border-transparent bg-card px-1.5 py-1.5 text-left text-xs shadow-sm transition-colors',
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
                                <span className="flex-1 truncate text-xs">{tree.title}</span>
                              </button>
                            </ContextMenu>
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
                    <Box className="h-4 w-4 text-muted-foreground" />
                    BOX
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
                      <ContextMenu
                        key={tree.id}
                        items={[
                          {
                            label: '옮기기',
                            icon: <Move className="h-4 w-4" />,
                            onClick: () => handleMoveTree(tree.id, tree.title),
                          },
                          {
                            label: '삭제',
                            icon: <Trash2 className="h-4 w-4" />,
                            onClick: () => handleDeleteTree(tree.id),
                            danger: true,
                          },
                        ]}
                      >
                        <button
                          type="button"
                          tabIndex={-1}
                          draggable
                          onClick={() => onSelectTree(tree.id)}
                          onDoubleClick={() => onOpenTree(tree.id)}
                          onDragStart={(event) => onDragStart(event, tree.id)}
                          onDragEnd={onDragEnd}
                          className={cn(
                            'group flex w-full items-center gap-1.5 rounded-md border border-transparent bg-card px-1.5 py-1.5 text-left text-xs shadow-sm transition-colors',
                            isActiveTree && 'border-primary/60 bg-primary/10 text-foreground',
                            !isActiveTree && 'text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground',
                            !isActiveTree && isSelectedInNav && 'border-primary/40 text-foreground/90',
                            isDragging && 'opacity-60',
                          )}
                        >
                          <Monitor
                            className={cn(
                              'h-3.5 w-3.5 text-muted-foreground transition-colors',
                              (isActiveTree || isSelectedInNav) && 'text-primary',
                              'group-hover:text-primary',
                            )}
                          />
                          <span className="flex-1 truncate text-xs">{tree.title}</span>
                        </button>
                      </ContextMenu>
                    );
                  })
                ) : (
                  <p className="px-1.5 py-1.5 text-[11px] text-muted-foreground/70">
                    폴더 밖에 있는 트리가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="border-t border-border px-2 py-2 space-y-1.5">
            <div className="text-xs text-muted-foreground/80">
              {canSignOut ? (
                <span className="font-medium text-foreground">{userLabel}</span>
              ) : (
                <span className="font-medium text-muted-foreground">로그인 필요</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border bg-background/40 text-card-foreground"
                onClick={onCycleTheme}
                title={`테마 변경 (현재: ${themeLabel})`}
              >
                {ThemeIcon ? <ThemeIcon className="h-4 w-4" /> : <span className="text-xs">🎨</span>}
                <span className="sr-only">테마 변경</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="border-border bg-background/40 text-card-foreground hover:bg-background/60"
              >
                {isLoading ? '새로고침 중' : '새로고침'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSignOut}
                disabled={!canSignOut}
                className="text-muted-foreground hover:text-card-foreground disabled:opacity-60"
              >
                로그아웃
              </Button>
            </div>
          </div>
        </>
      )}

      <FolderSelectModal
        open={folderSelectModal.open}
        onOpenChange={(open) => setFolderSelectModal(prev => ({ ...prev, open }))}
        folders={folders}
        onSelect={handleFolderSelect}
        onCancel={handleFolderSelectCancel}
        selectedItemName={folderSelectModal.targetTreeName}
      />
    </aside>
  );
};

export default LibrarySidebar;
