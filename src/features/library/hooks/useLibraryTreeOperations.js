import { useCallback, useMemo } from 'react';

import { DEFAULT_TREE_CREATION_MODE, TREE_CREATION_MODES } from 'features/library/constants/creationModes';

export const useLibraryTreeOperations = ({ actions, dataApi }) => {
  const createTree = useCallback(async ({ mode = DEFAULT_TREE_CREATION_MODE } = {}) => {
    const created = await dataApi.handleCreateTree({ mode });
    if (created?.id) {
      actions.selection.selectTree(created.id);
      if (mode === TREE_CREATION_MODES.LIBRARY_APP) {
        actions.flow.startLibraryIntro(created.id);
        actions.layout.showQAPanel();
      } else {
        actions.flow.clearLibraryIntro();
      }
    }
    return created;
  }, [actions.flow, actions.layout, actions.selection, dataApi]);

  const createTreeWidget = useCallback(() => createTree({ mode: TREE_CREATION_MODES.WIDGET }), [createTree]);

  const createTreeInApp = useCallback(() => createTree({ mode: TREE_CREATION_MODES.LIBRARY_APP }), [createTree]);

  const openTree = useCallback(async (treeId) => {
    if (!treeId) {
      return;
    }
    try {
      await dataApi.handleOpenTree({ treeId, fresh: false });
    } catch {
      // dataApi에서 에러 처리
    }
  }, [dataApi]);

  const deleteTree = useCallback((treeId) => dataApi.handleTreeDelete(treeId), [dataApi]);

  const renameTree = useCallback((treeId, name) => dataApi.handleTreeRename(treeId, name), [dataApi]);

  const createFolder = useCallback((payload) => dataApi.handleFolderCreate(payload), [dataApi]);

  return useMemo(() => ({
    createTree: createTreeWidget,
    createTreeWidget,
    createTreeInApp,
    openTree,
    deleteTree,
    renameTree,
    createFolder,
  }), [createFolder, createTree, createTreeInApp, createTreeWidget, deleteTree, openTree, renameTree]);
};

export default useLibraryTreeOperations;
