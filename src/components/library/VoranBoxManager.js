import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    FolderTree as TreeIcon,
    Clock,
    MoreHorizontal,
    FolderPlus,
    Folder,
    Edit,
    Trash2,
    CheckCircle2,
    Info,
    AlertTriangle,
    Ban,
    XCircle
} from "lucide-react";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { cn } from "lib/utils";
import Logo from "assets/admin-widget/logo.svg";

const VoranBoxManager = ({
    isVisible,
    onClose,
    trees = [],
    folders = [],
    onTreeSelect,
    onTreeMoveToFolder,
    onTreeOpen,
    onTreeRename,
    onTreeDelete,
    onFolderCreate,
    onFolderSelect,
    selectedTreeId,
    selectedFolderId,
    loading = false
}) => {
    const [selectedTreeIds, setSelectedTreeIds] = useState([]);
    const [draggedTreeIds, setDraggedTreeIds] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOverTarget, setDragOverTarget] = useState(null);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [navigationMode, setNavigationMode] = useState(false);
    const [currentFolderIndex, setCurrentFolderIndex] = useState(0);
    const [localSelectedTreeId, setLocalSelectedTreeId] = useState(null);
    const [contextMenuTreeId, setContextMenuTreeId] = useState(null);
    const [editingTreeId, setEditingTreeId] = useState(null);
    const [editingTreeName, setEditingTreeName] = useState("");
    const [activePreviewFolderId, setActivePreviewFolderId] = useState(null);
    const [showInvalidDropIndicator, setShowInvalidDropIndicator] = useState(false);
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
    const [toasts, setToasts] = useState([]);

    const dragPreviewRef = useRef(null);
    const dragStatusRef = useRef({ canDrop: false });
    const folderHoverTimerRef = useRef(null);
    const lastVibrateRef = useRef(0);
    const voranListRef = useRef(null);
    const toastIdRef = useRef(0);
    const toastTimersRef = useRef(new Map());
    const wasVisibleRef = useRef(false);

const toastVisuals = useMemo(() => ({
        success: {
            container: "bg-emerald-500/10 border border-emerald-400/40 text-emerald-100",
            iconClass: "text-emerald-300",
            Icon: CheckCircle2,
        },
        info: {
            container: "bg-blue-500/10 border border-blue-400/40 text-blue-100",
            iconClass: "text-blue-300",
            Icon: Info,
        },
        warning: {
            container: "bg-amber-500/10 border border-amber-400/40 text-amber-100",
            iconClass: "text-amber-300",
            Icon: AlertTriangle,
        },
        error: {
            container: "bg-red-500/10 border border-red-400/40 text-red-100",
            iconClass: "text-red-300",
            Icon: XCircle,
        },
        default: {
            container: "bg-muted/70 border border-border/40 text-card-foreground",
            iconClass: "text-card-foreground",
            Icon: Info,
        },
}), []);

const arraysEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
};

    const cleanupDragPreview = useCallback(() => {
        if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
            document.body.removeChild(dragPreviewRef.current);
        }
        dragPreviewRef.current = null;
    }, []);

    const createDragPreviewElement = useCallback((treeIds) => {
        if (typeof document === "undefined" || treeIds.length === 0) {
            return null;
        }

        const preview = document.createElement("div");
        preview.style.position = "absolute";
        preview.style.top = "-9999px";
        preview.style.left = "-9999px";
        preview.style.pointerEvents = "none";
        preview.style.display = "flex";
        preview.style.flexDirection = "column";
        preview.style.gap = "6px";
        preview.style.padding = "12px 16px";
        preview.style.minWidth = "180px";
        preview.style.borderRadius = "12px";
        preview.style.background = "rgba(15, 23, 42, 0.88)";
        preview.style.border = "1px solid rgba(96, 165, 250, 0.7)";
        preview.style.boxShadow = "0 18px 38px rgba(15, 23, 42, 0.45)";
        preview.style.backdropFilter = "blur(6px)";

        const badge = document.createElement("span");
        badge.textContent = "이동";
        badge.style.alignSelf = "flex-end";
        badge.style.fontSize = "10px";
        badge.style.fontWeight = "600";
        badge.style.letterSpacing = "0.4px";
        badge.style.padding = "2px 8px";
        badge.style.borderRadius = "9999px";
        badge.style.background = "rgba(37, 99, 235, 0.85)";
        badge.style.color = "white";
        preview.appendChild(badge);

        const firstTree = trees.find((tree) => tree.id === treeIds[0]);
        const title = document.createElement("span");
        title.textContent = firstTree?.title || "제목 없는 트리";
        title.style.fontSize = "12px";
        title.style.fontWeight = "600";
        title.style.color = "rgba(226, 232, 240, 1)";
        title.style.maxWidth = "240px";
        title.style.whiteSpace = "nowrap";
        title.style.overflow = "hidden";
        title.style.textOverflow = "ellipsis";
        preview.appendChild(title);

        if (treeIds.length > 1) {
            const extra = document.createElement("span");
            extra.textContent = `+${treeIds.length - 1}개 항목`;
            extra.style.fontSize = "11px";
            extra.style.color = "rgba(148, 163, 184, 1)";
            preview.appendChild(extra);
        }

        return preview;
    }, [trees]);

    const handleClose = useCallback(() => {
        if (onFolderSelect) {
            onFolderSelect(null);
        }
        setNavigationMode(false);
        setCurrentFolderIndex(0);
        setLocalSelectedTreeId(null);
        setSelectedTreeIds([]);
        cleanupDragPreview();
        if (onClose) {
            onClose();
        }
    }, [cleanupDragPreview, onClose, onFolderSelect]);

    useEffect(() => {
        if (isVisible && !wasVisibleRef.current) {
            if (onFolderSelect) {
                onFolderSelect(null);
            }
            const initialVoranTrees = trees.filter((tree) => !tree.folderId);
            if (initialVoranTrees.length > 0) {
                setLocalSelectedTreeId(initialVoranTrees[0].id);
                setSelectedTreeIds([initialVoranTrees[0].id]);
                setNavigationMode(true);
                setCurrentFolderIndex(0);
            } else {
                setLocalSelectedTreeId(null);
                setSelectedTreeIds([]);
            }
        } else if (!isVisible && wasVisibleRef.current) {
            setNavigationMode(false);
            setCurrentFolderIndex(0);
        }
        wasVisibleRef.current = isVisible;
    }, [isVisible, onFolderSelect, trees]);

    const formatDate = (timestamp) => {
        if (!timestamp) return "날짜 없음";
        return new Date(timestamp).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const voranTrees = useMemo(() => trees.filter((tree) => !tree.folderId), [trees]);

    useEffect(() => {
        setSelectedTreeIds((prev) => {
            if (prev.length === 0) {
                return prev;
            }
            const available = new Set(voranTrees.map((tree) => tree.id));
            const filtered = prev.filter((id) => available.has(id));
            return filtered.length === prev.length ? prev : filtered;
        });
    }, [voranTrees]);

    useEffect(() => {
        if (selectedTreeIds.length === 0) {
            if (localSelectedTreeId !== null) {
                setLocalSelectedTreeId(null);
            }
            return;
        }
        if (!selectedTreeIds.includes(localSelectedTreeId)) {
            setLocalSelectedTreeId(selectedTreeIds[selectedTreeIds.length - 1]);
        }
    }, [localSelectedTreeId, selectedTreeIds]);

    const folderTreeCounts = useMemo(() => {
        const counts = {};
        trees.forEach((tree) => {
            if (tree.folderId) {
                counts[tree.folderId] = (counts[tree.folderId] || 0) + 1;
            }
        });
        return counts;
    }, [trees]);

    const removeToast = useCallback((id) => {
        const timer = toastTimersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            toastTimersRef.current.delete(id);
        }
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(({ type = "default", message, duration = 2000, actionLabel, onAction } = {}) => {
        if (!message) {
            return null;
        }
        const nextId = toastIdRef.current + 1;
        toastIdRef.current = nextId;
        const toast = {
            id: nextId,
            type,
            message,
            actionLabel,
            onAction,
        };
        setToasts((prev) => [...prev, toast]);
        if (duration > 0) {
            const timer = setTimeout(() => removeToast(nextId), duration);
            toastTimersRef.current.set(nextId, timer);
        }
        return nextId;
    }, [removeToast]);

    const handleToastAction = useCallback(async (toast) => {
        if (!toast) {
            return;
        }
        removeToast(toast.id);
        if (toast.onAction) {
            try {
                await toast.onAction();
                showToast({ type: "info", message: "이동을 되돌렸습니다.", duration: 2000 });
            } catch (err) {
                console.error("Undo action failed", err);
                showToast({ type: "error", message: err?.message || "되돌리기에 실패했습니다.", duration: 3000 });
            }
        }
    }, [removeToast, showToast]);

    useEffect(() => () => {
        cleanupDragPreview();
        toastTimersRef.current.forEach((timer) => clearTimeout(timer));
        toastTimersRef.current.clear();
    }, [cleanupDragPreview]);

    const updateSelection = useCallback((tree, event, { notify = false } = {}) => {
        if (!tree) {
            return;
        }

        const { id: treeId } = tree;
        const isToggle = event?.metaKey || event?.ctrlKey;
        const isRange = event?.shiftKey;

        setSelectedTreeIds((prevSelected) => {
            let nextSelected = prevSelected;

            if (isRange && prevSelected.length > 0) {
                const anchorId = (localSelectedTreeId && voranTrees.some((t) => t.id === localSelectedTreeId))
                    ? localSelectedTreeId
                    : (prevSelected[prevSelected.length - 1] ?? treeId);
                const anchorIndex = voranTrees.findIndex((item) => item.id === anchorId);
                const targetIndex = voranTrees.findIndex((item) => item.id === treeId);

                if (anchorIndex !== -1 && targetIndex !== -1) {
                    const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
                    const rangeIds = voranTrees.slice(start, end + 1).map((item) => item.id);
                    nextSelected = Array.from(new Set([...prevSelected, ...rangeIds]));
                } else {
                    nextSelected = prevSelected.includes(treeId) ? prevSelected : [...prevSelected, treeId];
                }
            } else if (isToggle) {
                if (prevSelected.includes(treeId)) {
                    const filtered = prevSelected.filter((id) => id !== treeId);
                    nextSelected = filtered.length > 0 ? filtered : [treeId];
                } else {
                    nextSelected = [...prevSelected, treeId];
                }
            } else {
                nextSelected = [treeId];
            }

            return arraysEqual(prevSelected, nextSelected) ? prevSelected : nextSelected;
        });

        setLocalSelectedTreeId(treeId);

        if (notify && onTreeSelect) {
            onTreeSelect(tree);
        }
    }, [localSelectedTreeId, onFolderSelect, onTreeSelect, voranTrees]);

    const handleTreeDragStart = useCallback((e, treeId) => {
        const tree = trees.find((entry) => entry.id === treeId);
        if (!tree) {
            return;
        }

        let activeSelection = selectedTreeIds.includes(treeId) && selectedTreeIds.length > 0
            ? [...selectedTreeIds]
            : [treeId];

        if (!selectedTreeIds.includes(treeId)) {
            requestAnimationFrame(() => {
                setSelectedTreeIds((prevSelected) => (prevSelected.includes(treeId) ? prevSelected : [treeId]));
            });
        }

        setLocalSelectedTreeId(treeId);

        setDraggedTreeIds(activeSelection);
        setIsDragging(true);
        dragStatusRef.current.canDrop = false;

        if (e?.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            try {
                e.dataTransfer.setData("application/json", JSON.stringify({ treeIds: activeSelection }));
            } catch (error) {
                console.error("Failed to serialise drag payload", error);
            }
            e.dataTransfer.setData("text/plain", activeSelection.join(","));

            if (e.dataTransfer.setDragImage) {
                const preview = createDragPreviewElement(activeSelection);
                if (preview) {
                    document.body.appendChild(preview);
                    dragPreviewRef.current = preview;
                    const rect = preview.getBoundingClientRect();
                    e.dataTransfer.setDragImage(preview, rect.width / 2, rect.height / 2);
                }
            }
        }
    }, [createDragPreviewElement, onFolderSelect, selectedTreeIds, trees]);

    const handleTreeDragEnd = useCallback(() => {
        setDraggedTreeIds([]);
        setIsDragging(false);
        setDragOverTarget(null);
        setShowInvalidDropIndicator(false);
        setActivePreviewFolderId(null);
        dragStatusRef.current.canDrop = false;
        if (folderHoverTimerRef.current) {
            clearTimeout(folderHoverTimerRef.current);
            folderHoverTimerRef.current = null;
        }
        cleanupDragPreview();
    }, [cleanupDragPreview]);

    const handleDragOver = useCallback((e, targetType, targetId) => {
        e.preventDefault();
        if (e?.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }
        dragStatusRef.current.canDrop = true;
        setShowInvalidDropIndicator(false);
        setDragOverTarget({ type: targetType, id: targetId });

        if (targetType === "folder") {
            if (folderHoverTimerRef.current) {
                clearTimeout(folderHoverTimerRef.current);
            }
            if (activePreviewFolderId && activePreviewFolderId !== targetId) {
                setActivePreviewFolderId(null);
            }
            folderHoverTimerRef.current = setTimeout(() => {
                setActivePreviewFolderId(targetId);
            }, 600);
        } else {
            if (folderHoverTimerRef.current) {
                clearTimeout(folderHoverTimerRef.current);
                folderHoverTimerRef.current = null;
            }
            setActivePreviewFolderId(null);
        }
    }, [activePreviewFolderId]);

    const handleDragLeave = useCallback((e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverTarget(null);
            dragStatusRef.current.canDrop = false;
            setShowInvalidDropIndicator(false);
            if (folderHoverTimerRef.current) {
                clearTimeout(folderHoverTimerRef.current);
                folderHoverTimerRef.current = null;
            }
            setActivePreviewFolderId(null);
        }
    }, []);

    const handleDrop = useCallback(async (e, targetType, targetId) => {
        e.preventDefault();
        dragStatusRef.current.canDrop = false;
        setDragOverTarget(null);
        setActivePreviewFolderId(null);
        setShowInvalidDropIndicator(false);
        if (folderHoverTimerRef.current) {
            clearTimeout(folderHoverTimerRef.current);
            folderHoverTimerRef.current = null;
        }

        let payloadIds = [];
        try {
            const raw = e?.dataTransfer?.getData("application/json");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.treeIds)) {
                    payloadIds = parsed.treeIds.filter(Boolean);
                }
            }
        } catch (error) {
            console.error("Failed to parse drag payload", error);
        }

        if (payloadIds.length === 0) {
            const fallback = e?.dataTransfer?.getData("text/plain");
            if (fallback) {
                payloadIds = fallback.split(",").map((id) => id.trim()).filter(Boolean);
            }
        }

        if (payloadIds.length === 0 && draggedTreeIds.length > 0) {
            payloadIds = [...draggedTreeIds];
        }

        if (payloadIds.length === 0 || !onTreeMoveToFolder) {
            handleTreeDragEnd();
            return;
        }

        const uniqueIds = Array.from(new Set(payloadIds));
        const targetFolderId = targetType === "folder" ? targetId : null;
        const draggedTrees = trees.filter((tree) => uniqueIds.includes(tree.id));
        const isNoOp = draggedTrees.length > 0 && draggedTrees.every((tree) => (tree.folderId ?? null) === targetFolderId);
        if (isNoOp) {
            handleTreeDragEnd();
            return;
        }

        try {
            const result = await onTreeMoveToFolder({ treeIds: uniqueIds, targetFolderId });

            if (targetType === "folder" && onFolderSelect) {
                onFolderSelect(targetId);
            }
            if (targetType === "voran" && onFolderSelect) {
                onFolderSelect(null);
            }

            const successCount = result?.moved?.length || 0;
            const failureCount = result?.failures?.length || 0;
            const folderName = targetType === "folder"
                ? (folders.find((folder) => folder.id === targetId)?.name || "폴더")
                : "VORAN BOX";

            if (successCount > 0) {
                let message;
                if (successCount === 1) {
                    const movedTreeId = result.moved[0].id;
                    const movedTree = trees.find((tree) => tree.id === movedTreeId) || draggedTrees.find((tree) => tree.id === movedTreeId);
                    const title = movedTree?.title || "제목 없는 트리";
                    message = `‘${title}’이(가) ‘${folderName}’으로 이동되었습니다.`;
                } else {
                    message = `${successCount}개 항목이 ‘${folderName}’으로 이동되었습니다.`;
                }
                if (failureCount > 0) {
                    message += ` (${successCount}개 성공, ${failureCount}개 실패)`;
                }
                showToast({
                    type: failureCount > 0 ? "warning" : "success",
                    message,
                    duration: 3000,
                    actionLabel: result?.undo ? "되돌리기" : undefined,
                    onAction: result?.undo,
                });
            }

            if (Array.isArray(result?.renamed)) {
                result.renamed.forEach((rename) => {
                    showToast({
                        type: "info",
                        message: `동일한 이름이 있습니다. 바꾸기/겹치기 없이 새 이름으로 저장합니다. → ${rename.newTitle}`,
                        duration: 2500,
                    });
                });
            }

            if (Array.isArray(result?.failures)) {
                result.failures.forEach((failure) => {
                    showToast({
                        type: "error",
                        message: failure?.message || "이동에 실패했습니다.",
                        duration: 3500,
                    });
                });
            }
        } catch (error) {
            console.error("Failed to move tree", error);
            showToast({ type: "error", message: error?.message || "이동에 실패했습니다.", duration: 3500 });
        } finally {
            setSelectedTreeIds((prev) => prev.filter((id) => !uniqueIds.includes(id)));
            handleTreeDragEnd();
        }
    }, [draggedTreeIds, folders, handleTreeDragEnd, onFolderSelect, onTreeMoveToFolder, showToast, trees]);

    const handleTreeClick = useCallback((tree, event) => {
        updateSelection(tree, event, { notify: true });
    }, [updateSelection]);

    const handleTreeDoubleClick = useCallback((tree) => {
        if (!tree) {
            return;
        }
        updateSelection(tree, null, { notify: false });
        if (onTreeOpen) {
            onTreeOpen(tree.id);
        }
    }, [onTreeOpen, updateSelection]);

    const handleFolderCreate = useCallback(() => {
        if (newFolderName.trim() && onFolderCreate) {
            onFolderCreate({ name: newFolderName.trim() });
            setNewFolderName("");
            setShowCreateFolder(false);
        }
    }, [newFolderName, onFolderCreate]);

    const handleTreeRename = useCallback((treeId, newName) => {
        if (onTreeRename && newName?.trim()) {
            onTreeRename(treeId, newName.trim());
            setEditingTreeId(null);
            setEditingTreeName("");
        }
    }, [onTreeRename]);

    const handleTreeDelete = useCallback((treeId) => {
        if (onTreeDelete) {
            onTreeDelete(treeId);
        }
        setContextMenuTreeId(null);
    }, [onTreeDelete]);

    const toggleContextMenu = useCallback((treeId) => {
        setContextMenuTreeId((prev) => (prev === treeId ? null : treeId));
    }, []);

    const startEditing = useCallback((tree) => {
        setEditingTreeId(tree.id);
        setEditingTreeName(tree.title || "");
        setContextMenuTreeId(null);
    }, []);

    const cancelEditing = useCallback(() => {
        setEditingTreeId(null);
        setEditingTreeName("");
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (contextMenuTreeId && !event.target.closest(".context-menu-container")) {
                setContextMenuTreeId(null);
            }
        };
        if (contextMenuTreeId) {
            document.addEventListener("click", handleClickOutside);
            return () => document.removeEventListener("click", handleClickOutside);
        }
        return undefined;
    }, [contextMenuTreeId]);

    const handleKeyDown = useCallback(async (e) => {
        if (showCreateFolder) {
            if (e.key === "Enter") {
                handleFolderCreate();
            } else if (e.key === "Escape") {
                setShowCreateFolder(false);
                setNewFolderName("");
            }
            return;
        }

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setCurrentFolderIndex((prev) => {
                const totalItems = folders.length + 1;
                const nextIndex = e.key === "ArrowLeft"
                    ? (prev === 0 ? totalItems - 1 : prev - 1)
                    : (prev + 1) % totalItems;

                if (nextIndex === 0) {
                    if (onFolderSelect) {
                        onFolderSelect(null);
                    }
                } else {
                    const targetFolder = folders[nextIndex - 1];
                    if (targetFolder && onFolderSelect) {
                        onFolderSelect(targetFolder.id);
                    }
                }
                return nextIndex;
            });
        }

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            if (voranTrees.length > 0) {
                const currentIndex = voranTrees.findIndex((tree) => tree.id === localSelectedTreeId);
                let nextIndex;
                if (e.key === "ArrowUp") {
                    nextIndex = currentIndex === -1 ? 0 : (currentIndex === 0 ? voranTrees.length - 1 : currentIndex - 1);
                } else {
                    nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % voranTrees.length;
                }
                if (voranTrees[nextIndex]) {
                    const nextId = voranTrees[nextIndex].id;
                    setLocalSelectedTreeId(nextId);
                    setSelectedTreeIds([nextId]);
                }
            }
        }

        if (e.key === "Tab") {
            e.preventDefault();
            setCurrentFolderIndex((prev) => {
                const totalItems = folders.length + 1;
                const nextIndex = (prev + 1) % totalItems;
                if (nextIndex === 0) {
                    if (onFolderSelect) {
                        onFolderSelect(null);
                    }
                } else {
                    const targetFolder = folders[nextIndex - 1];
                    if (targetFolder && onFolderSelect) {
                        onFolderSelect(targetFolder.id);
                    }
                }
                return nextIndex;
            });
        }

        if (localSelectedTreeId && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            const selectedTree = trees.find((tree) => tree.id === localSelectedTreeId);
            if (!selectedTree) {
                return;
            }
            try {
                if (currentFolderIndex === 0) {
                    await onTreeMoveToFolder?.({ treeIds: [selectedTree.id], targetFolderId: null });
                } else {
                    const targetFolder = folders[currentFolderIndex - 1];
                    if (targetFolder) {
                        await onTreeMoveToFolder?.({ treeIds: [selectedTree.id], targetFolderId: targetFolder.id });
                    }
                }
            } catch (error) {
                console.error("Keyboard move failed", error);
                showToast({ type: "error", message: error?.message || "이동에 실패했습니다.", duration: 3500 });
            }
        }

        if (e.key === "Escape") {
            handleClose();
        }
    }, [currentFolderIndex, folders, handleClose, handleFolderCreate, localSelectedTreeId, navigationMode, onFolderSelect, onTreeMoveToFolder, showCreateFolder, showToast, trees, voranTrees]);

    useEffect(() => {
        if (isVisible) {
            document.addEventListener("keydown", handleKeyDown);
            return () => document.removeEventListener("keydown", handleKeyDown);
        }
        return undefined;
    }, [handleKeyDown, isVisible]);

    useEffect(() => {
        if (!isDragging) {
            setShowInvalidDropIndicator(false);
            return undefined;
        }

        const handleWindowDragOver = (event) => {
            setCursorPosition({ x: event.clientX, y: event.clientY });
            const container = voranListRef.current;
            if (container) {
                const rect = container.getBoundingClientRect();
                const threshold = 48;
                const scrollStep = 14;
                if (event.clientY < rect.top + threshold) {
                    container.scrollBy({ top: -scrollStep, behavior: "auto" });
                } else if (event.clientY > rect.bottom - threshold) {
                    container.scrollBy({ top: scrollStep, behavior: "auto" });
                }
            }
            if (!dragStatusRef.current.canDrop) {
                const now = Date.now();
                if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function" && now - lastVibrateRef.current > 250) {
                    try {
                        navigator.vibrate(18);
                    } catch (err) {
                        // 일부 환경에서는 지원하지 않을 수 있음
                    }
                    lastVibrateRef.current = now;
                }
                setShowInvalidDropIndicator(true);
            } else {
                setShowInvalidDropIndicator(false);
            }
        };

        window.addEventListener("dragover", handleWindowDragOver);
        window.addEventListener("dragend", handleTreeDragEnd);

        return () => {
            window.removeEventListener("dragover", handleWindowDragOver);
            window.removeEventListener("dragend", handleTreeDragEnd);
        };
    }, [handleTreeDragEnd, isDragging]);

    if (!isVisible) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: "spring", duration: 0.3 }}
                    className="w-full max-w-6xl h-[80vh] mx-4 bg-card border border-border rounded-lg shadow-xl flex overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* VORAN BOX */}
                    <div
                        className={cn(
                            "flex-1 border-r border-border/60 bg-card/40 transition-colors",
                            dragOverTarget?.type === "voran" && "bg-blue-900/25 border-blue-500/60"
                        )}
                        onDragOver={(e) => handleDragOver(e, "voran", null)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, "voran", null)}
                    >
                        <div className="border-b border-border/60 px-4 h-[87px] flex flex-col justify-center">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold text-card-foreground">VORAN BOX</h3>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{voranTrees.length}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClose}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-card-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">저장된 트리들을 관리하세요</p>
                            {navigationMode && localSelectedTreeId && (
                                <div className="mt-2 text-xs text-blue-400 font-medium">탭키로 폴더를 선택하고 엔터로 저장하세요</div>
                            )}
                            {dragOverTarget?.type === "voran" && (
                                <div className="mt-2 text-xs text-blue-400 font-medium">여기에 트리를 놓으면 VORAN BOX로 이동합니다</div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-3" ref={voranListRef}>
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-sm text-muted-foreground">로딩 중...</div>
                                </div>
                            ) : voranTrees.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <TreeIcon className="h-8 w-8 text-muted-foreground/70 mb-2" />
                                    <p className="text-sm text-muted-foreground">저장된 트리가 없습니다</p>
                                </div>
                            ) : (
                                <div className="space-y-0">
                                    {voranTrees.map((tree, index) => {
                                        const isSelected = selectedTreeIds.includes(tree.id);
                                        const isDraggingTree = draggedTreeIds.includes(tree.id);

                                        return (
                                            <div key={tree.id}>
                                                {index > 0 && <div className="border-t border-border/50 my-1" />}
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    transition={{ duration: 0.2 }}
                                                    draggable={editingTreeId !== tree.id}
                                                    onMouseDown={(event) => {
                                                        if (event.button !== 0 || editingTreeId === tree.id) {
                                                            return;
                                                        }
                                                        updateSelection(tree, event, { notify: false });
                                                    }}
                                                    onDragStart={(e) => editingTreeId !== tree.id && handleTreeDragStart(e, tree.id)}
                                                    onDragEnd={handleTreeDragEnd}
                                                    onClick={(event) => editingTreeId !== tree.id && handleTreeClick(tree, event)}
                                                    onDoubleClick={() => editingTreeId !== tree.id && handleTreeDoubleClick(tree)}
                                                    className={cn(
                                                        "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all",
                                                        editingTreeId !== tree.id && "cursor-pointer hover:bg-muted/50 active:bg-muted/70",
                                                        isSelected && "bg-border/60 border border-border/60 shadow-inner",
                                                        isDraggingTree && "opacity-60 scale-[0.98]"
                                                    )}
                                                >
                                                    <TreeIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        {editingTreeId === tree.id ? (
                                                            <Input
                                                                value={editingTreeName}
                                                                onChange={(e) => setEditingTreeName(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        handleTreeRename(tree.id, editingTreeName);
                                                                    } else if (e.key === "Escape") {
                                                                        cancelEditing();
                                                                    }
                                                                }}
                                                                onBlur={() => handleTreeRename(tree.id, editingTreeName)}
                                                                className="h-6 text-xs bg-border border-border text-card-foreground"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <>
                                                                <div className="font-medium text-card-foreground truncate text-xs">{tree.title || "제목 없는 트리"}</div>
                                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                    <Clock className="h-2.5 w-2.5" />
                                                                    <span className="text-xs">{formatDate(tree.updatedAt)}</span>
                                                                    <span>•</span>
                                                                    <span className="text-xs">{tree.treeData?.nodes?.length || 0}개 노드</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    {editingTreeId !== tree.id && (
                                                        <div className="relative context-menu-container">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100 transition-opacity bg-border/60 hover:bg-border/50"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleContextMenu(tree.id);
                                                                }}
                                                            >
                                                                <MoreHorizontal className="h-3 w-3" />
                                                            </Button>
                                                            {contextMenuTreeId === tree.id && (
                                                                <div className="absolute right-0 top-6 z-50 bg-muted border border-border rounded-md shadow-lg py-1 min-w-[120px]">
                                                                    <button
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-card-foreground hover:bg-border flex items-center gap-2"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            startEditing(tree);
                                                                        }}
                                                                    >
                                                                        <Edit className="h-3 w-3" />
                                                                        이름 고치기
                                                                    </button>
                                                                    <button
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-border flex items-center gap-2"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleTreeDelete(tree.id);
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                        지우기
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 폴더 관리 */}
                    <div className="flex-1 bg-card/40 flex flex-col">
                        <div className="px-4 pt-3 pb-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-card-foreground">폴더 관리</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowCreateFolder(true)}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-card-foreground"
                                >
                                    <FolderPlus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="px-4 py-2 border-b border-border/60">
                            <div className="flex gap-2 overflow-x-auto">
                                <button
                                    className={cn(
                                        "flex-shrink-0 flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs transition-all bg-muted/80 border border-border/60",
                                        "focus:outline-none focus:ring-0",
                                        !(selectedFolderId === null || (navigationMode && currentFolderIndex === 0)) && "hover:bg-border/80 hover:border-border/50",
                                        (selectedFolderId === null || (navigationMode && currentFolderIndex === 0)) && "bg-blue-600/30 border-blue-500/70",
                                        dragOverTarget?.type === "voran" && "bg-blue-900/30 border-blue-500/70 ring-1 ring-blue-400/60 scale-[1.02] shadow-md"
                                    )}
                                    onClick={() => {
                                        if (onFolderSelect) {
                                            onFolderSelect(null);
                                        }
                                        if (localSelectedTreeId) {
                                            setNavigationMode(true);
                                            setCurrentFolderIndex(0);
                                        }
                                    }}
                                    onDragOver={(e) => handleDragOver(e, "voran", null)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, "voran", null)}
                                >
                                    <TreeIcon className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-card-foreground">VORAN BOX</span>
                                    <span className="text-xs text-muted-foreground bg-border px-1 py-0.5 rounded-full">{voranTrees.length}</span>
                                </button>

                                {folders.length === 0 ? (
                                    <div className="flex items-center justify-center py-4 text-center">
                                        <p className="text-sm text-muted-foreground">폴더가 없습니다</p>
                                    </div>
                                ) : (
                                    folders.map((folder, index) => {
                                        const folderIndex = index + 1;
                                        const isNavigationSelected = navigationMode && folderIndex === currentFolderIndex;
                                        const isDragTarget = dragOverTarget?.type === "folder" && dragOverTarget?.id === folder.id;
                                        const isPreview = activePreviewFolderId === folder.id;

                                        return (
                                            <button
                                                key={folder.id}
                                                className={cn(
                                                    "flex-shrink-0 flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs transition-all bg-muted/80 border border-border/60",
                                                    "focus:outline-none focus:ring-0",
                                                    !(selectedFolderId === folder.id || isNavigationSelected) && "hover:bg-border/80 hover:border-border/50",
                                                    (selectedFolderId === folder.id || isNavigationSelected) && "bg-blue-600/30 border-blue-500/70",
                                                    isDragTarget && "bg-blue-900/30 border-blue-500/70 ring-1 ring-blue-400/60",
                                                    isPreview && "scale-[1.04] shadow-lg ring-2 ring-blue-300/60"
                                                )}
                                                onClick={() => {
                                                    if (onFolderSelect) {
                                                        onFolderSelect(folder.id);
                                                    }
                                                    if (localSelectedTreeId) {
                                                        setNavigationMode(true);
                                                        setCurrentFolderIndex(folderIndex);
                                                    }
                                                }}
                                                onDragOver={(e) => handleDragOver(e, "folder", folder.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, "folder", folder.id)}
                                            >
                                                <Folder className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-card-foreground">{folder.name}</span>
                                                <span className="text-xs text-muted-foreground bg-border px-1 py-0.5 rounded-full">{folderTreeCounts[folder.id] || 0}</span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <AnimatePresence>
                            {showCreateFolder && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="border-b border-border/60 px-4 py-3"
                                >
                                    <div className="space-y-2">
                                        <Input
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="폴더 이름"
                                            className="h-8 text-sm bg-muted border-border focus:border-blue-500"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={handleFolderCreate}
                                                disabled={!newFolderName.trim()}
                                                className="h-6 px-2 text-xs"
                                            >
                                                생성
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowCreateFolder(false);
                                                    setNewFolderName("");
                                                }}
                                                className="h-6 px-2 text-xs"
                                            >
                                                취소
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex-1 overflow-y-auto px-4 py-3 transition-colors">
                            {selectedFolderId ? (
                                <div
                                    className={cn(
                                        "h-full",
                                        dragOverTarget?.type === "folder" && dragOverTarget?.id === selectedFolderId && "bg-blue-900/20"
                                    )}
                                    onDragOver={(e) => handleDragOver(e, "folder", selectedFolderId)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, "folder", selectedFolderId)}
                                >
                                    {(() => {
                                        const folderTrees = trees.filter((tree) => tree.folderId === selectedFolderId);
                                        if (folderTrees.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                                                    <TreeIcon className="h-8 w-8 text-muted-foreground/70 mb-2" />
                                                    <p className="text-sm text-muted-foreground">이 폴더에 트리가 없습니다</p>
                                                    {dragOverTarget?.type === "folder" && dragOverTarget?.id === selectedFolderId && (
                                                        <div className="mt-2 text-xs text-blue-400 font-medium">여기에 트리를 놓으면 이 폴더로 이동합니다</div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-0">
                                                {folderTrees.map((tree, index) => {
                                                    const isSelected = tree.id === localSelectedTreeId;
                                                    const isDraggingTree = draggedTreeIds.includes(tree.id);
                                                    return (
                                                        <div key={tree.id}>
                                                            {index > 0 && <div className="border-t border-border/50 my-1" />}
                                                            <motion.div
                                                                initial={{ opacity: 0, y: -10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -10 }}
                                                                transition={{ duration: 0.2 }}
                                                                        draggable
                                                                        onMouseDown={(event) => {
                                                                            if (event.button !== 0) {
                                                                                return;
                                                                            }
                                                                            updateSelection(tree, event, { notify: false });
                                                                        }}
                                                                        onDragStart={(e) => handleTreeDragStart(e, tree.id)}
                                                                onDragEnd={handleTreeDragEnd}
                                                                onClick={(event) => handleTreeClick(tree, event)}
                                                                onDoubleClick={() => handleTreeDoubleClick(tree)}
                                                                className={cn(
                                                                    "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all cursor-pointer",
                                                                    "hover:bg-muted/50 active:bg-muted/70",
                                                                    isSelected && "bg-border/60 border border-border/50",
                                                                    isDraggingTree && "opacity-50 scale-95"
                                                                )}
                                                            >
                                                                <TreeIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-card-foreground truncate text-xs">{tree.title || "제목 없는 트리"}</div>
                                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                        <Clock className="h-2.5 w-2.5" />
                                                                        <span className="text-xs">{formatDate(tree.updatedAt)}</span>
                                                                        <span>•</span>
                                                                        <span className="text-xs">{tree.treeData?.nodes?.length || 0}개 노드</span>
                                                                    </div>
                                                                </div>
                                                                <div className="relative context-menu-container">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100 transition-opacity bg-border/60 hover:bg-border/50"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleContextMenu(tree.id);
                                                                        }}
                                                                    >
                                                                        <MoreHorizontal className="h-3 w-3" />
                                                                    </Button>
                                                                    {contextMenuTreeId === tree.id && (
                                                                        <div className="absolute right-0 top-6 z-50 bg-muted border border-border rounded-md shadow-lg py-1 min-w-[120px]">
                                                                            <button
                                                                                className="w-full px-3 py-1.5 text-left text-xs text-card-foreground hover:bg-border flex items-center gap-2"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    startEditing(tree);
                                                                                }}
                                                                            >
                                                                                <Edit className="h-3 w-3" />
                                                                                이름 고치기
                                                                            </button>
                                                                            <button
                                                                                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-border flex items-center gap-2"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleTreeDelete(tree.id);
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                                지우기
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        </div>
                                                    );
                                                })}
                                                {dragOverTarget?.type === "folder" && dragOverTarget?.id === selectedFolderId && (
                                                    <div className="mt-2 text-xs text-blue-400 font-medium text-center">여기에 트리를 놓으면 이 폴더로 이동합니다</div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="flex items-center gap-3 mb-4">
                                        <img src={Logo} alt="VORAN" className="h-12 w-12 opacity-80" />
                                        <div className="text-left">
                                            <h3 className="text-lg font-semibold text-card-foreground mb-1">라이브러리</h3>
                                            <p className="text-sm text-muted-foreground">라이브러리에서 열 트리를 선택하세요.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground/80">
                                        <p>• 폴더를 클릭하여 트리를 확인하세요</p>
                                        <p>• 키보드로 빠르게 탐색할 수 있습니다</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border/60 px-4 py-2 bg-muted/30">
                            <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-border rounded text-xs">←</kbd><kbd className="px-1.5 py-0.5 bg-border rounded text-xs">→</kbd><span className="text-muted-foreground/80">폴더 이동</span></span>
                                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-border rounded text-xs">↑</kbd><kbd className="px-1.5 py-0.5 bg-border rounded text-xs">↓</kbd><span className="text-muted-foreground/80">트리 선택</span></span>
                                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-border rounded text-xs">Tab</kbd><span className="text-muted-foreground/80">폴더 순환</span></span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-border rounded text-xs">Enter</kbd><span className="text-muted-foreground/80">트리 저장</span></span>
                                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-border rounded text-xs">Esc</kbd><span className="text-muted-foreground/80">닫기</span></span>
                                    <span className="flex items-center gap-1 text-muted-foreground/80">드래그로 이동</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="pointer-events-none fixed right-6 top-6 z-[101] space-y-2">
                    <AnimatePresence>
                        {toasts.map((toast) => {
                            const visuals = toastVisuals[toast.type] || toastVisuals.default;
                            const Icon = visuals.Icon;
                            return (
                                <motion.div
                                    key={toast.id}
                                    initial={{ opacity: 0, y: -12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.18 }}
                                    className={cn(
                                        "pointer-events-auto flex min-w-[260px] max-w-[320px] items-start gap-3 rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm",
                                        visuals.container
                                    )}
                                >
                                    <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", visuals.iconClass)} />
                                    <div className="flex-1 text-xs leading-5">{toast.message}</div>
                                    {toast.actionLabel && toast.onAction && (
                                        <button
                                            className="text-xs font-semibold text-blue-200 hover:text-white"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                handleToastAction(toast);
                                            }}
                                        >
                                            {toast.actionLabel}
                                        </button>
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {isDragging && showInvalidDropIndicator && (
                        <motion.div
                            key="invalid-drop-indicator"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.12 }}
                            className="pointer-events-none fixed z-[102] flex items-center gap-2 rounded-md border border-red-400/50 bg-red-500/10 px-3 py-1 text-xs text-red-200 shadow-lg backdrop-blur-sm"
                            style={{ transform: `translate3d(${cursorPosition.x + 14}px, ${cursorPosition.y + 18}px, 0)` }}
                        >
                            <Ban className="h-3.5 w-3.5" />
                            <span>놓을 수 없습니다</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
};

export default VoranBoxManager;
