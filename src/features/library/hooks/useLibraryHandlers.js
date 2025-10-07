import { useCallback, useMemo } from 'react';

export const useLibraryHandlers = ({
  actions,
  dataApi,
  dragHandlers,
  memoController,
  nodeController,
  nodeRemoval,
  treeOperations,
}) => {
  const {
    navDragStart,
    navDragEnd,
    navDropToFolder,
    navDropToVoran,
    folderDragOver,
    folderDragLeave,
    voranDragOver,
    voranDragLeave,
  } = dragHandlers;

  const { updateNode, addNode } = nodeController;

  const sidebarTreeSelect = useCallback((treeId, options = {}) => {
    if (!treeId) {
      return;
    }
    actions.selection.selectTree(treeId, options);
  }, [actions.selection]);

  const folderSelect = useCallback((folderId) => {
    actions.selection.selectFolder(folderId ?? null);
  }, [actions.selection]);

  const folderToggle = useCallback((folderId) => {
    if (!folderId) {
      return;
    }
    actions.folder.toggleFolder(folderId);
    actions.folder.setSelectedFolderId(folderId);
  }, [actions.folder]);

  const nodeAdd = useCallback((node, link, options = {}) => {
    addNode(node, link);
    if (options.select !== false) {
      actions.selection.setSelectedNode(node);
    }
  }, [actions.selection, addNode]);

  const toggleCreateDialog = useCallback((open) => {
    if (open) {
      actions.modal.setShowCreateDialog(true);
      return;
    }
    actions.modal.setShowCreateDialog(false);
  }, [actions.modal]);

  return useMemo(() => ({
    refreshLibrary: dataApi.refreshLibrary,
    createTree: treeOperations.createTree,
    openTree: treeOperations.openTree,
    deleteTree: treeOperations.deleteTree,
    renameTree: treeOperations.renameTree,
    folderCreate: treeOperations.createFolder,
    folderSelect,
    folderToggle,
    sidebarTreeSelect,
    nodeSelect: actions.selection.setSelectedNode,
    nodeUpdate: updateNode,
    nodeAdd,
    nodeRemove: nodeRemoval,
    memoCreate: memoController.create,
    memoUpdate: memoController.update,
    memoRemove: memoController.remove,
    navDragStart,
    navDragEnd,
    navDropToFolder,
    navDropToVoran,
    folderDragOver,
    folderDragLeave,
    voranDragOver,
    voranDragLeave,
    showVoranBox: actions.modal.showVoranBox,
    hideVoranBox: actions.modal.hideVoranBox,
    openCreateDialog: actions.modal.openCreateDialog,
    toggleCreateDialog,
    toggleSidebar: actions.layout.toggleSidebar,
    moveTreesToFolder: dataApi.moveTreesToFolder,
  }), [
    actions.modal.hideVoranBox,
    actions.modal.openCreateDialog,
    actions.modal.setShowCreateDialog,
    actions.modal.showVoranBox,
    actions.layout.toggleSidebar,
    actions.selection.setSelectedNode,
    dataApi.moveTreesToFolder,
    dataApi.refreshLibrary,
    folderDragLeave,
    folderDragOver,
    folderSelect,
    folderToggle,
    memoController.create,
    memoController.remove,
    memoController.update,
    navDragEnd,
    navDragStart,
    navDropToFolder,
    navDropToVoran,
    nodeAdd,
    updateNode,
    nodeRemoval,
    sidebarTreeSelect,
    toggleCreateDialog,
    treeOperations.createFolder,
    treeOperations.createTree,
    treeOperations.deleteTree,
    treeOperations.openTree,
    treeOperations.renameTree,
    voranDragLeave,
    voranDragOver,
  ]);
};

export default useLibraryHandlers;
