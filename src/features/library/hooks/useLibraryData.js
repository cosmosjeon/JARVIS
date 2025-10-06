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
import {
  createTreeForUser,
  openWidgetForTree,
  cleanupEmptyTrees,
  isTrackingEmptyTree,
} from 'features/tree/services/treeCreation';
import { createLibraryBridge, createLoggerBridge } from 'infrastructure/electron/bridges';
import {
  planTreeMoves,
  applyTreeMovePlan,
  revertTreeMovePlan,
  summariseMovePlan,
  buildUndoSnapshot,
} from 'features/library/services/treeMovePlanner';

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

const mapMoveFailure = (error, id) => ({
  id,
  message: error?.message || '지식 트리를 이동하지 못했습니다.',
});

const createTreeMoveExecutor = ({ assignTree, saveMetadata, userId }) => async (moves) => {
  const successIds = [];
  const failures = [];

  for (const move of moves) {
    try {
      await assignTree({ treeId: move.id, folderId: move.nextFolderId, userId });
      if (move.renamed) {
        await saveMetadata({ treeId: move.id, title: move.nextTitle, userId });
      }
      successIds.push(move.id);
    } catch (error) {
      failures.push(mapMoveFailure(error, move.id));
    }
  }

  return { successIds, failures };
};

export const useLibraryData = ({
  user,
  trees,
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
    setError,
    setFolders,
    setFoldersLoading,
    setLoading,
    setTrees,
  ]);

  const handleCleanupEmptyTrees = useCallback(async (targetTrees) => {
    if (!user) {
      return;
    }

    try {
      const deletedCount = await cleanupEmptyTrees(targetTrees);
      if (deletedCount > 0) {
        await refreshLibrary();
      }
    } catch (err) {
      loggerBridge.log?.('warn', 'library_cleanup_empty_trees_failed', { message: err?.message });
    }
  }, [loggerBridge, refreshLibrary, user]);

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
  }, [libraryBridge, selectTree, setError, setTrees, user]);

  const handleOpenTree = useCallback(async ({ treeId, fresh = false }) => {
    if (!treeId) {
      return;
    }
    try {
      await openWidgetForTree({ treeId, fresh });
    } catch (err) {
      setError(err);
      loggerBridge.log?.('error', 'library_open_tree_failed', {
        treeId,
        message: err?.message,
      });
      throw err;
    }
  }, [loggerBridge, setError]);

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
  }, [clearTreeSelection, refreshLibrary, selectedTreeId, setError, setLoading, user]);

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
  }, [refreshLibrary, setError, user]);

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

  const moveTreesToFolder = useCallback(async ({ treeIds, targetFolderId }) => {
    if (!user) {
      return {
        moved: [],
        failures: [],
        renamed: [],
        skipped: [],
        missing: treeIds || [],
        undo: async () => {},
      };
    }

    const plan = planTreeMoves({
      trees: Array.isArray(trees) ? trees : EMPTY_ARRAY,
      treeIds,
      targetFolderId,
    });

    if (!plan.moves.length) {
      return {
        moved: [],
        failures: [],
        renamed: [],
        skipped: plan.skipped,
        missing: plan.missing,
        undo: async () => {},
      };
    }

    const executeMove = createTreeMoveExecutor({
      assignTree: assignTreeToFolder,
      saveMetadata: saveTreeMetadata,
      userId: user.id,
    });

    const { successIds, failures } = await executeMove(plan.moves);

    if (successIds.length > 0) {
      setTrees((prev) => applyTreeMovePlan({ trees: prev, plan, successfulIds: successIds }));
    }

    if (failures.length > 0) {
      setError(new Error(failures[0].message));
    }

    const { moved, renamed } = summariseMovePlan({ plan, successfulIds: successIds });
    const undoSnapshots = buildUndoSnapshot({ plan, successfulIds: successIds });

    const undo = async () => {
      if (undoSnapshots.length === 0) {
        return;
      }
      try {
        const revertExecutor = createTreeMoveExecutor({
          assignTree: assignTreeToFolder,
          saveMetadata: saveTreeMetadata,
          userId: user.id,
        });
        const planLookup = new Map(plan.moves.map((move) => [move.id, move]));
        await revertExecutor(
          undoSnapshots.map((snapshot) => ({
            id: snapshot.id,
            nextFolderId: snapshot.folderId,
            nextTitle: snapshot.title,
            renamed: Boolean(planLookup.get(snapshot.id)?.renamed),
          })),
        );
        setTrees((prev) => revertTreeMovePlan({ trees: prev, plan, revertIds: successIds }));
      } catch (err) {
        loggerBridge.log?.('error', 'library_move_undo_failed', { message: err?.message });
      }
    };

    return {
      moved,
      failures,
      renamed,
      skipped: plan.skipped,
      missing: plan.missing,
      undo,
    };
  }, [loggerBridge, setError, setTrees, trees, user]);

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
  }, [refreshLibrary, setError, user]);

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
    handleOpenTree,
    handleTreeDelete,
    handleTreeRename,
    handleNodesRemove,
    moveTreesToFolder,
    handleFolderCreate,
    handleWidgetShouldCleanup,
    handleExistingEmptyTree,
  };
};

export default useLibraryData;
