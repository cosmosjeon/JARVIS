import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CONTEXT_MENU_STATE,
  DEFAULT_NODE_SIZE_STATE,
  getNodeDatum,
  getNodeId,
} from '../utils/forceTreeUtils';

const useForceTreeContextMenu = ({
  containerRef,
  viewTransform,
  simulatedNodes,
  setSimulatedNodes,
  onNodeUpdate,
  onNodeRemove,
  onMemoCreate,
  onLinkCreate,
  onRootCreate,
  onNodeClick,
  setSelectedNodeId,
  setSelectedNodeIds,
  setHoveredNodeId,
  selectionBoxDidDragRef,
  pendingCenterNodeIdRef,
  shouldOpenNodeRef,
  dimensions,
  isDraggingNode,
  draggedNodeId,
  selectedNodeId,
}) => {
  const [contextMenuState, setContextMenuState] = useState(() => ({ ...DEFAULT_CONTEXT_MENU_STATE }));
  const [nodeSizeState, setNodeSizeState] = useState(() => ({ ...DEFAULT_NODE_SIZE_STATE }));
  const [linkCreationState, setLinkCreationState] = useState({ active: false, sourceId: null });
  const isLinking = linkCreationState.active;
  const linkingSourceId = linkCreationState.sourceId;

  const cancelLinkCreation = useCallback(() => {
    setLinkCreationState({ active: false, sourceId: null });
    pendingCenterNodeIdRef.current = null;
  }, [pendingCenterNodeIdRef]);

  const resetContextMenu = useCallback(() => {
    setContextMenuState({ ...DEFAULT_CONTEXT_MENU_STATE });
  }, [setContextMenuState]);

  useEffect(() => {
    if (!contextMenuState.open) {
      return;
    }

    const handlePointerDown = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && target.closest('[data-force-tree-context-menu="true"]')) {
        return;
      }
      resetContextMenu();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        resetContextMenu();
      }
    };

    const handleScroll = () => {
      resetContextMenu();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleEscape, true);
    window.addEventListener('wheel', handleScroll, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleEscape, true);
      window.removeEventListener('wheel', handleScroll, true);
    };
  }, [contextMenuState.open, resetContextMenu]);

  useEffect(() => {
    if (!isLinking) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelLinkCreation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLinking, cancelLinkCreation]);

  const handleBackgroundContextMenu = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isLinking) {
      return;
    }

    const container = containerRef.current;
    const rect = container ? container.getBoundingClientRect() : null;

    const x = rect ? event.clientX - rect.left : event.clientX;
    const y = rect ? event.clientY - rect.top : event.clientY;

    const sceneX = (x - viewTransform.x) / viewTransform.k;
    const sceneY = (y - viewTransform.y) / viewTransform.k;

    setContextMenuState({
      open: true,
      x,
      y,
      nodeId: null,
      nodeType: 'background',
      sceneX,
      sceneY,
    });
  }, [containerRef, isLinking, viewTransform.x, viewTransform.y, viewTransform.k]);

  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    event.stopPropagation();

    if (isLinking) {
      return;
    }

    if (!node || isDraggingNode || draggedNodeId) {
      return;
    }

    const datum = getNodeDatum(node);
    if (!datum?.id) {
      return;
    }

    const container = containerRef.current;
    const rect = container ? container.getBoundingClientRect() : null;
    const x = rect ? event.clientX - rect.left : event.clientX;
    const y = rect ? event.clientY - rect.top : event.clientY;

    setContextMenuState({
      open: true,
      x,
      y,
      nodeId: datum.id,
      nodeType: datum.nodeType || 'node',
      sceneX: 0,
      sceneY: 0,
    });
  }, [containerRef, draggedNodeId, isDraggingNode, isLinking]);

  const handleMenuAddConnection = useCallback(() => {
    const sourceId = contextMenuState.nodeId;
    if (!sourceId || typeof onLinkCreate !== 'function') {
      resetContextMenu();
      return;
    }

    resetContextMenu();
    setLinkCreationState({ active: true, sourceId });
    pendingCenterNodeIdRef.current = sourceId;
  }, [contextMenuState.nodeId, onLinkCreate, pendingCenterNodeIdRef, resetContextMenu]);

  const handleMenuAddRoot = useCallback(() => {
    if (typeof onRootCreate !== 'function') {
      resetContextMenu();
      return;
    }

    const { sceneX = 0, sceneY = 0 } = contextMenuState;

    resetContextMenu();
    cancelLinkCreation();

    const result = onRootCreate({ position: { x: sceneX, y: sceneY } });

    Promise.resolve(result)
      .then((newNodeId) => {
        if (!newNodeId) {
          return;
        }
        pendingCenterNodeIdRef.current = newNodeId;
        setSelectedNodeId(newNodeId);
        if (typeof onNodeClick === 'function') {
          onNodeClick({ id: newNodeId });
        }
      })
      .catch(() => {});
  }, [cancelLinkCreation, contextMenuState, onNodeClick, onRootCreate, pendingCenterNodeIdRef, setSelectedNodeId]);

  const handleMenuAddMemo = useCallback(() => {
    if (!contextMenuState.nodeId || typeof onMemoCreate !== 'function') {
      resetContextMenu();
      return;
    }

    const maybeId = onMemoCreate(contextMenuState.nodeId);
    resetContextMenu();

    Promise.resolve(maybeId)
      .then((newMemoId) => {
        if (!newMemoId) {
          return;
        }
        setSelectedNodeId(newMemoId);
        shouldOpenNodeRef.current = false;
      })
      .catch(() => {});
  }, [contextMenuState.nodeId, onMemoCreate, setSelectedNodeId, shouldOpenNodeRef]);

  const handleMenuRemoveNode = useCallback(() => {
    if (contextMenuState.nodeId && typeof onNodeRemove === 'function') {
      if (selectedNodeId === contextMenuState.nodeId) {
        setSelectedNodeId(null);
      }
      onNodeRemove(contextMenuState.nodeId);
    }

    resetContextMenu();
    cancelLinkCreation();
  }, [cancelLinkCreation, contextMenuState.nodeId, onNodeRemove, selectedNodeId, setSelectedNodeId, resetContextMenu]);

  const handleSizeSliderChange = useCallback((event) => {
    const newValue = Math.max(5, parseInt(event.target.value, 10));
    const currentNodeId = contextMenuState.nodeId;
    if (!currentNodeId) return;

    const scaleValue = Math.max(0.1, newValue / 50);

    setSimulatedNodes((prev) => prev.map((node) => {
      const nodeDatum = getNodeDatum(node);
      if (nodeDatum?.id === currentNodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            data: {
              ...node.data?.data,
              sizeValue: newValue,
              sizeScale: scaleValue,
            },
          },
        };
      }
      return node;
    }));
  }, [contextMenuState.nodeId, setSimulatedNodes]);

  const handleSizeSliderComplete = useCallback(() => {
    const currentNodeId = contextMenuState.nodeId;
    if (!onNodeUpdate || !currentNodeId) {
      return;
    }

    const targetNode = simulatedNodes.find((node) => getNodeId(node) === currentNodeId);
    const currentSizeValue = targetNode ? (getNodeDatum(targetNode)?.sizeValue || 50) : 50;

    onNodeUpdate(currentNodeId, {
      sizeValue: currentSizeValue,
      sizeScale: Math.max(0.1, currentSizeValue / 50),
    });
  }, [contextMenuState.nodeId, onNodeUpdate, simulatedNodes]);

  const handleNodeShapeChange = useCallback((shape) => {
    const currentNodeId = contextMenuState.nodeId;
    if (!currentNodeId) return;

    setSimulatedNodes((prev) => prev.map((node) => {
      const nodeDatum = getNodeDatum(node);
      if (nodeDatum?.id === currentNodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            data: {
              ...node.data?.data,
              nodeShape: shape,
            },
          },
        };
      }
      return node;
    }));

    if (typeof onNodeUpdate === 'function') {
      onNodeUpdate(currentNodeId, { nodeShape: shape });
    }
  }, [contextMenuState.nodeId, onNodeUpdate, setSimulatedNodes]);

  const handleBackgroundClick = useCallback(() => {
    if (isLinking) {
      cancelLinkCreation();
      return;
    }

    if (selectionBoxDidDragRef.current) {
      selectionBoxDidDragRef.current = false;
      return;
    }

    if (nodeSizeState.isOpen) {
      setNodeSizeState({ ...DEFAULT_NODE_SIZE_STATE });
      return;
    }

    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setHoveredNodeId(null);
  }, [
    cancelLinkCreation,
    isLinking,
    nodeSizeState.isOpen,
    selectionBoxDidDragRef,
    setHoveredNodeId,
    setSelectedNodeId,
    setSelectedNodeIds,
  ]);

  const contextMenuCoordinates = useMemo(() => {
    if (!contextMenuState.open) {
      return null;
    }

    const maxX = Math.max(0, (dimensions?.width || 0) - 176);
    const maxY = Math.max(0, (dimensions?.height || 0) - 96);

    return {
      x: Math.min(Math.max(contextMenuState.x, 0), maxX),
      y: Math.min(Math.max(contextMenuState.y, 0), maxY),
    };
  }, [contextMenuState, dimensions?.height, dimensions?.width]);

  const isMemoContextTarget = contextMenuState.nodeType === 'memo';
  const canAddLink = typeof onLinkCreate === 'function';
  const canAddMemo = typeof onMemoCreate === 'function' && !isMemoContextTarget;
  const isBackgroundContext = !contextMenuState.nodeId;

  return {
    contextMenuState,
    nodeSizeState,
    setNodeSizeState,
    isLinking,
    linkingSourceId,
    resetContextMenu,
    cancelLinkCreation,
    handleBackgroundContextMenu,
    handleNodeContextMenu,
    handleMenuAddConnection,
    handleMenuAddRoot,
    handleMenuAddMemo,
    handleMenuRemoveNode,
    handleSizeSliderChange,
    handleSizeSliderComplete,
    handleNodeShapeChange,
    handleBackgroundClick,
    contextMenuCoordinates,
    canAddLink,
    canAddMemo,
    isBackgroundContext,
  };
};

export default useForceTreeContextMenu;
