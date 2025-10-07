import React from 'react';
import Logo from 'assets/admin-widget/logo.svg';
import LibraryActionToolbar from './LibraryActionToolbar';
import LibrarySidebar from './LibrarySidebar';
import LibraryContent from './LibraryContent';
import VoranBoxManager from './components/VoranBoxManager';
import CreateDialog from './components/CreateDialog';
import useLibraryAppViewModel from 'features/library/hooks/useLibraryAppViewModel';

const LibraryApp = () => {
  const {
    user,
    signOut,
    theme,
    state,
    status,
    handlers,
    dialog,
  } = useLibraryAppViewModel();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <LibrarySidebar
        logoSrc={Logo}
        collapsed={state.isSidebarCollapsed}
        folders={state.folders}
        trees={state.trees}
        voranTrees={state.voranTrees}
        selectedTreeId={state.selectedTreeId}
        selectedFolderId={state.selectedFolderId}
        expandedFolders={state.expandedFolders}
        navSelectedIds={state.navSelectedIds}
        draggedTreeIds={state.draggedTreeIds}
        dragOverFolderId={state.dragOverFolderId}
        dragOverVoranBox={state.dragOverVoranBox}
        onManageVoranBox={handlers.showVoranBox}
        onCreateFolder={() => handlers.openCreateDialog('folder')}
        onToggleFolder={handlers.folderToggle}
        onSelectTree={handlers.sidebarTreeSelect}
        onOpenTree={handlers.openTree}
        onDeleteTree={handlers.deleteTree}
        onDragStart={handlers.navDragStart}
        onDragEnd={handlers.navDragEnd}
        onDropToFolder={handlers.navDropToFolder}
        onDropToVoran={handlers.navDropToVoran}
        onFolderDragOver={handlers.folderDragOver}
        onFolderDragLeave={handlers.folderDragLeave}
        onVoranDragOver={handlers.voranDragOver}
        onVoranDragLeave={handlers.voranDragLeave}
        onToggleCollapsed={handlers.toggleSidebar}
      />

      <main className="flex flex-1 flex-col bg-background overflow-hidden">
        <LibraryActionToolbar
          user={user}
          ActiveThemeIcon={theme.active.icon}
          activeThemeLabel={theme.active.label}
          onCycleTheme={theme.cycle}
          onRefresh={handlers.refreshLibrary}
          onCreateTree={handlers.createTree}
          onSignOut={signOut}
          isRefreshing={status.loading}
          canCreateTree={Boolean(user)}
        />
        <div className="flex-1 bg-background overflow-hidden">
          <LibraryContent
            loading={status.loading}
            user={user}
            error={status.error}
            selectedTree={state.selectedTree}
            selectedFolderId={state.selectedFolderId}
            folders={state.folders}
            selectedNode={state.selectedNode}
            onNodeSelect={handlers.nodeSelect}
            onNodeRemove={handlers.nodeRemove}
            onNodeUpdate={handlers.nodeUpdate}
            onNewNodeCreated={handlers.nodeAdd}
            onMemoCreate={handlers.memoCreate}
            onMemoUpdate={handlers.memoUpdate}
            onMemoRemove={handlers.memoRemove}
          />
        </div>
      </main>

      <VoranBoxManager
        isVisible={dialog.showVoranBoxManager}
        onClose={handlers.hideVoranBox}
        trees={state.trees}
        folders={state.folders}
        onTreeSelect={(tree) => {
          handlers.sidebarTreeSelect(tree.id, { folderId: tree.folderId ?? null });
          handlers.hideVoranBox();
        }}
        onTreeMoveToFolder={handlers.moveTreesToFolder}
        onTreeOpen={handlers.openTree}
        onTreeRename={handlers.renameTree}
        onTreeDelete={handlers.deleteTree}
        onFolderCreate={(name, parentId) => handlers.folderCreate({ name, parentId })}
        onFolderSelect={handlers.folderSelect}
        selectedTreeId={state.selectedTreeId}
        selectedFolderId={state.selectedFolderId}
        loading={status.loading || status.foldersLoading}
      />

      <CreateDialog
        open={dialog.showCreateDialog}
        onOpenChange={handlers.toggleCreateDialog}
        type={dialog.createType}
        folders={state.folders}
        onFolderCreate={(name, parentId) => handlers.folderCreate({ name, parentId })}
        onMemoCreate={() => {}}
      />
    </div>
  );
};

export default LibraryApp;
