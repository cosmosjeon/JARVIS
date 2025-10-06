import { useCallback, useMemo } from 'react';
import {
  loadTrees,
  loadFolders,
  saveTreeMetadata,
  removeTree,
  removeNodes,
  assignTreeToFolder,
  createLibraryFolder,
} from 'features/library/services/libraryRepository';
import { createTreeForUser, openWidgetForTree, cleanupEmptyTrees, isTrackingEmptyTree } from 'features/tree/services/treeCreation';
import { createLibraryBridge, createLoggerBridge } from 'infrastructure/electron/bridges';

const EMPTY_ARRAY = Object.freeze([]);

export const mergeTreeList = (previous, nextTree) => {
  const map = new Map(previous.map((entry) => [entry.id, entry]));
  map.set(nextTree.id, nextTree);
  return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
};

const normalizeTree = (tree) => ({
  id: tree.id,
  title: tree.title || '제목 없는 트리',
  treeData: tree.treeData,
  createdAt: tree.createdAt,
  updatedAt: tree.updatedAt,
  folderId: tree.folderId || null,
});

export const useLibraryData = ({
  user,
  selectedTreeId,
  selectTree,
  setTrees,
  setFolders,
  clearTreeSelection,
  setLoading,
  setFoldersLoading,
  setError,
}) => {
  const libraryBridge = useMemo(() => createLibraryBridge(), []);
  const loggerBridge = useMemo(() => createLoggerBridge(), []);

  const refreshLibrary = useCallback(async () => {
    if (!user) {
      setTrees(EMPTY_ARRAY);
      setFolders(EMPTY_ARRAY);
      clearTreeSelection();
      selectTree?.(null);
      setLoading(false);
      setFoldersLoading(false);
      return;
    }

    setLoading(true);
    setFoldersLoading(true);
    setError(null);

    try {
      const [fetchedTrees, fetchedFolders] = await Promise.all([
        loadTrees(user.id),
        loadFolders(user.id),
      ]);

      const mappedTrees = fetchedTrees.map(normalizeTree);
      setTrees(mappedTrees);
      setFolders(fetchedFolders);

      const exists = selectedTreeId && mappedTrees.some((item) => item.id === selectedTreeId);
      if (!exists) {
        clearTreeSelection();
      }
    } catch (err) {
      setError(err);
      setTrees(EMPTY_ARRAY);
      setFolders(EMPTY_ARRAY);
      clearTreeSelection();
      selectTree?.(null);
    } finally {
      setLoading(false);
      setFoldersLoading(false);
    }
  }, [
    user?.id,
    selectedTreeId,
    clearTreeSelection,
    loadTrees,
    loadFolders,
    setError,
    setFolders,
    setFoldersLoading,
    setLoading,
      setTrees,
  ]);

  const handleCleanupEmptyTrees = useCallback(async (trees) => {
    if (!user) return;

    try {
      const deletedCount = await cleanupEmptyTrees(trees);
      if (deletedCount > 0) {
        await refreshLibrary();
      }
    } catch (err) {
      loggerBridge.log?.('warn', 'library_cleanup_empty_trees_failed', { message: err?.message });
    }
  }, [user, refreshLibrary, loggerBridge]);

  const handleCreateTree = useCallback(async () => {
    if (!user) {
      return null;
    }

    try {
      const newTree = await createTreeForUser({ userId: user.id });
      setTrees((prev) => mergeTreeList(prev, newTree));
      selectTree?.(newTree.id);
      await openWidgetForTree({ treeId: newTree.id, fresh: true });
      libraryBridge.requestLibraryRefresh?.();
      return newTree;
    } catch (err) {
      setError(err);
      return null;
    }
  }, [createTreeForUser, libraryBridge, openWidgetForTree, setError, setTrees, selectTree, user]);

  const handleTreeDelete = useCallback(async (treeId) => {
    if (!user || !treeId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await removeTree({ treeId });
      await refreshLibrary();
      if (treeId === selectedTreeId) {
        clearTreeSelection();
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedTreeId, clearTreeSelection, refreshLibrary, removeTree, setError, setLoading]);

  const handleTreeRename = useCallback(async (treeId, newTitle) => {
    if (!user || !treeId || !newTitle?.trim()) {
      return false;
    }

    try {
      await saveTreeMetadata({ treeId, title: newTitle.trim(), userId: user.id });
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, [user, refreshLibrary, saveTreeMetadata, setError]);

  const handleNodesRemove = useCallback(async ({ nodeIds }) => {
    if (!user || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return false;
    }

    try {
      await removeNodes({ nodeIds, userId: user.id });
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, [removeNodes, setError, user]);

  const handleTreeMoveToFolder = useCallback(async ({ treeId, folderId }) => {
    if (!user || !treeId) {
      return false;
    }

    try {
      await assignTreeToFolder({ treeId, folderId, userId: user.id });
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err);
      return false;
    }
  }, [assignTreeToFolder, refreshLibrary, setError, user]);

  const handleFolderCreate = useCallback(async ({ name, parentId }) => {
    if (!user || !name?.trim()) {
      return null;
    }
    try {
      const folder = await createLibraryFolder({ name: name.trim(), parentId, userId: user.id });
      await refreshLibrary();
      return folder;
    } catch (err) {
      setError(err);
      return null;
    }
  }, [createLibraryFolder, refreshLibrary, setError, user]);

  const handleWidgetShouldCleanup = useCallback((tree) => {
    if (!tree) {
      return false;
    }
    return isTrackingEmptyTree(tree.id);
  }, []);

  const handleExistingEmptyTree = useCallback((previousTree, latestTrees) => {
    const snapshot = latestTrees.find((tree) => tree.id === previousTree.id) || previousTree;
    if (snapshot?.treeData) {
      return cleanupEmptyTrees([snapshot]);
    }
    return Promise.resolve(0);
  }, []);

  return {
    libraryBridge,
    loggerBridge,
    refreshLibrary,
    handleCleanupEmptyTrees,
    handleCreateTree,
    handleTreeDelete,
    handleTreeRename,
    handleNodesRemove,
    handleTreeMoveToFolder,
    handleFolderCreate,
    handleWidgetShouldCleanup,
    handleExistingEmptyTree,
  };
};

export default useLibraryData;
