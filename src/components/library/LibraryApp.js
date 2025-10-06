import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Sparkles, Sun, Moon } from "lucide-react";
import { createLibraryBridge, createLoggerBridge } from 'infrastructure/electron/bridges';

import Logo from "assets/admin-widget/logo.svg";

import VoranBoxManager from "./VoranBoxManager";
import CreateDialog from "./CreateDialog";
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import {
  loadTrees,
  loadFolders,
  saveTreeMetadata,
  removeTree,
  removeNodes,
  assignTreeToFolder,
  createLibraryFolder,
} from "features/library/services/libraryRepository";
import { createTreeForUser, openWidgetForTree, cleanupEmptyTrees, isTrackingEmptyTree } from "features/tree/services/treeCreation";
import { useTheme } from "./ThemeProvider";
import { useLibraryState } from "features/library/state/useLibraryState";
import { LibraryActionToolbar, LibrarySidebar, LibraryContent } from "features/library/ui";

const LibraryApp = () => {
  const { user, signOut } = useSupabaseAuth();
  const previousSelectedTreeRef = useRef(null);
  const libraryBridge = useMemo(() => createLibraryBridge(), []);
  const loggerBridge = useMemo(() => createLoggerBridge(), []);
  const {
    state,
    actions,
    selectors,
  } = useLibraryState();

  const {
    trees,
    folders,
    selectedTreeId,
    selectedFolderId,
    expandedFolders,
    loading,
    foldersLoading,
    error,
    selectedNode,
    navSelectedIds,
    draggedTreeIds,
    dragOverFolderId,
    dragOverVoranBox,
    showVoranBoxManager,
    showCreateDialog,
    createType,
  } = state;

  const {
    data: dataActions,
    selection: selectionActions,
    folder: folderActions,
    drag: dragActions,
    modal: modalActions,
  } = actions;

  const {
    setTrees,
    setFolders,
    setLoading,
    setFoldersLoading,
    setError,
  } = dataActions;

  const {
    selectTree,
    selectFolder,
    setSelectedNode,
    setNavSelectedIds,
    clearTreeSelection,
  } = selectionActions;

  const {
    toggleFolder: toggleFolderExpansion,
    setSelectedFolderId,
  } = folderActions;

  const {
    setDraggedTreeIds,
    setDragOverFolderId,
    setDragOverVoranBox,
    resetDragState,
  } = dragActions;

  const {
    showVoranBox,
    hideVoranBox,
    openCreateDialog,
    setShowCreateDialog,
  } = modalActions;

  const {
    selectedTree,
    voranTrees,
  } = selectors;

  const selectedId = selectedTreeId;

  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (selectedId) {
      setNavSelectedIds([selectedId]);
    }
  }, [selectedId, setNavSelectedIds]);

  useEffect(() => {
    if (!user) {
      previousSelectedTreeRef.current = selectedTree;
      return;
    }

    const previousTree = previousSelectedTreeRef.current;
    const currentTreeId = selectedTree?.id ?? null;

    previousSelectedTreeRef.current = selectedTree;

    if (!previousTree || previousTree.id === currentTreeId) {
      return;
    }

    if (!isTrackingEmptyTree(previousTree.id)) {
      return;
    }

    const latestSnapshot = trees.find((tree) => tree.id === previousTree.id) || previousTree;

    if (!latestSnapshot?.treeData) {
      return;
    }

    let cancelled = false;

    const performCleanup = async () => {
      try {
        const deletedCount = await cleanupEmptyTrees([latestSnapshot]);
        if (!cancelled && deletedCount > 0) {
          setTrees((prevTrees) => prevTrees.filter((tree) => tree.id !== latestSnapshot.id));
          if (selectedId === latestSnapshot.id) {
            selectTree(null);
          }
          libraryBridge.requestLibraryRefresh?.();
        }
      } catch (err) {
        console.error('빈 트리 자동 정리 실패:', err);
      }
    };

    performCleanup();

    return () => {
      cancelled = true;
    };
  }, [libraryBridge, selectedId, selectedTree, selectTree, setTrees, trees, user]);

  const refreshLibrary = useCallback(async () => {
    if (!user) {
      setTrees([]);
      setFolders([]);
      clearTreeSelection();
      setSelectedFolderId(null);
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

      const mappedTrees = fetchedTrees.map((tree) => ({
        id: tree.id,
        title: tree.title || "제목 없는 트리",
        treeData: tree.treeData,
        createdAt: tree.createdAt,
        updatedAt: tree.updatedAt,
        folderId: tree.folderId || null,
      }));

      setTrees(mappedTrees);
      setFolders(fetchedFolders);
      const exists = selectedId && mappedTrees.some((item) => item.id === selectedId);
      if (exists) {
        selectTree(selectedId);
      } else {
        clearTreeSelection();
      }
    } catch (err) {
      setError(err);
      setTrees([]);
      setFolders([]);
      clearTreeSelection();
      setSelectedFolderId(null);
    } finally {
      setLoading(false);
      setFoldersLoading(false);
    }
  }, [
    user?.id,
    loadTrees,
    loadFolders,
    selectedId,
    selectTree,
    clearTreeSelection,
    setError,
    setSelectedFolderId,
    setTrees,
    setFolders,
    setLoading,
    setFoldersLoading,
  ]);

  const handleCleanupEmptyTrees = useCallback(async () => {
    if (!user) return;

    try {
      const deletedCount = await cleanupEmptyTrees(trees);
      if (deletedCount > 0) {
        console.log(`${deletedCount}개의 빈 트리가 정리되었습니다.`);
        await refreshLibrary();
      }
    } catch (err) {
      console.error('빈 트리 정리 중 오류:', err);
    }
  }, [user, trees, refreshLibrary]);

  useEffect(() => {
    refreshLibrary();
  }, [user?.id, refreshLibrary]);

  useEffect(() => {
    if (!user || trees.length === 0) return;

    handleCleanupEmptyTrees();

    const cleanupInterval = setInterval(() => {
      handleCleanupEmptyTrees();
    }, 5 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [user, trees.length, handleCleanupEmptyTrees]);

  useEffect(() => {
    if (!libraryBridge.onLibraryRefresh) {
      return () => {};
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

  const handleTreeOpen = useCallback(async (treeId) => {
    if (!treeId) {
      return;
    }

    try {
      await openWidgetForTree({ treeId, fresh: false });
    } catch (err) {
      setError(err);
      loggerBridge.log?.('error', 'library_open_tree_failed', {
        treeId,
        message: err?.message,
      });
    }
  }, [loggerBridge, openWidgetForTree, setError]);

  const handleTreeDelete = useCallback(async (treeId) => {
    if (!user || !treeId) {
      return;
    }

    let confirmed = true;
    if (typeof window !== "undefined" && window.confirm) {
      confirmed = window.confirm("선택한 지식 트리를 삭제할까요? 삭제하면 되돌릴 수 없습니다.");
    }
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await removeTree({ treeId });
      await refreshLibrary();
      if (selectedId === treeId) {
        clearTreeSelection();
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, refreshLibrary, removeTree, selectedId, clearTreeSelection, setLoading, setError]);

  const handleTreeRename = useCallback(async (treeId, newTitle) => {
    if (!user || !treeId || !newTitle?.trim()) {
      return;
    }

    try {
      await saveTreeMetadata({
        treeId,
        title: newTitle.trim(),
        userId: user.id
      });
      await refreshLibrary();
    } catch (err) {
      setError(err);
      alert(`트리 이름 변경 중 오류가 발생했습니다: ${err.message}`);
    }
  }, [user, refreshLibrary, saveTreeMetadata, setError]);

  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
  }, [setSelectedNode]);

  const handleNodeUpdate = useCallback((updatedNode) => {
    setTrees(prevTrees =>
      prevTrees.map(tree =>
        tree.id === selectedTree?.id
          ? {
            ...tree,
            treeData: {
              ...tree.treeData,
              nodes: tree.treeData?.nodes?.map(node =>
                node.id === updatedNode.id ? updatedNode : node
              ) || []
            }
          }
          : tree
      )
    );
  }, [selectedTree, setTrees]);

  const handleNewNodeCreated = useCallback((newNode, newLink) => {
    setTrees(prevTrees =>
      prevTrees.map(tree =>
        tree.id === selectedTree?.id
          ? {
            ...tree,
            treeData: {
              ...tree.treeData,
              nodes: [...(tree.treeData?.nodes || []), newNode],
              links: [
                ...(tree.treeData?.links || []),
                newLink || {
                  source: newNode.parentId,
                  target: newNode.id,
                  value: 1
                }
              ]
            }
          }
          : tree
      )
    );
    setSelectedNode(newNode);
  }, [selectedTree, setTrees, setSelectedNode]);

  // 메모 생성 핸들러
  const handleMemoCreate = useCallback((nodeId) => {
    if (!selectedTree || !user) {
      return null;
    }

    const newMemoId = `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newMemo = {
      id: newMemoId,
      title: '새 메모',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 노드에 메모 추가
    setTrees(prevTrees =>
      prevTrees.map(tree =>
        tree.id === selectedTree?.id
          ? {
            ...tree,
            treeData: {
              ...tree.treeData,
              nodes: tree.treeData?.nodes?.map(node =>
                node.id === nodeId
                  ? { ...node, memo: newMemo }
                  : node
              ) || []
            }
          }
          : tree
      )
    );

    return newMemoId;
  }, [selectedTree, user, setTrees]);

  // 메모 업데이트 핸들러
  const handleMemoUpdate = useCallback((nodeId, memoData) => {
    if (!selectedTree || !user) {
      return;
    }

    setTrees(prevTrees =>
      prevTrees.map(tree =>
        tree.id === selectedTree?.id
          ? {
            ...tree,
            treeData: {
              ...tree.treeData,
              nodes: tree.treeData?.nodes?.map(node =>
                node.id === nodeId
                  ? {
                    ...node,
                    memo: {
                      ...node.memo,
                      ...memoData,
                      updatedAt: new Date().toISOString()
                    }
                  }
                  : node
              ) || []
            }
          }
          : tree
      )
    );
  }, [selectedTree, user, setTrees]);

  // 메모 삭제 핸들러
  const handleMemoRemove = useCallback((memoId) => {
    if (!selectedTree || !user) {
      return;
    }

    setTrees(prevTrees =>
      prevTrees.map(tree =>
        tree.id === selectedTree?.id
          ? {
            ...tree,
            treeData: {
              ...tree.treeData,
              nodes: tree.treeData?.nodes?.map(node =>
                node.memo?.id === memoId
                  ? { ...node, memo: null }
                  : node
              ) || []
            }
          }
          : tree
      )
    );
  }, [selectedTree, user, setTrees]);

  const handleNodeRemove = useCallback(async (nodeId) => {
    if (!selectedTree || !user) {
      return;
    }

    const confirmed = window.confirm("이 노드를 삭제하시겠습니까? 하위 노드들도 함께 삭제됩니다.");
    if (!confirmed) {
      return;
    }

    try {
      const getAllChildNodes = (parentId, nodes) => {
        const children = nodes.filter(node => node.parentId === parentId);
        let allChildren = [...children];
        children.forEach(child => {
          allChildren = [...allChildren, ...getAllChildNodes(child.id, nodes)];
        });
        return allChildren;
      };

      const allNodesToDelete = [nodeId, ...getAllChildNodes(nodeId, selectedTree.treeData?.nodes || [])];

      await removeNodes({
        nodeIds: allNodesToDelete,
        userId: user.id
      });

      setTrees(prevTrees =>
        prevTrees.map(tree =>
          tree.id === selectedTree.id
            ? {
              ...tree,
              treeData: {
                ...tree.treeData,
                nodes: (tree.treeData?.nodes || []).filter(node => !allNodesToDelete.includes(node.id)),
                links: (tree.treeData?.links || []).filter(link =>
                  !allNodesToDelete.includes(link.source) && !allNodesToDelete.includes(link.target)
                )
              }
            }
            : tree
        )
      );

      if (allNodesToDelete.includes(selectedNode?.id)) {
        setSelectedNode(null);
      }

    } catch (error) {
      console.error('노드 삭제 실패:', error);
      alert('노드 삭제 중 오류가 발생했습니다.');
    }
  }, [selectedTree, user, selectedNode, removeNodes, setTrees, setSelectedNode]);

  const handleFolderCreate = useCallback(async ({ name, parentId }) => {
    if (!user) {
      console.log('폴더 생성 실패: 사용자가 로그인되지 않음');
      return;
    }

    try {
      const newFolder = await createLibraryFolder({ name, parentId, userId: user.id });
      setFolders(prev => [...prev, newFolder]);
    } catch (err) {
      console.error('폴더 생성 오류:', err);
      setError(err);
      alert(`폴더 생성 중 오류가 발생했습니다: ${err.message}`);
    }
  }, [user, createLibraryFolder, setFolders, setError]);

  const handleFolderSelect = useCallback((folderId) => {
    selectFolder(folderId);
  }, [selectFolder]);

  const extractTreeIdsFromDataTransfer = useCallback((dataTransfer) => {
    if (!dataTransfer) {
      return [];
    }

    try {
      const raw = dataTransfer.getData("application/json");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.treeIds)) {
          return parsed.treeIds.filter(Boolean);
        }
      }
    } catch (error) {
      console.error("Failed to parse drag data (json)", error);
    }

    try {
      const fallback = dataTransfer.getData("text/plain");
      if (fallback) {
        return fallback.split(",").map((id) => id.trim()).filter(Boolean);
      }
    } catch (error) {
      console.error("Failed to parse drag data (text)", error);
    }

    return [];
  }, []);

  const handleTreeMoveToFolder = useCallback(async (request = {}) => {
    if (!user) {
      return {
        moved: [],
        failures: [],
        renamed: [],
        skipped: [],
      };
    }

    const { treeIds, targetFolderId = null } = request;

    const ids = Array.isArray(treeIds)
      ? treeIds.filter(Boolean)
      : (treeIds ? [treeIds] : []);

    if (ids.length === 0) {
      return {
        moved: [],
        failures: [],
        renamed: [],
        skipped: [],
      };
    }

    const treeMap = new Map(trees.map((tree) => [tree.id, tree]));
    const candidates = ids
      .map((id) => treeMap.get(id))
      .filter(Boolean);

    if (candidates.length === 0) {
      return {
        moved: [],
        failures: [],
        renamed: [],
        skipped: [],
      };
    }

    const normalizeTitle = (value) => value?.trim() || "제목 없는 트리";

    const mapError = (err) => {
      const message = err?.message || "알 수 없는 오류가 발생했습니다.";
      const lower = message.toLowerCase();

      if (lower.includes("permission") || lower.includes("권한")) {
        return {
          reason: "permission",
          message: "이 폴더로 옮길 수 있는 권한이 없습니다.",
        };
      }

      if (
        lower.includes("network") ||
        lower.includes("fetch") ||
        lower.includes("timeout") ||
        err?.name === "TypeError"
      ) {
        return {
          reason: "network",
          message: "네트워크 문제로 이동하지 못했습니다. 다시 시도해 주세요.",
        };
      }

      return {
        reason: "unknown",
        message,
      };
    };

    const existingTitles = new Set(
      trees
        .filter((tree) => tree.folderId === targetFolderId && !ids.includes(tree.id))
        .map((tree) => normalizeTitle(tree.title))
    );

    const ensureUniqueTitle = (title) => {
      const base = normalizeTitle(title);

      if (!existingTitles.has(base)) {
        existingTitles.add(base);
        return base;
      }

      const match = base.match(/^(.*?)(?:\s*\((\d+)\))?$/);
      const stem = match?.[1]?.trim() || base;
      let counter = Number(match?.[2]) || 1;
      let candidate = base;

      while (existingTitles.has(candidate)) {
        counter += 1;
        candidate = `${stem} (${counter})`;
      }

      existingTitles.add(candidate);
      return candidate;
    };

    const moved = [];
    const failures = [];
    const renamed = [];
    const skipped = [];

    const previousStates = [];

    for (const tree of candidates) {
      previousStates.push({ id: tree.id, folderId: tree.folderId, title: tree.title });

      if (tree.folderId === targetFolderId) {
        skipped.push({ id: tree.id, reason: "already-there" });
        continue;
      }

      let updatedTitle = tree.title;

      if (tree.folderId !== targetFolderId) {
        updatedTitle = ensureUniqueTitle(tree.title);

        if (updatedTitle !== tree.title) {
          renamed.push({ id: tree.id, previousTitle: tree.title, newTitle: updatedTitle });
        }
      }

      try {
        await assignTreeToFolder({ treeId: tree.id, folderId: targetFolderId, userId: user.id });

        if (updatedTitle !== tree.title) {
          await saveTreeMetadata({ treeId: tree.id, title: updatedTitle, userId: user.id });
        }

        moved.push({ id: tree.id, targetFolderId });
      } catch (error) {
        const mapped = mapError(error);
        failures.push({ id: tree.id, ...mapped });
      }
    }

    if (moved.length > 0) {
      const movedLookup = new Map(moved.map((entry) => [entry.id, entry]));
      const renamedLookup = new Map(renamed.map((entry) => [entry.id, entry]));

      setTrees((prevTrees) => prevTrees.map((tree) => {
        if (!movedLookup.has(tree.id)) {
          return tree;
        }

        const moveInfo = movedLookup.get(tree.id);
        const renameInfo = renamedLookup.get(tree.id);

        return {
          ...tree,
          folderId: moveInfo.targetFolderId,
          title: renameInfo ? renameInfo.newTitle : tree.title,
        };
      }));
    }

    const undo = async () => {
      if (previousStates.length === 0) {
        return;
      }

      try {
        for (const previous of previousStates) {
          const renameInfo = renamed.find((entry) => entry.id === previous.id);

          if (renameInfo && renameInfo.previousTitle !== renameInfo.newTitle) {
            await saveTreeMetadata({ treeId: previous.id, title: renameInfo.previousTitle, userId: user.id });
          }

          await assignTreeToFolder({ treeId: previous.id, folderId: previous.folderId, userId: user.id });
        }

        setTrees((prevTrees) => prevTrees.map((tree) => {
          const previous = previousStates.find((entry) => entry.id === tree.id);
          if (!previous) {
            return tree;
          }

          const renameInfo = renamed.find((entry) => entry.id === tree.id);

          return {
            ...tree,
            folderId: previous.folderId,
            title: renameInfo ? renameInfo.previousTitle : tree.title,
          };
        }));
      } catch (err) {
        console.error("Failed to undo tree move", err);
        setError(err);
      }
    };

    return {
      moved,
      failures,
      renamed,
      skipped,
      undo,
    };
  }, [trees, user, assignTreeToFolder, saveTreeMetadata, setTrees, setError]);

  const handleFolderToggle = useCallback((folderId) => {
    if (!folderId) {
      return;
    }
    toggleFolderExpansion(folderId);
    setSelectedFolderId(folderId);
  }, [toggleFolderExpansion, setSelectedFolderId]);

  const handleNavDragStart = useCallback((event, treeId) => {
    if (!treeId) {
      return;
    }

    const tree = trees.find((entry) => entry.id === treeId);
    if (!tree) {
      return;
    }

    const activeSelection = navSelectedIds.includes(treeId) && navSelectedIds.length > 0
      ? [...navSelectedIds]
      : [treeId];

    if (!navSelectedIds.includes(treeId)) {
      setNavSelectedIds(activeSelection);
    }

    setDraggedTreeIds(activeSelection);
    setDragOverFolderId(null);
    setDragOverVoranBox(false);

    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("application/json", JSON.stringify({ treeIds: activeSelection }));
      } catch (error) {
        console.error("Failed to serialise nav drag payload", error);
      }
      event.dataTransfer.setData("text/plain", activeSelection.join(","));
    }
  }, [
    navSelectedIds,
    trees,
    setNavSelectedIds,
    setDraggedTreeIds,
    setDragOverFolderId,
    setDragOverVoranBox,
  ]);

  const handleNavDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  const handleNavDropToFolder = useCallback(async (event, folderId) => {
    event.preventDefault();
    const treeIds = extractTreeIdsFromDataTransfer(event?.dataTransfer);

    setDragOverFolderId(null);
    setDragOverVoranBox(false);

    if (treeIds.length === 0) {
      resetDragState();
      return;
    }

    try {
      const result = await handleTreeMoveToFolder({ treeIds, targetFolderId: folderId });
      if (result?.moved?.length > 0) {
        const movedIds = result.moved.map((item) => item.id);
        selectTree(result.moved[0].id, { folderId, navIds: movedIds });
      }
      if (result?.failures?.length > 0) {
        setError(new Error(result.failures[0]?.message || "일부 항목을 이동하지 못했습니다."));
      }
    } catch (error) {
      console.error("Failed to drop tree to folder", error);
      setError(error);
    } finally {
      resetDragState();
    }
  }, [
    extractTreeIdsFromDataTransfer,
    handleTreeMoveToFolder,
    selectTree,
    setError,
    setDragOverFolderId,
    setDragOverVoranBox,
    resetDragState,
  ]);

  const handleNavDropToVoran = useCallback(async (event) => {
    event.preventDefault();
    const treeIds = extractTreeIdsFromDataTransfer(event?.dataTransfer);

    setDragOverFolderId(null);
    setDragOverVoranBox(false);

    if (treeIds.length === 0) {
      resetDragState();
      return;
    }

    try {
      const result = await handleTreeMoveToFolder({ treeIds, targetFolderId: null });
      if (result?.moved?.length > 0) {
        const movedIds = result.moved.map((item) => item.id);
        selectTree(result.moved[0].id, { folderId: null, navIds: movedIds });
      }
      if (result?.failures?.length > 0) {
        setError(new Error(result.failures[0]?.message || "일부 항목을 이동하지 못했습니다."));
      }
    } catch (error) {
      console.error("Failed to drop tree to VORAN BOX", error);
      setError(error);
    } finally {
      resetDragState();
    }
  }, [
    extractTreeIdsFromDataTransfer,
    handleTreeMoveToFolder,
    selectTree,
    setError,
    setDragOverFolderId,
    setDragOverVoranBox,
    resetDragState,
  ]);

  const handleSidebarTreeSelect = useCallback((treeId, meta = {}) => {
    if (!treeId) {
      return;
    }
    const payload = {};
    if (Object.prototype.hasOwnProperty.call(meta, 'folderId')) {
      payload.folderId = meta.folderId ?? null;
    }
    selectTree(treeId, payload);
  }, [selectTree]);

  const handleFolderCreateRequest = useCallback(() => {
    openCreateDialog('folder');
  }, [openCreateDialog]);

  const handleOpenVoranManager = useCallback(() => {
    showVoranBox();
  }, [showVoranBox]);

  const handleFolderDragOver = useCallback((folderId) => {
    setDragOverFolderId(folderId);
  }, [setDragOverFolderId]);

  const handleFolderDragLeave = useCallback((folderId) => {
    setDragOverFolderId((prev) => (prev === folderId ? null : prev));
  }, [setDragOverFolderId]);

  const handleVoranDragOver = useCallback(() => {
    setDragOverVoranBox(true);
  }, [setDragOverVoranBox]);

  const handleVoranDragLeave = useCallback(() => {
    setDragOverVoranBox(false);
  }, [setDragOverVoranBox]);

  const handleSignOutClick = useCallback(() => {
    if (typeof signOut === 'function') {
      signOut();
    }
  }, [signOut]);

  const themeOptions = useMemo(() => {
    // 모든 모드에서 반투명/라이트/다크 옵션 제공
    return [
      { label: "반투명", value: "glass", icon: Sparkles },
      { label: "라이트", value: "light", icon: Sun },
      { label: "다크", value: "dark", icon: Moon },
    ];
  }, []);

  const activeTheme = themeOptions.find((option) => option.value === theme) || themeOptions[0];
  const ActiveThemeIcon = activeTheme.icon;

  // 테마 순환 함수
  const cycleTheme = useCallback(() => {
    const currentIndex = themeOptions.findIndex(option => option.value === theme);
    const nextIndex = (currentIndex + 1) % themeOptions.length;
    setTheme(themeOptions[nextIndex].value);
  }, [theme, themeOptions, setTheme]);

  const handleCreateTree = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const newTree = await createTreeForUser({ userId: user.id });

      setTrees((previous) => {
        const merged = new Map(previous.map((entry) => [entry.id, entry]));
        merged.set(newTree.id, newTree);
        const nextList = Array.from(merged.values()).sort(
          (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
        );
        return nextList;
      });

      selectTree(newTree.id);

      await openWidgetForTree({ treeId: newTree.id, fresh: true });
      libraryBridge.requestLibraryRefresh?.();
    } catch (err) {
      setError(err);
    }
  }, [createTreeForUser, libraryBridge, openWidgetForTree, selectTree, setError, setTrees, user]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <LibrarySidebar
        logoSrc={Logo}
        folders={folders}
        trees={trees}
        voranTrees={voranTrees}
        selectedTreeId={selectedId}
        selectedFolderId={selectedFolderId}
        expandedFolders={expandedFolders}
        navSelectedIds={navSelectedIds}
        draggedTreeIds={draggedTreeIds}
        dragOverFolderId={dragOverFolderId}
        dragOverVoranBox={dragOverVoranBox}
        onManageVoranBox={handleOpenVoranManager}
        onCreateFolder={handleFolderCreateRequest}
        onToggleFolder={handleFolderToggle}
        onSelectTree={handleSidebarTreeSelect}
        onOpenTree={handleTreeOpen}
        onDeleteTree={handleTreeDelete}
        onDragStart={handleNavDragStart}
        onDragEnd={handleNavDragEnd}
        onDropToFolder={handleNavDropToFolder}
        onDropToVoran={handleNavDropToVoran}
        onFolderDragOver={handleFolderDragOver}
        onFolderDragLeave={handleFolderDragLeave}
        onVoranDragOver={handleVoranDragOver}
        onVoranDragLeave={handleVoranDragLeave}
      />

      <main className="flex flex-1 flex-col bg-background overflow-hidden">
        <LibraryActionToolbar
          user={user}
          ActiveThemeIcon={ActiveThemeIcon}
          activeThemeLabel={activeTheme.label}
          onCycleTheme={cycleTheme}
          onRefresh={refreshLibrary}
          onCreateTree={handleCreateTree}
          onSignOut={handleSignOutClick}
          isRefreshing={loading}
          canCreateTree={Boolean(user)}
        />
        <div className="flex-1 bg-background overflow-hidden">
          <LibraryContent
            loading={loading}
            user={user}
            error={error}
            selectedTree={selectedTree}
            selectedFolderId={selectedFolderId}
            folders={folders}
            selectedNode={selectedNode}
            onNodeSelect={handleNodeSelect}
            onNodeRemove={handleNodeRemove}
            onNodeUpdate={handleNodeUpdate}
            onNewNodeCreated={handleNewNodeCreated}
            onMemoCreate={handleMemoCreate}
            onMemoUpdate={handleMemoUpdate}
            onMemoRemove={handleMemoRemove}
          />
        </div>
      </main>

      <VoranBoxManager
        isVisible={showVoranBoxManager}
        onClose={hideVoranBox}
        trees={trees}
        folders={folders}
        onTreeSelect={(tree) => {
          selectTree(tree.id, { folderId: tree.folderId ?? null });
          hideVoranBox();
        }}
        onTreeMoveToFolder={handleTreeMoveToFolder}
        onTreeOpen={handleTreeOpen}
        onTreeRename={handleTreeRename}
        onTreeDelete={handleTreeDelete}
        onFolderCreate={handleFolderCreate}
        onFolderSelect={handleFolderSelect}
        selectedTreeId={selectedId}
        selectedFolderId={selectedFolderId}
        loading={loading || foldersLoading}
      />

      <CreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        type={createType}
        folders={folders}
        onFolderCreate={(name, parentId) => handleFolderCreate({ name, parentId })}
        onMemoCreate={() => { }}
      />
    </div>
  );
};

export default LibraryApp;
