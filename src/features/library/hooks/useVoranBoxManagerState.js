import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useVoranBoxToasts from './useVoranBoxToasts';

const arraysEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
};

const useVoranBoxManagerState = ({
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
  selectedFolderId,
}) => {
  const [selectedTreeIds, setSelectedTreeIds] = useState([]);
  const [draggedTreeIds, setDraggedTreeIds] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [navigationMode, setNavigationMode] = useState(false);
  const [currentFolderIndex, setCurrentFolderIndex] = useState(0);
  const [localSelectedTreeId, setLocalSelectedTreeId] = useState(null);
  const [contextMenuTreeId, setContextMenuTreeId] = useState(null);
  const [editingTreeId, setEditingTreeId] = useState(null);
  const [editingTreeName, setEditingTreeName] = useState('');
  const [activePreviewFolderId, setActivePreviewFolderId] = useState(null);
  const [showInvalidDropIndicator, setShowInvalidDropIndicator] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const { toasts, toastVisuals, showToast, handleToastAction } = useVoranBoxToasts();

  const dragPreviewRef = useRef(null);
  const dragStatusRef = useRef({ canDrop: false });
  const folderHoverTimerRef = useRef(null);
  const lastVibrateRef = useRef(0);
  const voranListRef = useRef(null);
  const wasVisibleRef = useRef(false);

  const cleanupDragPreview = useCallback(() => {
    if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
      document.body.removeChild(dragPreviewRef.current);
    }
    dragPreviewRef.current = null;
  }, []);

  const createDragPreviewElement = useCallback((treeIds) => {
    if (typeof document === 'undefined' || treeIds.length === 0) {
      return null;
    }

    const preview = document.createElement('div');
    preview.style.position = 'absolute';
    preview.style.top = '-9999px';
    preview.style.left = '-9999px';
    preview.style.pointerEvents = 'none';
    preview.style.display = 'flex';
    preview.style.flexDirection = 'column';
    preview.style.gap = '6px';
    preview.style.padding = '12px 16px';
    preview.style.minWidth = '180px';
    preview.style.borderRadius = '12px';
    preview.style.background = 'rgba(15, 23, 42, 0.88)';
    preview.style.border = '1px solid rgba(96, 165, 250, 0.7)';
    preview.style.boxShadow = '0 18px 38px rgba(15, 23, 42, 0.45)';
    preview.style.backdropFilter = 'blur(6px)';

    const badge = document.createElement('span');
    badge.textContent = '이동';
    badge.style.alignSelf = 'flex-end';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = '600';
    badge.style.letterSpacing = '0.4px';
    badge.style.padding = '2px 8px';
    badge.style.borderRadius = '9999px';
    badge.style.background = 'rgba(37, 99, 235, 0.85)';
    badge.style.color = 'white';
    preview.appendChild(badge);

    const firstTree = trees.find((tree) => tree.id === treeIds[0]);
    const title = document.createElement('span');
    title.textContent = firstTree?.title || '제목 없는 트리';
    title.style.fontSize = '12px';
    title.style.fontWeight = '600';
    title.style.color = 'rgba(226, 232, 240, 1)';
    title.style.maxWidth = '240px';
    title.style.whiteSpace = 'nowrap';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    preview.appendChild(title);

    if (treeIds.length > 1) {
      const extra = document.createElement('span');
      extra.textContent = `+${treeIds.length - 1}개 항목`;
      extra.style.fontSize = '11px';
      extra.style.color = 'rgba(148, 163, 184, 1)';
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

  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return '날짜 없음';
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const checkScrollButtons = useCallback(() => {
    if (!voranListRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = voranListRef.current;
    setCanScrollUp(scrollTop > 0);
    setCanScrollDown(scrollTop < scrollHeight - clientHeight - 1);
  }, []);

  const scrollUp = useCallback(() => {
    if (!voranListRef.current) return;
    voranListRef.current.scrollBy({ top: -100, behavior: 'smooth' });
  }, []);

  const scrollDown = useCallback(() => {
    if (!voranListRef.current) return;
    voranListRef.current.scrollBy({ top: 100, behavior: 'smooth' });
  }, []);

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

  useEffect(() => {
    const voranList = voranListRef.current;
    if (!voranList) return;

    checkScrollButtons();

    const handleScroll = () => {
      checkScrollButtons();
    };

    voranList.addEventListener('scroll', handleScroll);

    const resizeObserver = new ResizeObserver(() => {
      checkScrollButtons();
    });
    resizeObserver.observe(voranList);

    return () => {
      voranList.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [checkScrollButtons, voranTrees]);

  const folderTreeCounts = useMemo(() => {
    const counts = { voranCount: 0 };
    trees.forEach((tree) => {
      if (tree.folderId) {
        counts[tree.folderId] = (counts[tree.folderId] || 0) + 1;
      } else {
        counts.voranCount += 1;
      }
    });
    return counts;
  }, [trees]);

  useEffect(() => () => {
    cleanupDragPreview();
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
  }, [localSelectedTreeId, onTreeSelect, voranTrees]);

  const handleTreeMouseDown = useCallback((tree, event, options = {}) => {
    updateSelection(tree, event, options);
  }, [updateSelection]);

  const handleTreeDragStart = useCallback((event, treeId) => {
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

    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('application/json', JSON.stringify({ treeIds: activeSelection }));
      } catch (error) {
        console.error('Failed to serialise drag payload', error);
      }
      event.dataTransfer.setData('text/plain', activeSelection.join(','));

      if (event.dataTransfer.setDragImage) {
        const preview = createDragPreviewElement(activeSelection);
        if (preview) {
          document.body.appendChild(preview);
          dragPreviewRef.current = preview;
          const rect = preview.getBoundingClientRect();
          event.dataTransfer.setDragImage(preview, rect.width / 2, rect.height / 2);
        }
      }
    }
  }, [createDragPreviewElement, selectedTreeIds, trees]);

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

  const handleDragOver = useCallback((event, targetType, targetId) => {
    event.preventDefault();
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragStatusRef.current.canDrop = true;
    setShowInvalidDropIndicator(false);
    setDragOverTarget({ type: targetType, id: targetId });

    if (targetType === 'folder') {
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

  const handleDragLeave = useCallback((event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
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

  const handleDrop = useCallback(async (event, targetType, targetId) => {
    event.preventDefault();
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
      const raw = event?.dataTransfer?.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.treeIds)) {
          payloadIds = parsed.treeIds.filter(Boolean);
        }
      }
    } catch (error) {
      console.error('Failed to parse drag payload', error);
    }

    if (payloadIds.length === 0) {
      const fallback = event?.dataTransfer?.getData('text/plain');
      if (fallback) {
        payloadIds = fallback.split(',').map((id) => id.trim()).filter(Boolean);
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
    const targetFolderId = targetType === 'folder' ? targetId : null;
    const draggedTrees = trees.filter((tree) => uniqueIds.includes(tree.id));
    const isNoOp = draggedTrees.length > 0 && draggedTrees.every((tree) => (tree.folderId ?? null) === targetFolderId);
    if (isNoOp) {
      handleTreeDragEnd();
      return;
    }

    try {
      const result = await onTreeMoveToFolder({ treeIds: uniqueIds, targetFolderId });

      if (targetType === 'folder' && onFolderSelect) {
        onFolderSelect(targetId);
      }
      if (targetType === 'voran' && onFolderSelect) {
        onFolderSelect(null);
      }

      const successCount = result?.moved?.length || 0;
      const failureCount = result?.failures?.length || 0;
      const folderName = targetType === 'folder'
        ? (folders.find((folder) => folder.id === targetId)?.name || '폴더')
        : 'VORAN BOX';

      if (successCount > 0) {
        let message;
        if (successCount === 1) {
          const movedTreeId = result.moved[0].id;
          const movedTree = trees.find((tree) => tree.id === movedTreeId) || draggedTrees.find((tree) => tree.id === movedTreeId);
          const title = movedTree?.title || '제목 없는 트리';
          message = `‘${title}’이(가) ‘${folderName}’으로 이동되었습니다.`;
        } else {
          message = `${successCount}개 항목이 ‘${folderName}’으로 이동되었습니다.`;
        }
        if (failureCount > 0) {
          message += ` (${successCount}개 성공, ${failureCount}개 실패)`;
        }
        showToast({
          type: failureCount > 0 ? 'warning' : 'success',
          message,
          duration: 3000,
          actionLabel: result?.undo ? '되돌리기' : undefined,
          onAction: result?.undo,
        });
      }

      if (Array.isArray(result?.renamed)) {
        result.renamed.forEach((rename) => {
          showToast({
            type: 'info',
            message: `동일한 이름이 있습니다. 바꾸기/겹치기 없이 새 이름으로 저장합니다. → ${rename.newTitle}`,
            duration: 2500,
          });
        });
      }

      if (Array.isArray(result?.failures)) {
        result.failures.forEach((failure) => {
          showToast({
            type: 'error',
            message: failure?.message || '이동에 실패했습니다.',
            duration: 3500,
          });
        });
      }
    } catch (error) {
      console.error('Failed to move tree', error);
      showToast({ type: 'error', message: error?.message || '이동에 실패했습니다.', duration: 3500 });
    } finally {
      setSelectedTreeIds((prev) => prev.filter((id) => !uniqueIds.includes(id)));
      handleTreeDragEnd();
    }
  }, [draggedTreeIds, folders, handleTreeDragEnd, onFolderSelect, onTreeMoveToFolder, showToast, trees]);

  const handleVoranBoxSelect = useCallback(() => {
    if (onFolderSelect) {
      onFolderSelect(null);
    }
    setCurrentFolderIndex(0);
    if (localSelectedTreeId) {
      setNavigationMode(true);
    }
  }, [localSelectedTreeId, onFolderSelect]);

  const handleFolderChipSelect = useCallback((folder, folderIndex) => {
    if (onFolderSelect) {
      onFolderSelect(folder.id);
    }
    setCurrentFolderIndex(folderIndex);
    if (localSelectedTreeId) {
      setNavigationMode(true);
    }
  }, [localSelectedTreeId, onFolderSelect]);

  const handleFolderCreate = useCallback(() => {
    const trimmedName = newFolderName.trim();
    if (trimmedName && onFolderCreate) {
      onFolderCreate(trimmedName, selectedFolderId ?? null);
      setNewFolderName('');
      setShowCreateFolder(false);
    }
  }, [newFolderName, onFolderCreate, selectedFolderId]);

  const handleCancelCreateFolder = useCallback(() => {
    setShowCreateFolder(false);
    setNewFolderName('');
  }, []);

  const handleTreeRename = useCallback((treeId, newName) => {
    if (onTreeRename && newName?.trim()) {
      onTreeRename(treeId, newName.trim());
      setEditingTreeId(null);
      setEditingTreeName('');
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
    setEditingTreeName(tree.title || '');
    setContextMenuTreeId(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingTreeId(null);
    setEditingTreeName('');
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuTreeId && !event.target.closest('.context-menu-container')) {
        setContextMenuTreeId(null);
      }
    };
    if (contextMenuTreeId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
    return undefined;
  }, [contextMenuTreeId]);

  const handleKeyDown = useCallback(async (event) => {
    if (showCreateFolder) {
      if (event.key === 'Enter') {
        handleFolderCreate();
      } else if (event.key === 'Escape') {
        setShowCreateFolder(false);
        setNewFolderName('');
      }
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setCurrentFolderIndex((prev) => {
        const totalItems = folders.length + 1;
        const nextIndex = event.key === 'ArrowLeft'
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

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (voranTrees.length > 0) {
        const currentIndex = voranTrees.findIndex((tree) => tree.id === localSelectedTreeId);
        let nextIndex;
        if (event.key === 'ArrowUp') {
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

    if (event.key === 'Tab') {
      event.preventDefault();
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

    if (localSelectedTreeId && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
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
        console.error('Keyboard move failed', error);
        showToast({ type: 'error', message: error?.message || '이동에 실패했습니다.', duration: 3500 });
      }
    }

    if (event.key === 'Escape') {
      handleClose();
    }
  }, [currentFolderIndex, folders, handleClose, handleFolderCreate, localSelectedTreeId, navigationMode, onFolderSelect, onTreeMoveToFolder, showCreateFolder, showToast, trees, voranTrees]);

  useEffect(() => {
    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
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
          container.scrollBy({ top: -scrollStep, behavior: 'auto' });
        } else if (event.clientY > rect.bottom - threshold) {
          container.scrollBy({ top: scrollStep, behavior: 'auto' });
        }
      }
      if (!dragStatusRef.current.canDrop) {
        const now = Date.now();
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && now - lastVibrateRef.current > 250) {
          try {
            navigator.vibrate(18);
          } catch (error) {
            // vibration optional
          }
          lastVibrateRef.current = now;
        }
        setShowInvalidDropIndicator(true);
      } else {
        setShowInvalidDropIndicator(false);
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragend', handleTreeDragEnd);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragend', handleTreeDragEnd);
    };
  }, [handleTreeDragEnd, isDragging]);

  const handleTreeClick = useCallback((tree, event) => {
    handleTreeMouseDown(tree, event, { notify: true });
  }, [handleTreeMouseDown]);

  const handleTreeDoubleClick = useCallback((tree) => {
    if (!tree) {
      return;
    }
    handleTreeMouseDown(tree, null, { notify: false });
    if (onTreeOpen) {
      onTreeOpen(tree.id);
    }
  }, [handleTreeMouseDown, onTreeOpen]);

  return {
    toasts,
    toastVisuals,
    handleToastAction,
    voranTrees,
    folderTreeCounts,
    canScrollUp,
    canScrollDown,
    scrollUp,
    scrollDown,
    handleClose,
    navigationMode,
    currentFolderIndex,
    localSelectedTreeId,
    dragOverTarget,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    voranListRef,
    selectedTreeIds,
    draggedTreeIds,
    editingTreeId,
    editingTreeName,
    setEditingTreeName,
    contextMenuTreeId,
    toggleContextMenu,
    startEditing,
    cancelEditing,
    handleTreeRename,
    handleTreeDelete,
    handleTreeDragStart,
    handleTreeDragEnd,
    handleTreeMouseDown,
    handleTreeClick,
    handleTreeDoubleClick,
    handleVoranBoxSelect,
    handleFolderChipSelect,
    handleFolderCreate,
    handleCancelCreateFolder,
    handleKeyDown,
    newFolderName,
    setNewFolderName,
    showCreateFolder,
    setShowCreateFolder,
    isDragging,
    showInvalidDropIndicator,
    cursorPosition,
    activePreviewFolderId,
    setActivePreviewFolderId,
    formatDate,
  };
};

export default useVoranBoxManagerState;
