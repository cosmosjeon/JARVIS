import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, FolderTree as FolderIcon, ChevronDown, ChevronRight, Monitor, Moon, Sun } from "lucide-react";

import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "components/ui/resizable";
import { ScrollArea } from "components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "components/ui/dropdown-menu";
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
import { cn } from "lib/utils";
import { useTheme } from "./ThemeProvider";

const EmptyState = ({ message }) => (
  <div className="flex h-full items-center justify-center px-6 text-sm text-foreground/70">
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

  const { theme, setTheme } = useTheme();

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
    if (typeof window === "undefined" || typeof window.jarvisAPI?.onLibraryRefresh !== "function") {
      return () => {};
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

  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
  }, []);

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

      await deleteNodes({
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
  }, [selectedTree, user, selectedNode]);

  const handleFolderCreate = useCallback(async ({ name, parentId }) => {
    if (!user) {
      console.log('폴더 생성 실패: 사용자가 로그인되지 않음');
      return;
    }

    try {
      const newFolder = await createFolder({ name, parentId, userId: user.id });
      setFolders(prev => [...prev, newFolder]);
    } catch (err) {
      console.error('폴더 생성 오류:', err);
      setError(err);
      alert(`폴더 생성 중 오류가 발생했습니다: ${err.message}`);
    }
  }, [user]);

  const handleFolderSelect = useCallback((folderId) => {
    setSelectedFolderId(folderId);
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
        await moveTreeToFolder({ treeId: tree.id, folderId: targetFolderId, userId: user.id });

        if (updatedTitle !== tree.title) {
          await upsertTreeMetadata({ treeId: tree.id, title: updatedTitle, userId: user.id });
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

  const toggleFolder = useCallback((folderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
    setSelectedFolderId(folderId);
  }, []);

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

  const filteredTrees = useMemo(() => {
    if (selectedFolderId) {
      return trees.filter(tree => tree.folderId === selectedFolderId);
    }
    return trees;
  }, [trees, selectedFolderId]);

  const voranTrees = useMemo(() => trees.filter((tree) => !tree.folderId), [trees]);

  const themeOptions = useMemo(() => ([
    { label: "라이트", value: "light", icon: Sun },
    { label: "다크", value: "dark", icon: Moon },
    { label: "시스템", value: "system", icon: Monitor },
  ]), []);

  const activeTheme = themeOptions.find((option) => option.value === theme) || themeOptions[0];
  const ActiveThemeIcon = activeTheme.icon;

  const handleThemeChange = useCallback((value) => {
    setTheme(value);
  }, [setTheme]);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex h-full w-[320px] flex-col border-r border-border bg-card text-card-foreground">
        <div className="border-b border-border px-5 py-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
              <img src={Logo} alt="VORAN" className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
                Knowledge Library
              </p>
              <h1 className="text-lg font-semibold leading-tight text-card-foreground">
                저장된 트리
              </h1>
              <p className="text-xs text-muted-foreground">
                라이브러리에서 열 트리를 선택하세요.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between rounded-lg border border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-card/90 hover:shadow-md"
            onClick={() => setShowVoranBoxManager(true)}
          >
            <span className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4" />
              VORAN BOX
            </span>
            <span className="text-xs text-muted-foreground">관리</span>
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-4 px-4 py-6">
            <Button
              type="button"
              variant="outline"
              className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-sm text-foreground shadow-sm transition hover:border-border hover:bg-accent/30"
              onClick={() => {
                setCreateType("folder");
                setShowCreateDialog(true);
              }}
            >
              <span className="flex items-center gap-2">
                <FolderIcon className="h-4 w-4" />
                New Folder
              </span>
              <span className="text-xs text-muted-foreground">+</span>
            </Button>

            {folders.map((folder) => {
              const folderTrees = trees.filter((tree) => tree.folderId === folder.id);
              const isFolderSelected = selectedFolderId === folder.id;
              const hasSelectedTreeInFolder = folderTrees.some((tree) => tree.id === selectedId);
              const isDragTarget = dragOverFolderId === folder.id;
              const isExpanded = expandedFolders.has(folder.id);

              return (
                <div key={folder.id} className="space-y-2">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => toggleFolder(folder.id)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverFolderId(folder.id);
                    }}
                    onDragLeave={() =>
                      setDragOverFolderId((prev) => (prev === folder.id ? null : prev))
                    }
                    onDrop={(event) => handleNavDropToFolder(event, folder.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg border border-transparent bg-card/70 px-3 py-2 text-left text-sm font-medium shadow-sm transition-colors",
                      (isFolderSelected || hasSelectedTreeInFolder) &&
                        "border-primary/50 bg-primary/10 text-primary-foreground",
                      !isFolderSelected &&
                        !hasSelectedTreeInFolder &&
                        "text-muted-foreground hover:border-border/70 hover:bg-card",
                      isDragTarget && "ring-2 ring-primary/50"
                    )}
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
                    <Badge
                      variant="secondary"
                      className="ml-auto rounded-full border border-border/60 bg-card px-2 py-0 text-[11px] font-medium text-muted-foreground"
                    >
                      {folderTrees.length}
                    </Badge>
                  </button>

                  {isExpanded && folderTrees.length > 0 && (
                    <div className="ml-5 space-y-1.5">
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
                            onDoubleClick={() => {
                              void handleTreeOpen(tree.id);
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              handleTreeDelete(tree.id);
                            }}
                            onDragStart={(event) => handleNavDragStart(event, tree.id)}
                            onDragEnd={handleNavDragEnd}
                            className={cn(
                              "group flex w-full items-center gap-2 rounded-md border border-transparent bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors",
                              isActive && "border-primary/50 bg-primary/10 text-primary-foreground",
                              !isActive &&
                                "text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground",
                              isSelectedInNav && "border-primary/40",
                              isDraggingTree && "opacity-60"
                            )}
                          >
                            <span className="h-2 w-2 rounded-full bg-primary/60" />
                            <span className="flex-1 truncate">{tree.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="space-y-1.5 pt-2">
              <div
                className={cn(
                  "flex items-center justify-between rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition",
                  dragOverVoranBox && "border-primary/60 bg-primary/10 text-primary-foreground"
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverVoranBox(true);
                }}
                onDragLeave={() => setDragOverVoranBox(false)}
                onDrop={(event) => {
                  setDragOverVoranBox(false);
                  handleNavDropToVoran(event);
                }}
              >
                <span>VORAN BOX</span>
                <Badge
                  variant="outline"
                  className="rounded-full border-border/70 px-2 py-0 text-[11px] font-medium text-muted-foreground/80"
                >
                  {voranTrees.length}
                </Badge>
              </div>
              {voranTrees.length > 0 ? (
                voranTrees.map((tree) => {
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
                      onDoubleClick={() => {
                        void handleTreeOpen(tree.id);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        handleTreeDelete(tree.id);
                      }}
                      onDragStart={(event) => handleNavDragStart(event, tree.id)}
                      onDragEnd={handleNavDragEnd}
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-md border border-transparent bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors",
                        isActive && "border-primary/50 bg-primary/10 text-primary-foreground",
                        !isActive &&
                          "text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground",
                        isSelectedInNav && "border-primary/40",
                        isDraggingThisTree && "opacity-60"
                      )}
                    >
                      <FolderIcon className="h-4 w-4" />
                      <span className="flex-1 truncate">{tree.title}</span>
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground/70">
                  폴더 밖에 있는 트리가 없습니다.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </aside>

      <main className="flex flex-1 flex-col bg-background">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-card px-6 py-4 text-card-foreground">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
              Library Viewer
            </span>
            {user ? (
              <span className="text-sm text-card-foreground">
                {user.email || user.user_metadata?.full_name || "로그인 계정"}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">로그인 필요</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full border-border bg-background/30 text-card-foreground"
                >
                  <ActiveThemeIcon className="h-4 w-4" />
                  <span className="sr-only">테마 변경</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>테마</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => handleThemeChange(option.value)}
                      className="flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{option.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshLibrary}
              disabled={loading}
              className="border-border bg-background/30 text-card-foreground hover:bg-background/50"
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
                    const nextList = Array.from(merged.values()).sort(
                      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
                    );
                    return nextList;
                  });

                  setSelectedId(newTree.id);

                  await openWidgetForTree({ treeId: newTree.id, fresh: true });
                  window.jarvisAPI?.requestLibraryRefresh?.();
                } catch (err) {
                  setError(err);
                }
              }}
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
              className="text-muted-foreground hover:text-card-foreground"
            >
              로그아웃
            </Button>
          </div>
        </header>
        <div className="flex-1 bg-background">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              불러오는 중입니다...
            </div>
          ) : !user ? (
            <EmptyState message="로그인 후 트리를 확인할 수 있습니다." />
          ) : error ? (
            <EmptyState message={error?.message || "트리를 불러오지 못했습니다."} />
          ) : selectedTree ? (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={70} minSize={30} className="min-h-0 bg-background">
                <TreeCanvas
                  selectedMemo={selectedTree}
                  onNodeSelect={handleNodeSelect}
                  onNodeRemove={handleNodeRemove}
                />
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-border/80 hover:bg-border" />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={80} className="bg-card">
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
              <Card className="w-full max-w-sm bg-card text-card-foreground">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg font-semibold">
                    {folders.find((f) => f.id === selectedFolderId)?.name || "폴더"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>이 폴더에 트리를 추가하거나 트리를 선택해주세요.</p>
                  <p className="text-xs text-muted-foreground/80">
                    VORAN BOX에서 트리를 이 폴더로 이동할 수 있습니다.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <EmptyState message="트리나 폴더를 선택해주세요." />
          )}
        </div>
      </main>

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

      <CreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        type={createType}
        folders={folders}
        onFolderCreate={(name, parentId) => handleFolderCreate({ name, parentId })}
        onMemoCreate={() => {}}
      />
    </div>
  );

};

export default LibraryApp;
