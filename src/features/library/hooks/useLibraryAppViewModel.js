import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Sun, Moon } from 'lucide-react';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import { useTheme } from 'shared/components/library/ThemeProvider';
import { useLibraryState } from 'features/library/state/useLibraryState';
import { useLibraryData } from './useLibraryData';
import { readTreeIdsFromDataTransfer, writeTreeIdsToDataTransfer } from 'features/library/utils/dragPayload';

const THEME_OPTIONS = [
  { label: '반투명', value: 'glass', icon: Sparkles },
  { label: '라이트', value: 'light', icon: Sun },
  { label: '다크', value: 'dark', icon: Moon },
];

const useThemeController = ({ theme, setTheme }) => {
  const active = useMemo(() => (
    THEME_OPTIONS.find((option) => option.value === theme) || THEME_OPTIONS[0]
  ), [theme]);

  const cycleTheme = useCallback(() => {
    const currentIndex = THEME_OPTIONS.findIndex((option) => option.value === theme);
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    setTheme(THEME_OPTIONS[nextIndex].value);
  }, [setTheme, theme]);

  return {
    active,
    cycleTheme,
    options: THEME_OPTIONS,
  };
};

const createMemoHandler = ({ setTrees, getSelectedTree }) => ({
  create: (nodeId) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree) {
      return null;
    }

    const memoId = `memo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newMemo = {
      id: memoId,
      title: '새 메모',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTrees((prevTrees) => prevTrees.map((tree) => {
      if (tree.id !== selectedTree.id) {
        return tree;
      }
      const nodes = tree?.treeData?.nodes || [];
      return {
        ...tree,
        treeData: {
          ...tree.treeData,
          nodes: nodes.map((node) => (
            node.id === nodeId ? { ...node, memo: newMemo } : node
          )),
        },
      };
    }));

    return memoId;
  },
  update: (nodeId, memoData) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree) {
      return;
    }

    setTrees((prevTrees) => prevTrees.map((tree) => {
      if (tree.id !== selectedTree.id) {
        return tree;
      }
      const nodes = tree?.treeData?.nodes || [];
      return {
        ...tree,
        treeData: {
          ...tree.treeData,
          nodes: nodes.map((node) => (
            node.id === nodeId
              ? {
                ...node,
                memo: {
                  ...node.memo,
                  ...memoData,
                  updatedAt: new Date().toISOString(),
                },
              }
              : node
          )),
        },
      };
    }));
  },
  remove: (memoId) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree) {
      return;
    }

    setTrees((prevTrees) => prevTrees.map((tree) => {
      if (tree.id !== selectedTree.id) {
        return tree;
      }
      const nodes = tree?.treeData?.nodes || [];
      return {
        ...tree,
        treeData: {
          ...tree.treeData,
          nodes: nodes.map((node) => (
            node.memo?.id === memoId ? { ...node, memo: null } : node
          )),
        },
      };
    }));
  },
});

const createNodeUpdater = ({ setTrees, getSelectedTree }) => ({
  updateNode: (updatedNode) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree) {
      return;
    }

    setTrees((prevTrees) => prevTrees.map((tree) => {
      if (tree.id !== selectedTree.id) {
        return tree;
      }
      const nodes = tree?.treeData?.nodes || [];
      return {
        ...tree,
        treeData: {
          ...tree.treeData,
          nodes: nodes.map((node) => (
            node.id === updatedNode.id ? updatedNode : node
          )),
        },
      };
    }));
  },
  addNode: (newNode, newLink) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree) {
      return;
    }

    setTrees((prevTrees) => prevTrees.map((tree) => {
      if (tree.id !== selectedTree.id) {
        return tree;
      }

      const nodes = tree?.treeData?.nodes || [];
      const links = tree?.treeData?.links || [];

      return {
        ...tree,
        treeData: {
          ...tree.treeData,
          nodes: [...nodes, newNode],
          links: [
            ...links,
            newLink || {
              source: newNode.parentId,
              target: newNode.id,
              value: 1,
            },
          ],
        },
      };
    }));
  },
});

export const useLibraryAppViewModel = () => {
  const { user, signOut } = useSupabaseAuth();
  const { theme, setTheme } = useTheme();
  const { state, actions, selectors } = useLibraryState();
  const themeController = useThemeController({ theme, setTheme });

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

  const memoHandlers = useMemo(() => createMemoHandler({
    setTrees: actions.data.setTrees,
    getSelectedTree: () => selectors.selectedTree,
  }), [actions.data.setTrees, selectors.selectedTree]);

  const nodeHandlers = useMemo(() => createNodeUpdater({
    setTrees: actions.data.setTrees,
    getSelectedTree: () => selectors.selectedTree,
  }), [actions.data.setTrees, selectors.selectedTree]);

  const previousTreeRef = useRef(null);

  useEffect(() => {
    if (!state.selectedTreeId) {
      return;
    }
    actions.selection.setNavSelectedIds([state.selectedTreeId]);
  }, [actions.selection.setNavSelectedIds, state.selectedTreeId]);

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

    if (!dataApi.handleWidgetShouldCleanup(previousTree)) {
      return;
    }

    let cancelled = false;

    dataApi.handleExistingEmptyTree(previousTree, state.trees).then((deleted) => {
      if (cancelled || !deleted) {
        return;
      }
      actions.data.setTrees((prev) => prev.filter((tree) => tree.id !== previousTree.id));
      if (state.selectedTreeId === previousTree.id) {
        actions.selection.selectTree(null);
      }
      dataApi.libraryBridge.requestLibraryRefresh?.();
    }).catch((error) => {
      dataApi.loggerBridge.log?.('warn', 'library_cleanup_previous_tree_failed', { message: error?.message });
    });

    return () => {
      cancelled = true;
    };
  }, [
    actions.data.setTrees,
    actions.selection.selectTree,
    dataApi.handleExistingEmptyTree,
    dataApi.handleWidgetShouldCleanup,
    dataApi.libraryBridge,
    dataApi.loggerBridge,
    state.selectedTreeId,
    state.trees,
    selectors.selectedTree,
    user,
  ]);

  useEffect(() => {
    dataApi.refreshLibrary();
  }, [dataApi.refreshLibrary, user?.id]);

  useEffect(() => {
    if (!user || state.trees.length === 0) {
      return undefined;
    }

    dataApi.handleCleanupEmptyTrees(state.trees);
    const intervalId = window.setInterval(() => {
      dataApi.handleCleanupEmptyTrees(state.trees);
    }, 5 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [dataApi.handleCleanupEmptyTrees, state.trees, user]);

  useEffect(() => {
    if (!dataApi.libraryBridge?.onLibraryRefresh) {
      return undefined;
    }
    const unsubscribe = dataApi.libraryBridge.onLibraryRefresh(() => {
      dataApi.refreshLibrary();
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [dataApi.libraryBridge, dataApi.refreshLibrary]);

  const handleTreeOpen = useCallback(async (treeId) => {
    if (!treeId) {
      return;
    }
    try {
      await dataApi.handleOpenTree({ treeId, fresh: false });
    } catch {
      // 오류는 dataApi에서 처리
    }
  }, [dataApi]);

  const handleCreateTree = useCallback(async () => {
    const created = await dataApi.handleCreateTree();
    if (created?.id) {
      actions.selection.selectTree(created.id);
    }
  }, [actions.selection, dataApi]);

  const handleTreeDelete = useCallback((treeId) => dataApi.handleTreeDelete(treeId), [dataApi]);

  const handleTreeRename = useCallback((treeId, name) => dataApi.handleTreeRename(treeId, name), [dataApi]);

  const handleFolderCreate = useCallback((payload) => dataApi.handleFolderCreate(payload), [dataApi]);

  const handleSidebarTreeSelect = useCallback((treeId, { folderId, navIds } = {}) => {
    if (!treeId) {
      return;
    }
    actions.selection.selectTree(treeId, {
      folderId,
      navIds: Array.isArray(navIds) && navIds.length > 0 ? navIds : undefined,
    });
  }, [actions.selection]);

  const handleFolderSelect = useCallback((folderId) => {
    actions.selection.selectFolder(folderId ?? null);
  }, [actions.selection]);

  const handleFolderToggle = useCallback((folderId) => {
    if (!folderId) {
      return;
    }
    actions.folder.toggleFolder(folderId);
    actions.folder.setSelectedFolderId(folderId);
  }, [actions.folder]);

  const handleNodeRemove = useCallback(async (nodeId) => {
    if (!nodeId || !selectors.selectedTree) {
      return;
    }
    const confirmed = window.confirm('이 노드를 삭제하시겠습니까? 하위 노드들도 함께 삭제됩니다.');
    if (!confirmed) {
      return;
    }

    const collectChildren = (parentId, nodes) => {
      const direct = nodes.filter((node) => node.parentId === parentId);
      return direct.reduce((acc, node) => (
        [...acc, node.id, ...collectChildren(node.id, nodes)]
      ), []);
    };

    const nodeIds = [nodeId, ...collectChildren(nodeId, selectors.selectedTree?.treeData?.nodes || [])];
    const removed = await dataApi.handleNodesRemove({ nodeIds });
    if (!removed) {
      return;
    }

    actions.data.setTrees((prev) => prev.map((tree) => {
      if (tree.id !== selectors.selectedTree.id) {
        return tree;
      }
      const nodes = tree?.treeData?.nodes || [];
      const links = tree?.treeData?.links || [];
      return {
        ...tree,
        treeData: {
          ...tree.treeData,
          nodes: nodes.filter((node) => !nodeIds.includes(node.id)),
          links: links.filter((link) => !nodeIds.includes(link.source) && !nodeIds.includes(link.target)),
        },
      };
    }));
  }, [actions.data, dataApi, selectors.selectedTree]);

  const handleNavDragStart = useCallback((event, treeId) => {
    if (!treeId) {
      return;
    }

    const selection = state.navSelectedIds.includes(treeId) && state.navSelectedIds.length > 0
      ? [...state.navSelectedIds]
      : [treeId];

    if (!state.navSelectedIds.includes(treeId)) {
      actions.selection.setNavSelectedIds(selection);
    }

    actions.drag.setDraggedTreeIds(selection);
    actions.drag.setDragOverFolderId(null);
    actions.drag.setDragOverVoranBox(false);

    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      writeTreeIdsToDataTransfer(event.dataTransfer, selection);
    }
  }, [actions.drag, actions.selection, state.navSelectedIds]);

  const handleNavDragEnd = useCallback(() => {
    actions.drag.resetDragState();
  }, [actions.drag]);

  const handleNavDropToFolder = useCallback(async (event, folderId) => {
    event.preventDefault();
    const treeIds = readTreeIdsFromDataTransfer(event?.dataTransfer);

    actions.drag.setDragOverFolderId(null);
    actions.drag.setDragOverVoranBox(false);

    if (treeIds.length === 0) {
      actions.drag.resetDragState();
      return;
    }

    const result = await dataApi.moveTreesToFolder({ treeIds, targetFolderId: folderId });
    if (result.moved.length > 0) {
      const [first] = result.moved;
      const navIds = result.moved.map((entry) => entry.id);
      actions.selection.selectTree(first.id, { folderId, navIds });
    }

    actions.drag.resetDragState();
  }, [actions.drag, actions.selection, dataApi]);

  const handleNavDropToVoran = useCallback(async (event) => {
    event.preventDefault();
    const treeIds = readTreeIdsFromDataTransfer(event?.dataTransfer);

    actions.drag.setDragOverFolderId(null);
    actions.drag.setDragOverVoranBox(false);

    if (treeIds.length === 0) {
      actions.drag.resetDragState();
      return;
    }

    const result = await dataApi.moveTreesToFolder({ treeIds, targetFolderId: null });
    if (result.moved.length > 0) {
      const [first] = result.moved;
      const navIds = result.moved.map((entry) => entry.id);
      actions.selection.selectTree(first.id, { folderId: null, navIds });
    }

    actions.drag.resetDragState();
  }, [actions.drag, actions.selection, dataApi]);

  const handleFolderDragOver = useCallback((folderId) => {
    actions.drag.setDragOverFolderId(folderId);
  }, [actions.drag]);

  const handleFolderDragLeave = useCallback(() => {
    actions.drag.setDragOverFolderId(null);
  }, [actions.drag]);

  const handleVoranDragOver = useCallback(() => {
    actions.drag.setDragOverVoranBox(true);
  }, [actions.drag]);

  const handleVoranDragLeave = useCallback(() => {
    actions.drag.setDragOverVoranBox(false);
  }, [actions.drag]);

  const handleShowVoranBox = useCallback(() => {
    actions.modal.showVoranBox();
  }, [actions.modal]);

  const handleHideVoranBox = useCallback(() => {
    actions.modal.hideVoranBox();
  }, [actions.modal]);

  const handleOpenCreateDialog = useCallback((type = 'folder') => {
    actions.modal.openCreateDialog(type);
  }, [actions.modal]);

  const handleCreateDialogToggle = useCallback((open) => {
    if (open) {
      actions.modal.setShowCreateDialog(true);
      return;
    }
    actions.modal.setShowCreateDialog(false);
  }, [actions.modal]);

  const handleSignOut = useCallback(() => {
    signOut?.();
  }, [signOut]);

  return {
    user,
    signOut: handleSignOut,
    theme: {
      active: themeController.active,
      cycle: themeController.cycleTheme,
    },
    state: {
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
    },
    status: {
      loading: state.loading,
      foldersLoading: state.foldersLoading,
      error: state.error,
    },
    handlers: {
      refreshLibrary: dataApi.refreshLibrary,
      createTree: handleCreateTree,
      openTree: handleTreeOpen,
      deleteTree: handleTreeDelete,
      renameTree: handleTreeRename,
      folderCreate: handleFolderCreate,
      folderSelect: handleFolderSelect,
      folderToggle: handleFolderToggle,
      sidebarTreeSelect: handleSidebarTreeSelect,
      nodeSelect: actions.selection.setSelectedNode,
      nodeUpdate: nodeHandlers.updateNode,
      nodeAdd: (node, link) => {
        nodeHandlers.addNode(node, link);
        actions.selection.setSelectedNode(node);
      },
      nodeRemove: handleNodeRemove,
      memoCreate: memoHandlers.create,
      memoUpdate: memoHandlers.update,
      memoRemove: memoHandlers.remove,
      navDragStart: handleNavDragStart,
      navDragEnd: handleNavDragEnd,
      navDropToFolder: handleNavDropToFolder,
      navDropToVoran: handleNavDropToVoran,
      folderDragOver: handleFolderDragOver,
      folderDragLeave: handleFolderDragLeave,
      voranDragOver: handleVoranDragOver,
      voranDragLeave: handleVoranDragLeave,
      showVoranBox: handleShowVoranBox,
      hideVoranBox: handleHideVoranBox,
      openCreateDialog: handleOpenCreateDialog,
      toggleCreateDialog: handleCreateDialogToggle,
      moveTreesToFolder: dataApi.moveTreesToFolder,
    },
    dialog: {
      showVoranBoxManager: state.showVoranBoxManager,
      showCreateDialog: state.showCreateDialog,
      createType: state.createType,
    },
  };
};

export default useLibraryAppViewModel;
