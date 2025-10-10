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
      // 새 노드를 추가하고 선택하면 AI 패널을 자동으로 켬
      actions.layout.showQAPanel();
    }
    if (node?.treeId) {
      actions.flow.clearLibraryIntro(node.treeId);
    }
  }, [actions.flow, actions.layout, actions.selection, addNode]);

  const toggleCreateDialog = useCallback((open) => {
    if (open) {
      actions.modal.setShowCreateDialog(true);
      return;
    }
    actions.modal.setShowCreateDialog(false);
  }, [actions.modal]);

  const nodeSelect = useCallback((node) => {
    actions.selection.setSelectedNode(node);
    // 노드를 선택하면 AI 패널을 자동으로 다시 켬
    if (node) {
      actions.layout.showQAPanel();
    }
  }, [actions.selection, actions.layout]);

  return useMemo(() => ({
    refreshLibrary: dataApi.refreshLibrary,
    createTree: treeOperations.createTree,
    createTreeWidget: treeOperations.createTreeWidget,
    createTreeInApp: treeOperations.createTreeInApp,
    openTree: treeOperations.openTree,
    deleteTree: treeOperations.deleteTree,
    renameTree: treeOperations.renameTree,
    folderCreate: treeOperations.createFolder,
    folderSelect,
    folderToggle,
    sidebarTreeSelect,
    nodeSelect,
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
    hideQAPanel: actions.layout.hideQAPanel,
    showQAPanel: actions.layout.showQAPanel,
    toggleQAPanel: actions.layout.toggleQAPanel,
    moveTreesToFolder: dataApi.moveTreesToFolder,
    startLibraryIntro: actions.flow.startLibraryIntro,
    completeLibraryIntro: actions.flow.clearLibraryIntro,
    showSettingsDialog: actions.modal.showSettingsDialog,
    hideSettingsDialog: actions.modal.hideSettingsDialog,
    setShowSettingsDialog: actions.modal.setShowSettingsDialog,
  }), [
    actions.modal.hideVoranBox,
    actions.modal.openCreateDialog,
    actions.modal.setShowCreateDialog,
    actions.modal.showVoranBox,
    actions.modal.showSettingsDialog,
    actions.modal.hideSettingsDialog,
    actions.modal.setShowSettingsDialog,
    actions.layout.toggleSidebar,
    actions.layout.hideQAPanel,
    actions.layout.showQAPanel,
    actions.layout.toggleQAPanel,
    actions.flow.startLibraryIntro,
    actions.flow.clearLibraryIntro,
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
    nodeSelect,
    updateNode,
    nodeRemoval,
    sidebarTreeSelect,
    toggleCreateDialog,
    treeOperations.createFolder,
    treeOperations.createTree,
    treeOperations.createTreeInApp,
    treeOperations.createTreeWidget,
    treeOperations.deleteTree,
    treeOperations.openTree,
    treeOperations.renameTree,
    voranDragLeave,
    voranDragOver,
  ]);
};

export default useLibraryHandlers;
