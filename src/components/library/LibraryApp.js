import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, FolderTree as FolderIcon, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "components/ui/resizable";
import Logo from "assets/admin-widget/logo.svg";

import TreeCanvas from "./TreeCanvas";
import LibraryQAPanel from "./LibraryQAPanel";
import VoranBoxManager from "./VoranBoxManager";
import CreateDialog from "./CreateDialog";
import { useSupabaseAuth } from "hooks/useSupabaseAuth";
import {
  fetchTreesWithNodes,
  deleteTree,
  deleteNodes,
  fetchFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  moveTreeToFolder,
  upsertTreeMetadata
} from "services/supabaseTrees";
import { createTreeForUser, openWidgetForTree, cleanupEmptyTrees, isTrackingEmptyTree } from "services/treeCreation";

const EmptyState = ({ message }) => (
  <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
    {message}
  </div>
);

const LibraryApp = () => {
  const { user, signOut } = useSupabaseAuth();
  const [trees, setTrees] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showVoranBoxManager, setShowVoranBoxManager] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState("folder");
  const previousSelectedTreeRef = useRef(null);
  const [navSelectedIds, setNavSelectedIds] = useState([]);
  const [draggedTreeIds, setDraggedTreeIds] = useState([]);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [dragOverVoranBox, setDragOverVoranBox] = useState(false);

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === selectedId) ?? null,
    [trees, selectedId]
  );

  useEffect(() => {
    if (selectedId) {
      setNavSelectedIds([selectedId]);
    }
  }, [selectedId]);

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
            setSelectedId(null);
          }
          window.jarvisAPI?.requestLibraryRefresh?.();
        }
      } catch (err) {
        console.error('빈 트리 자동 정리 실패:', err);
      }
    };

    performCleanup();

    return () => {
      cancelled = true;
    };
  }, [selectedTree, trees, user, selectedId]);

  const refreshLibrary = useCallback(async () => {
    if (!user) {
      setTrees([]);
      setFolders([]);
      setSelectedId(null);
      setSelectedFolderId(null);
      setLoading(false);
      setFoldersLoading(false);
      return;
    }

    setLoading(true);
    setFoldersLoading(true);
    setError(null);

    try {
      // 트리와 폴더를 병렬로 가져오기
      const [fetchedTrees, fetchedFolders] = await Promise.all([
        fetchTreesWithNodes(user.id),
        fetchFolders(user.id)
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

      setSelectedId((previousId) => {
        if (!mappedTrees.length) return null;
        const exists = previousId && mappedTrees.some((item) => item.id === previousId);
        return exists ? previousId : null;
      });
    } catch (err) {
      setError(err);
      setTrees([]);
      setFolders([]);
      setSelectedId(null);
      setSelectedFolderId(null);
    } finally {
      setLoading(false);
      setFoldersLoading(false);
    }
  }, [user?.id]);

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
  }, [user?.id, refreshLibrary]); // user.id와 refreshLibrary를 의존성으로 사용

  // 빈 트리 정리 - 컴포넌트 마운트 시와 주기적으로 실행
  useEffect(() => {
    if (!user || trees.length === 0) return;

    // 초기 정리
    handleCleanupEmptyTrees();

    // 주기적 정리 (5분마다)
    const cleanupInterval = setInterval(() => {
      handleCleanupEmptyTrees();
    }, 5 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [user, trees.length, handleCleanupEmptyTrees]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.jarvisAPI?.onLibraryRefresh !== "function") {
      return () => { };
    }

    const unsubscribe = window.jarvisAPI.onLibraryRefresh(() => {
      refreshLibrary();
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [refreshLibrary]);

  const handleTreeOpen = useCallback(async (treeId) => {
    if (!treeId) {
      return;
    }

    try {
      await openWidgetForTree({ treeId, fresh: false });
    } catch (err) {
      setError(err);
      if (typeof window !== "undefined") {
        window.jarvisAPI?.log?.("error", "library_open_tree_failed", {
          treeId,
          message: err?.message,
        });
      }
    }
  }, [setError]);

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
      await deleteTree(treeId);
      await refreshLibrary();
      setSelectedId((prev) => (prev === treeId ? null : prev));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, refreshLibrary]);

  const handleTreeRename = useCallback(async (treeId, newTitle) => {
    if (!user || !treeId || !newTitle?.trim()) {
      return;
    }

    try {
      await upsertTreeMetadata({
        treeId,
        title: newTitle.trim(),
        userId: user.id
      });
      await refreshLibrary();
    } catch (err) {
      setError(err);
      alert(`트리 이름 변경 중 오류가 발생했습니다: ${err.message}`);
    }
  }, [user, refreshLibrary]);

  // 노드 선택 핸들러
  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  // 노드 업데이트 핸들러
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
  }, [selectedTree]);

  // 새 노드 생성 핸들러
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
  }, [selectedTree]);

  // 노드 삭제 핸들러
  const handleNodeRemove = useCallback(async (nodeId) => {
    if (!selectedTree || !user) {
      return;
    }

    // 확인 대화상자
    const confirmed = window.confirm("이 노드를 삭제하시겠습니까? 하위 노드들도 함께 삭제됩니다.");
    if (!confirmed) {
      return;
    }

    try {
      // 하위 노드들도 함께 찾기
      const getAllChildNodes = (parentId, nodes) => {
        const children = nodes.filter(node => node.parentId === parentId);
        let allChildren = [...children];
        children.forEach(child => {
          allChildren = [...allChildren, ...getAllChildNodes(child.id, nodes)];
        });
        return allChildren;
      };

      const allNodesToDelete = [nodeId, ...getAllChildNodes(nodeId, selectedTree.treeData?.nodes || [])];

      // 데이터베이스에서 노드들 삭제
      await deleteNodes({
        nodeIds: allNodesToDelete,
        userId: user.id
      });

      // 로컬 상태에서 노드들 제거
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

      // 삭제된 노드가 선택된 노드라면 선택 해제
      if (allNodesToDelete.includes(selectedNode?.id)) {
        setSelectedNode(null);
      }

    } catch (error) {
      console.error('노드 삭제 실패:', error);
      alert('노드 삭제 중 오류가 발생했습니다.');
    }
  }, [selectedTree, user, selectedNode]);

  // 폴더 관리 핸들러들
  const handleFolderCreate = useCallback(async ({ name, parentId }) => {
    if (!user) {
      console.log('폴더 생성 실패: 사용자가 로그인되지 않음');
      return;
    }

    console.log('폴더 생성 시도:', { name, parentId, userId: user.id });

    try {
      const newFolder = await createFolder({ name, parentId, userId: user.id });
      console.log('폴더 생성 성공:', newFolder);
      setFolders(prev => [...prev, newFolder]);
    } catch (err) {
      console.error('폴더 생성 오류:', err);
      setError(err);
      alert(`폴더 생성 중 오류가 발생했습니다: ${err.message}`);
    }
  }, [user]);

  const handleFolderSelect = useCallback((folderId) => {
    setSelectedFolderId(folderId);
    // 폴더 선택 시 트리는 자동 선택하지 않음
    setSelectedId(null);
  }, []);

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

      if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout") || err?.name === "TypeError") {
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
      const previous = {
        id: tree.id,
        folderId: tree.folderId ?? null,
        title: normalizeTitle(tree.title),
      };

      if ((tree.folderId ?? null) === targetFolderId) {
        skipped.push(tree.id);
        continue;
      }

      let nextTitle = normalizeTitle(tree.title);
      let renameInfo = null;

      if (targetFolderId) {
        const uniqueTitle = ensureUniqueTitle(nextTitle);
        if (uniqueTitle !== nextTitle) {
          try {
            await upsertTreeMetadata({ treeId: tree.id, title: uniqueTitle, userId: user.id });
            renameInfo = {
              id: tree.id,
              previousTitle: nextTitle,
              newTitle: uniqueTitle,
            };
            nextTitle = uniqueTitle;
          } catch (err) {
            failures.push({ id: tree.id, ...mapError(err) });
            continue;
          }
        }
      }

      try {
        await moveTreeToFolder({ treeId: tree.id, folderId: targetFolderId, userId: user.id });
        moved.push({ id: tree.id, title: nextTitle, targetFolderId });
        previousStates.push(previous);
        if (renameInfo) {
          renamed.push(renameInfo);
        }
      } catch (err) {
        failures.push({ id: tree.id, ...mapError(err) });

        if (renameInfo) {
          try {
            await upsertTreeMetadata({ treeId: tree.id, title: renameInfo.previousTitle, userId: user.id });
            existingTitles.delete(renameInfo.newTitle);
          } catch (rollbackError) {
            console.error("Failed to rollback rename after move failure", rollbackError);
          }
        }
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
            await upsertTreeMetadata({ treeId: previous.id, title: renameInfo.previousTitle, userId: user.id });
          }

          await moveTreeToFolder({ treeId: previous.id, folderId: previous.folderId, userId: user.id });
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
  }, [trees, user, moveTreeToFolder, upsertTreeMetadata]);

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

    setNavSelectedIds(activeSelection);

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
  }, [navSelectedIds, trees]);

  const handleNavDragEnd = useCallback(() => {
    setDraggedTreeIds([]);
    setDragOverFolderId(null);
    setDragOverVoranBox(false);
  }, []);

  const handleNavDropToFolder = useCallback(async (event, folderId) => {
    event.preventDefault();
    const treeIds = extractTreeIdsFromDataTransfer(event?.dataTransfer);

    setDragOverFolderId(null);
    setDragOverVoranBox(false);

    if (treeIds.length === 0) {
      setDraggedTreeIds([]);
      return;
    }

    try {
      const result = await handleTreeMoveToFolder({ treeIds, targetFolderId: folderId });
      if (result?.moved?.length > 0) {
        setSelectedFolderId(folderId);
        setSelectedId(result.moved[0].id);
        setNavSelectedIds(result.moved.map((item) => item.id));
      }
      if (result?.failures?.length > 0) {
        setError(new Error(result.failures[0]?.message || "일부 항목을 이동하지 못했습니다."));
      }
    } catch (error) {
      console.error("Failed to drop tree to folder", error);
      setError(error);
    } finally {
      setDraggedTreeIds([]);
    }
  }, [extractTreeIdsFromDataTransfer, handleTreeMoveToFolder]);

  const toggleFolder = useCallback((folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
    setSelectedFolderId(folderId);
  }, []);

  const handleNavDropToVoran = useCallback(async (event) => {
    event.preventDefault();
    const treeIds = extractTreeIdsFromDataTransfer(event?.dataTransfer);

    setDragOverFolderId(null);
    setDragOverVoranBox(false);

    if (treeIds.length === 0) {
      setDraggedTreeIds([]);
      return;
    }

    try {
      const result = await handleTreeMoveToFolder({ treeIds, targetFolderId: null });
      if (result?.moved?.length > 0) {
        setSelectedFolderId(null);
        setSelectedId(result.moved[0].id);
        setNavSelectedIds(result.moved.map((item) => item.id));
      }
      if (result?.failures?.length > 0) {
        setError(new Error(result.failures[0]?.message || "일부 항목을 이동하지 못했습니다."));
      }
    } catch (error) {
      console.error("Failed to drop tree to VORAN BOX", error);
      setError(error);
    } finally {
      setDraggedTreeIds([]);
    }
  }, [extractTreeIdsFromDataTransfer, handleTreeMoveToFolder]);

  // 필터된 트리 목록 (선택된 폴더에 따라)
  const filteredTrees = useMemo(() => {
    if (selectedFolderId) {
      return trees.filter(tree => tree.folderId === selectedFolderId);
    }
    return trees; // 모든 트리 표시 (폴더별로 구분되어 있음)
  }, [trees, selectedFolderId]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-64 flex-col border-r border-slate-900/60 bg-slate-950/80">
        <div className="border-b border-slate-900/60 px-4 py-4">
          <div className="space-y-3">
            {/* 로고와 제목 */}
            <div className="flex items-center gap-3">
              <img src={Logo} alt="VORAN" className="h-8 w-8 opacity-80" />
              <div>
                <h1 className="text-base font-semibold">저장된 트리</h1>
                <p className="text-xs text-slate-400">라이브러리에서 열 트리를 선택하세요.</p>
              </div>
            </div>

            {/* VORAN BOX 버튼 */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVoranBoxManager(true)}
                className="w-full h-9 px-4 text-sm font-medium text-slate-200 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 hover:border-slate-600/60 rounded-lg transition-all duration-200"
              >
                VORAN BOX
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <EmptyState message="트리를 불러오는 중입니다." />
          ) : (trees.length === 0 && folders.length === 0) ? (
            <EmptyState message="아직 저장된 트리나 폴더가 없습니다." />
          ) : (
            <nav className="flex flex-col gap-1 px-2 py-3">
              {/* New Folder 버튼 */}
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  setCreateType("folder");
                  setShowCreateDialog(true);
                }}
                className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition text-slate-300 hover:bg-slate-900 hover:text-slate-50 border border-dashed border-slate-600 hover:border-slate-500"
              >
                <FolderIcon className="h-4 w-4" />
                <span className="flex-1 truncate">New Folder</span>
                <span className="text-xs text-slate-400">+</span>
              </button>

              {/* 폴더들 표시 */}
              {folders.map((folder) => {
                const folderTrees = trees.filter(tree => tree.folderId === folder.id);
                const isFolderSelected = selectedFolderId === folder.id;
                const hasSelectedTreeInFolder = folderTrees.some(tree => tree.id === selectedId);
                const isDragTarget = dragOverFolderId === folder.id;
                const isExpanded = expandedFolders.has(folder.id);

                return (
                  <div key={folder.id} className="space-y-1">
                    {/* 폴더 헤더 */}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => toggleFolder(folder.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverFolderId(folder.id);
                      }}
                      onDragLeave={() => setDragOverFolderId((prev) => (prev === folder.id ? null : prev))}
                      onDrop={(event) => handleNavDropToFolder(event, folder.id)}
                      className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${isFolderSelected || hasSelectedTreeInFolder
                        ? "bg-slate-800 text-slate-50"
                        : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                        } ${isDragTarget ? "ring-2 ring-blue-400/70" : ""}`}
                    >
                      {folderTrees.length > 0 ? (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )
                      ) : (
                        <FolderIcon className="h-4 w-4" />
                      )}
                      <span className="flex-1 truncate">{folder.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded-full">
                        {folderTrees.length}
                      </span>
                    </button>

                    {/* 폴더 내 트리들 */}
                    {isExpanded && folderTrees.length > 0 && (
                      <div className="ml-6 space-y-1">
                        {folderTrees.map((tree) => {
                          const isActive = tree.id === selectedId;
                          const isSelectedInNav = navSelectedIds.includes(tree.id);
                          const isDraggingTree = draggedTreeIds.includes(tree.id);
                          return (
                            <button
                              key={tree.id}
                              type="button"
                              tabIndex={-1}
                              draggable
                              onClick={() => {
                                setSelectedId(tree.id);
                                setNavSelectedIds([tree.id]);
                              }}
                              onDoubleClick={() => { void handleTreeOpen(tree.id); }}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                handleTreeDelete(tree.id);
                              }}
                              onDragStart={(event) => handleNavDragStart(event, tree.id)}
                              onDragEnd={handleNavDragEnd}
                              className={`w-full flex items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm transition ${isActive
                                ? "bg-slate-700 text-slate-50"
                                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                } ${isSelectedInNav ? "border border-blue-500/50 bg-blue-900/25" : ""} ${isDraggingTree ? "opacity-60" : ""}`}
                            >
                              <div className="w-2 h-2 rounded-full bg-slate-500" />
                              <span className="flex-1 truncate">{tree.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* VORAN BOX에 있는 트리들 (폴더에 속하지 않은 트리들) */}
              {trees.filter(tree => !tree.folderId).length > 0 && (
                <div className="space-y-1">
                  <div
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${dragOverVoranBox ? "bg-blue-900/30 text-blue-200 border border-blue-500/60 rounded-md" : "text-slate-400"}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverVoranBox(true);
                    }}
                    onDragLeave={() => setDragOverVoranBox(false)}
                    onDrop={handleNavDropToVoran}
                  >
                    VORAN BOX
                  </div>
                  {trees.filter(tree => !tree.folderId).map((tree) => {
                    const isActive = tree.id === selectedId;
                    const isSelectedInNav = navSelectedIds.includes(tree.id);
                    const isDraggingThisTree = draggedTreeIds.includes(tree.id);
                    return (
                      <button
                        key={tree.id}
                        type="button"
                        tabIndex={-1}
                        draggable
                        onClick={() => {
                          setSelectedId(tree.id);
                          setNavSelectedIds([tree.id]);
                        }}
                        onDoubleClick={() => { void handleTreeOpen(tree.id); }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          handleTreeDelete(tree.id);
                        }}
                        onDragStart={(event) => handleNavDragStart(event, tree.id)}
                        onDragEnd={handleNavDragEnd}
                        className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${isActive
                          ? "bg-slate-800 text-slate-50"
                          : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                          } ${isSelectedInNav ? "border border-blue-500/50 bg-blue-900/30" : ""} ${isDraggingThisTree ? "opacity-60" : ""}`}
                      >
                        <FolderIcon className="h-4 w-4" />
                        <span className="flex-1 truncate">{tree.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </nav>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-900/60 bg-slate-950/60 px-6 py-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-100">라이브러리 뷰어</span>
            {user ? (
              <span className="text-xs text-slate-400">{user.email || user.user_metadata?.full_name || "로그인 계정"}</span>
            ) : (
              <span className="text-xs text-slate-500">로그인 필요</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshLibrary}
              disabled={loading}
              className="bg-slate-800/50 border-slate-600/50 hover:bg-slate-700/50 hover:border-slate-500/50"
            >
              {loading ? "새로고침 중" : "새로고침"}
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!user || loading}
              onClick={async () => {
                if (!user || typeof window === "undefined") {
                  return;
                }

                try {
                  const newTree = await createTreeForUser({ userId: user.id });

                  setTrees((previous) => {
                    const merged = new Map(previous.map((entry) => [entry.id, entry]));
                    merged.set(newTree.id, newTree);
                    const nextList = Array.from(merged.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    return nextList;
                  });

                  setSelectedId(newTree.id);

                  await openWidgetForTree({ treeId: newTree.id, fresh: true });
                  window.jarvisAPI?.requestLibraryRefresh?.();
                } catch (err) {
                  setError(err);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              새 트리 만들기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (typeof signOut === "function") {
                  signOut();
                }
              }}
              className="text-slate-300 hover:text-slate-100 hover:bg-slate-800/50"
            >
              로그아웃
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-300">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            불러오는 중입니다...
          </div>
        ) : !user ? (
          <EmptyState message="로그인 후 트리를 확인할 수 있습니다." />
        ) : error ? (
          <EmptyState message={error?.message || "트리를 불러오지 못했습니다."} />
        ) : selectedTree ? (
          <ResizablePanelGroup direction="horizontal" className="h-full max-h-screen">
            {/* 트리 뷰어 */}
            <ResizablePanel defaultSize={70} minSize={30} className="min-h-0">
              <TreeCanvas
                selectedMemo={selectedTree}
                onNodeSelect={handleNodeSelect}
                onNodeRemove={handleNodeRemove}
              />
            </ResizablePanel>

            {/* 리사이즈 핸들 */}
            <ResizableHandle withHandle className="bg-slate-700 hover:bg-slate-600" />

            {/* 질문 답변 패널 */}
            <ResizablePanel defaultSize={30} minSize={20} maxSize={80} className="bg-slate-950/40">
              <LibraryQAPanel
                selectedNode={selectedNode}
                selectedTree={selectedTree}
                onNodeUpdate={handleNodeUpdate}
                onNewNodeCreated={handleNewNodeCreated}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : selectedFolderId ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📁</div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                {folders.find(f => f.id === selectedFolderId)?.name || "폴더"}
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                이 폴더에 트리를 추가하거나 트리를 선택해주세요
              </p>
              <p className="text-xs text-slate-500">
                VORAN BOX에서 트리를 이 폴더로 이동할 수 있습니다
              </p>
            </div>
          </div>
        ) : (
          <EmptyState message="트리나 폴더를 선택해주세요." />
        )}
      </main>

      {/* VORAN BOX Manager 모달 */}
      <VoranBoxManager
        isVisible={showVoranBoxManager}
        onClose={() => setShowVoranBoxManager(false)}
        trees={trees}
        folders={folders}
        onTreeSelect={(tree) => {
          setSelectedId(tree.id);
          setShowVoranBoxManager(false);
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

      {/* Create Dialog */}
      <CreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        type={createType}
        folders={folders}
        onFolderCreate={(name, parentId) => handleFolderCreate({ name, parentId })}
        onMemoCreate={() => {}} // 메모 생성은 현재 사용하지 않음
      />
    </div>
  );
};

export default LibraryApp;
