import { useCallback, useMemo } from 'react';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import { useTheme } from 'shared/components/library/ThemeProvider';
import { useLibraryState } from 'features/library/state/useLibraryState';
import { useLibraryThemeController } from './useLibraryThemeController';
import { useLibraryData } from './useLibraryData';
import { useLibraryMemoController } from './useLibraryMemoController';
import { useLibraryNodeController } from './useLibraryNodeController';
import { useLibraryTreeOperations } from './useLibraryTreeOperations';
import { useLibraryNodeRemoval } from './useLibraryNodeRemoval';
import { useLibraryDragController } from './useLibraryDragController';
import { useLibraryLifecycle } from './useLibraryLifecycle';
import { useLibraryHandlers } from './useLibraryHandlers';

export const useLibraryAppViewModel = () => {
  const { user, signOut } = useSupabaseAuth();
  const { theme, setTheme } = useTheme();
  const { state, actions, selectors } = useLibraryState();
  const themeController = useLibraryThemeController({ theme, setTheme });

  const dataApi = useLibraryData({
    user,
    trees: state.trees,
    selectedTreeId: state.selectedTreeId,
    selectTree: actions.selection.selectTree,
    setTrees: actions.data.setTrees,
    setFolders: actions.data.setFolders,
    clearTreeSelection: actions.selection.clearTreeSelection,
    setLoading: actions.data.setLoading,
    setFoldersLoading: actions.data.setFoldersLoading,
    setError: actions.data.setError,
  });

  const memoController = useLibraryMemoController({
    setTrees: actions.data.setTrees,
    getSelectedTree: () => selectors.selectedTree,
  });

  const nodeController = useLibraryNodeController({
    setTrees: actions.data.setTrees,
    getSelectedTree: () => selectors.selectedTree,
  });

  const treeOperations = useLibraryTreeOperations({ actions, dataApi });
  const nodeRemoval = useLibraryNodeRemoval({ actions, dataApi, selectors });
  const dragHandlers = useLibraryDragController({ actions, state, dataApi });

  useLibraryLifecycle({ actions, dataApi, selectors, state, user });

  const handlers = useLibraryHandlers({
    actions,
    dataApi,
    dragHandlers,
    memoController,
    nodeController,
    nodeRemoval,
    treeOperations,
  });

  const handleSignOut = useCallback(() => {
    signOut?.();
  }, [signOut]);

  const viewState = useMemo(() => ({
    trees: state.trees,
    folders: state.folders,
    selectedTree: selectors.selectedTree,
    selectedTreeId: state.selectedTreeId,
    selectedFolderId: state.selectedFolderId,
    selectedNode: state.selectedNode,
    expandedFolders: state.expandedFolders,
    navSelectedIds: state.navSelectedIds,
    draggedTreeIds: state.draggedTreeIds,
    dragOverFolderId: state.dragOverFolderId,
    dragOverVoranBox: state.dragOverVoranBox,
    voranTrees: selectors.voranTrees,
    isSidebarCollapsed: state.isSidebarCollapsed,
    isQAPanelVisible: state.isQAPanelVisible,
  }), [
    selectors.selectedTree,
    selectors.voranTrees,
    state.dragOverFolderId,
    state.dragOverVoranBox,
    state.draggedTreeIds,
    state.expandedFolders,
    state.folders,
    state.navSelectedIds,
    state.selectedFolderId,
    state.selectedNode,
    state.selectedTreeId,
    state.trees,
    state.isSidebarCollapsed,
    state.isQAPanelVisible,
  ]);

  const status = useMemo(() => ({
    loading: state.loading,
    foldersLoading: state.foldersLoading,
    error: state.error,
  }), [state.error, state.foldersLoading, state.loading]);

  const dialog = useMemo(() => ({
    showVoranBoxManager: state.showVoranBoxManager,
    showCreateDialog: state.showCreateDialog,
    createType: state.createType,
  }), [state.createType, state.showCreateDialog, state.showVoranBoxManager]);

  return {
    user,
    signOut: handleSignOut,
    theme: {
      active: themeController.active,
      cycle: themeController.cycleTheme,
    },
    state: viewState,
    status,
    handlers,
    dialog,
  };
};

export default useLibraryAppViewModel;
