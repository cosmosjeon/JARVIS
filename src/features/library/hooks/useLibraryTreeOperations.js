import { useCallback, useMemo } from 'react';

export const useLibraryTreeOperations = ({ actions, dataApi }) => {
  const createTree = useCallback(async () => {
    const created = await dataApi.handleCreateTree();
    if (created?.id) {
      actions.selection.selectTree(created.id);
    }
    return created;
  }, [actions.selection, dataApi]);

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
    createTree,
    openTree,
    deleteTree,
    renameTree,
    createFolder,
  }), [createFolder, createTree, deleteTree, openTree, renameTree]);
};

export default useLibraryTreeOperations;
