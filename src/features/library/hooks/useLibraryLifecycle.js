import { useEffect, useRef } from 'react';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const useLibraryLifecycle = ({ actions, dataApi, selectors, state, user }) => {
  const {
    refreshLibrary,
    handleCleanupEmptyTrees,
    handleExistingEmptyTree,
    handleWidgetShouldCleanup,
    libraryBridge,
    loggerBridge,
  } = dataApi;

  const previousTreeRef = useRef(null);

  useEffect(() => {
    if (!state.selectedTreeId) {
      return;
    }
    actions.selection.setNavSelectedIds([state.selectedTreeId]);
  }, [actions.selection, state.selectedTreeId]);

  useEffect(() => {
    if (!user) {
      previousTreeRef.current = selectors.selectedTree;
      return;
    }

    const previousTree = previousTreeRef.current;
    const currentTree = selectors.selectedTree;
    previousTreeRef.current = currentTree;

    if (!previousTree || previousTree.id === currentTree?.id) {
      return;
    }

    if (!handleWidgetShouldCleanup(previousTree)) {
      return;
    }

    let cancelled = false;

    handleExistingEmptyTree(previousTree, state.trees)
      .then((deleted) => {
        if (cancelled || !deleted) {
          return;
        }
        actions.data.setTrees((prev) => prev.filter((tree) => tree.id !== previousTree.id));
        if (state.selectedTreeId === previousTree.id) {
          actions.selection.selectTree(null);
        }
        libraryBridge.requestLibraryRefresh?.();
      })
      .catch((error) => {
        loggerBridge.log?.('warn', 'library_cleanup_previous_tree_failed', { message: error?.message });
      });

    return () => {
      cancelled = true;
    };
  }, [
    actions.data,
    actions.selection,
    handleExistingEmptyTree,
    handleWidgetShouldCleanup,
    libraryBridge,
    loggerBridge,
    selectors.selectedTree,
    state.selectedTreeId,
    state.trees,
    user,
  ]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary, user?.id]);

  useEffect(() => {
    if (!user || state.trees.length === 0) {
      return undefined;
    }

    handleCleanupEmptyTrees(state.trees);
    const intervalId = window.setInterval(() => {
      handleCleanupEmptyTrees(state.trees);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [handleCleanupEmptyTrees, state.trees, user]);

  useEffect(() => {
    if (!libraryBridge?.onLibraryRefresh) {
      return undefined;
    }
    const unsubscribe = libraryBridge.onLibraryRefresh(() => {
      refreshLibrary();
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [libraryBridge, refreshLibrary]);
};

export default useLibraryLifecycle;
