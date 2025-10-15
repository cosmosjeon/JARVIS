import React, { useMemo, useState } from 'react';
import { ScrollArea } from 'shared/ui/scroll-area';
import { Button } from 'shared/ui/button';
import { Badge } from 'shared/ui/badge';
import { cn } from 'shared/utils';
import ContextMenu from 'shared/ui/ContextMenu';
import FolderSelectModal from 'shared/ui/FolderSelectModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'shared/ui/tooltip';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  GitBranch,
  MessageSquare,
  Monitor,
  Move,
  Network,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'shared/ui/dropdown-menu';

const FALLBACK_THEME_LABEL = '테마';

const LibrarySidebar = ({
  folders,
  trees,
  voranTrees = [],
  selectedTreeId,
  selectedFolderId,
  expandedFolders,
  navSelectedIds,
  draggedTreeIds,
  dragOverFolderId,
  dragOverVoranBox,
  onManageVoranBox,
  onCreateFolder,
  onCreateTreeWidget,
  onCreateTreeInApp,
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
  onOpenSettings,
  isElectron = true,
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
  const widgetActionsEnabled = isElectron && typeof onCreateTreeWidget === 'function';
  const voranBoxEnabled = isElectron && typeof onManageVoranBox === 'function';
  const displayedVoranTrees = isElectron ? voranTrees : [];

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
  const ToggleIcon = collapsed ? PanelRight : PanelLeft;

  const renderToggleButton = (isCollapsed, className = '') => (
    <button
      type="button"
      onClick={handleToggleCollapsed}
      className={cn(
        'rounded-lg border border-border/70 bg-card px-2 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-card/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background flex items-center justify-center',
        isCollapsed ? 'h-8 w-8 px-0' : 'h-8 w-8 px-0',
        className,
      )}
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <ToggleIcon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          'library-sidebar relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-card text-card-foreground transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-[60px]' : 'w-[240px]',
        )}
        style={isElectron ? { WebkitAppRegion: 'drag' } : undefined}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <>
            <div className="flex items-center justify-center px-2 pt-8 pb-4">
              {renderToggleButton(true)}
            </div>
            
            <ScrollArea className="flex-1">
              <div className="flex flex-col items-center gap-2 px-2 py-3">
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-lg"
                          disabled={!canCreateTree || isLoading}
                        >
                          <GitBranch className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right" style={{ WebkitAppRegion: 'no-drag' }}>
                      <p>새 트리</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent
                    align="start"
                    side="right"
                    className="w-48 z-[9999]"
                    style={{ WebkitAppRegion: 'no-drag' }}
                  >
                    {widgetActionsEnabled ? (
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          onCreateTreeWidget?.();
                        }}
                        disabled={!canCreateTree || isLoading}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">위젯으로 생성</span>
                          <span className="text-[11px] text-muted-foreground">독립 위젯에서 시작</span>
                        </div>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        onCreateTreeInApp?.();
                      }}
                      disabled={!canCreateTree || isLoading}
                      className="flex items-center gap-2 text-xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">라이브러리에서 생성</span>
                        <span className="text-[11px] text-muted-foreground">앱에서 바로 시작</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-full border-t border-border my-2" />

                {folders.map((folder) => {
                  const folderTrees = folderTreeMap.get(folder.id) || [];
                  const isFolderSelected = selectedFolderId === folder.id;
                  const hasSelectedTree = folderTrees.some((tree) => tree.id === selectedTreeId);
                  const isActiveFolder = isFolderSelected || hasSelectedTree;
                  const isDragTarget = dragOverFolderId === folder.id;

                  return (
                    <div key={folder.id} className="relative flex items-center justify-center">
                      <DropdownMenu>
                        <Tooltip open={isDragTarget ? false : undefined}>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  onFolderDragOver(folder.id);
                                }}
                                onDragLeave={() => onFolderDragLeave(folder.id)}
                                onDrop={(event) => onDropToFolder(event, folder.id)}
                                className={cn(
                                  'h-9 w-9 flex items-center justify-center rounded-lg border transition-colors',
                                  isActiveFolder && 'border-primary/60 bg-primary/10 text-foreground',
                                  !isActiveFolder && 'border-transparent hover:border-border/70 hover:bg-card text-muted-foreground hover:text-foreground',
                                  isDragTarget && 'ring-2 ring-primary/50 border-primary/60',
                                )}
                              >
                                <FolderIcon className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="right" style={{ WebkitAppRegion: 'no-drag' }}>
                            <p>{folder.name} ({folderTrees.length})</p>
                          </TooltipContent>
                        </Tooltip>
                      <DropdownMenuContent 
                        align="start" 
                        side="right" 
                        className="w-56 max-h-96 overflow-y-auto z-[9999]"
                        style={{ WebkitAppRegion: 'no-drag' }}
                      >
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
                          {folder.name}
                        </div>
                        {folderTrees.length > 0 ? (
                          folderTrees.map((tree) => {
                            const isActiveTree = tree.id === selectedTreeId;
                            const isDragging = draggedTreeIds.includes(tree.id);
                            return (
                              <DropdownMenuItem
                                key={tree.id}
                                onSelect={(event) => {
                                  event.preventDefault();
                                  onSelectTree(tree.id, { folderId: folder.id });
                                }}
                                draggable
                                onDragStart={(event) => {
                                  onDragStart(event, tree.id);
                                  // 드롭다운을 닫기 위해 blur
                                  event.currentTarget.blur();
                                }}
                                onDragEnd={onDragEnd}
                                className={cn(
                                  "flex items-center gap-2 text-xs cursor-pointer",
                                  isActiveTree && "bg-primary/10 text-primary",
                                  isDragging && "opacity-60"
                                )}
                              >
                                <span
                                  className={cn(
                                    'h-2 w-2 rounded-full shrink-0',
                                    isActiveTree ? 'bg-primary' : 'bg-primary/50'
                                  )}
                                />
                                <span className="flex-1 truncate">{tree.title}</span>
                              </DropdownMenuItem>
                            );
                          })
                        ) : (
                          <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                            트리가 없습니다
                          </div>
                        )}
                      </DropdownMenuContent>
                      </DropdownMenu>
                      
                      {isDragTarget && (
                        <div 
                          className="fixed left-16 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md pointer-events-none whitespace-nowrap"
                          style={{ 
                            WebkitAppRegion: 'no-drag',
                            zIndex: 999999
                          }}
                        >
                          <p>{folder.name} ({folderTrees.length})</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="w-full border-t border-border my-2" />

                {displayedVoranTrees.map((tree) => {
                  const isActiveTree = tree.id === selectedTreeId;
                  const isDragging = draggedTreeIds.includes(tree.id);

                  return (
                    <Tooltip key={tree.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          draggable
                          onClick={() => onSelectTree(tree.id)}
                          onDoubleClick={() => onOpenTree(tree.id)}
                          onDragStart={(event) => onDragStart(event, tree.id)}
                          onDragEnd={onDragEnd}
                          className={cn(
                            'h-9 w-9 flex items-center justify-center rounded-lg border transition-colors',
                            isActiveTree && 'border-primary/60 bg-primary/10',
                            !isActiveTree && 'border-transparent hover:border-border/70 hover:bg-card',
                            isDragging && 'opacity-60',
                          )}
                        >
                          <Network className={cn('h-4 w-4', isActiveTree ? 'text-primary' : 'text-muted-foreground')} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" style={{ WebkitAppRegion: 'no-drag' }}>
                        <p>{tree.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="border-t border-border px-2 py-2 flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={onCycleTheme}
                  >
                    {ThemeIcon ? <ThemeIcon className="h-4 w-4" /> : <span className="text-xs">🎨</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" style={{ WebkitAppRegion: 'no-drag' }}>
                  <p>{themeLabel}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={onRefresh}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" style={{ WebkitAppRegion: 'no-drag' }}>
                  <p>새로고침</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={onOpenSettings}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" style={{ WebkitAppRegion: 'no-drag' }}>
                  <p>설정</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-4">
              {voranBoxEnabled ? (
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
              ) : (
                <div className="flex-1 min-w-0 truncate text-xs font-medium text-muted-foreground/80">
                  라이브러리
                </div>
              )}
              {renderToggleButton(false, 'ml-auto flex-shrink-0')}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-1.5 py-1.5 text-xs font-medium shadow-sm transition hover:border-border hover:bg-accent/30 sm:flex-1"
                      disabled={!canCreateTree || isLoading}
                    >
                      <span className="flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5" />
                        <span className="truncate">새 트리</span>
                      </span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {widgetActionsEnabled ? (
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          onCreateTreeWidget?.();
                        }}
                        disabled={!canCreateTree || isLoading}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">위젯으로 생성</span>
                          <span className="text-[11px] text-muted-foreground">현재처럼 독립 위젯에서 시작</span>
                        </div>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        onCreateTreeInApp?.();
                      }}
                      disabled={!canCreateTree || isLoading}
                      className="flex items-center gap-2 text-xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">라이브러리에서 생성</span>
                        <span className="text-[11px] text-muted-foreground">앱 중앙에서 바로 질문 시작</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

              {isElectron ? (
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
                      {displayedVoranTrees.length}
                    </Badge>
                  </div>

                  {displayedVoranTrees.length > 0 ? (
                    displayedVoranTrees.map((tree) => {
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
                            <Network
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
              ) : null}
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
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border bg-background/40 text-card-foreground hover:bg-background/60"
                onClick={onOpenSettings}
                title="설정 열기"
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">설정</span>
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
    </TooltipProvider>
  );
};

export default LibrarySidebar;
