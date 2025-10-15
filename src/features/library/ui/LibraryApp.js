import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import LibrarySidebar from './LibrarySidebar';
import LibraryContent from './LibraryContent';
import VoranBoxManager from './components/VoranBoxManager';
import CreateDialog from './components/CreateDialog';
import LibraryWindowTitleBar from './components/LibraryWindowTitleBar';
import LibrarySettingsDialog from './components/LibrarySettingsDialog';
import useLibraryAppViewModel from 'features/library/hooks/useLibraryAppViewModel';
import { getRuntimeLabel, constants as runtimeConstants } from 'shared/utils/platform';

const LibraryApp = ({ runtime }) => {
  const {
    user,
    signOut,
    theme,
    state,
    status,
    handlers,
    dialog,
  } = useLibraryAppViewModel();

  const runtimeLabel = useMemo(() => runtime || getRuntimeLabel(), [runtime]);
  const isElectronRuntime = runtimeLabel === runtimeConstants.RUNTIME_ELECTRON;
  const sidebarWidth = state.isSidebarCollapsed ? 60 : 240;
  const dragZoneHeight = state.isQAPanelVisible !== false ? '20px' : '80px';

  return (
    <div className="relative flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {isElectronRuntime ? (
        <>
          <div
            className="absolute right-0 top-0 z-[9999]"
            style={{
              left: `${sidebarWidth}px`,
              height: dragZoneHeight,
              WebkitAppRegion: 'drag',
              pointerEvents: 'auto',
            }}
          />
          <LibraryWindowTitleBar />
        </>
      ) : null}
      <div className="flex flex-1 overflow-hidden">
        <LibrarySidebar
          isElectron={isElectronRuntime}
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
          onCreateTreeWidget={isElectronRuntime ? handlers.createTreeWidget : undefined}
          onCreateTreeInApp={handlers.createTreeInApp}
          onCycleTheme={theme.cycle}
          onRefresh={handlers.refreshLibrary}
          onSignOut={signOut}
          activeThemeLabel={theme.active.label}
          ActiveThemeIcon={theme.active.icon}
          user={user}
          canCreateTree={Boolean(user)}
          isLoading={status.loading}
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
          onMoveTreesToFolder={handlers.moveTreesToFolder}
          onOpenSettings={handlers.showSettingsDialog}
        />

        <main className="flex flex-1 flex-col bg-background overflow-hidden">
          <div className="flex-1 bg-background overflow-hidden">
            <LibraryContent
              loading={status.loading}
              user={user}
              error={status.error}
              selectedTree={state.selectedTree}
              selectedFolderId={state.selectedFolderId}
              folders={state.folders}
              selectedNode={state.selectedNode}
              isQAPanelVisible={state.isQAPanelVisible}
              libraryIntroTreeId={state.libraryIntroTreeId}
              isLibraryIntroActive={state.isLibraryIntroActive}
              onLibraryIntroComplete={handlers.completeLibraryIntro}
              onNodeSelect={handlers.nodeSelect}
              onNodeRemove={handlers.nodeRemove}
              onNodeUpdate={handlers.nodeUpdate}
              onNewNodeCreated={handlers.nodeAdd}
              onTreeRename={handlers.renameTree}
              onQAPanelClose={handlers.hideQAPanel}
            />
          </div>
        </main>
      </div>

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
      />

      <LibrarySettingsDialog
        open={dialog.showSettingsDialog}
        onOpenChange={handlers.setShowSettingsDialog}
        user={user}
        ActiveThemeIcon={theme.active.icon}
        activeThemeLabel={theme.active.label}
        onCycleTheme={theme.cycle}
        onRefresh={handlers.refreshLibrary}
        onSignOut={signOut}
        isRefreshing={status.loading}
      />
    </div>
  );
};

export default LibraryApp;

LibraryApp.propTypes = {
  runtime: PropTypes.string,
};
