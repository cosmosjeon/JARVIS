import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toggleWindowMousePassthrough } from './hierarchicalTreeHelpers';

const useHierarchicalTreeInteractions = ({
  dataApi,
  hierarchicalLinks,
  childrenByParent,
  getRootNodeId,
}) => {
  const {
    data,
    setConversationForNode,
    removeNodeAndDescendants,
    handlePlaceholderCreate,
    handleManualRootCreate,
  } = dataApi;

  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  const pendingFocusNodeIdRef = useRef(null);
  const expandTimeoutRef = useRef(null);
  const outsidePointerRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const isIgnoringMouseRef = useRef(false);

  const selectNode = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
  }, []);

  const clearPendingExpansion = useCallback(() => {
    pendingFocusNodeIdRef.current = null;
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
  }, []);

  const collapseAssistantPanel = useCallback(() => {
    clearPendingExpansion();
    setExpandedNodeId(null);
  }, [clearPendingExpansion]);

  const expandNode = useCallback((nodeId) => {
    clearPendingExpansion();
    setExpandedNodeId(nodeId);
  }, [clearPendingExpansion]);

  const toggleCollapse = useCallback((nodeId) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const visibleGraph = useMemo(() => {
    const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);
    const rootId = getRootNodeId();
    if (!rootId) {
      const safeNodes = Array.isArray(data.nodes) ? data.nodes.slice() : [];
      const safeLinks = Array.isArray(hierarchicalLinks) ? hierarchicalLinks.slice() : [];
      return {
        nodes: safeNodes,
        links: safeLinks,
        visibleSet: new Set(safeNodes.map((node) => node.id)),
      };
    }

    const visible = new Set();
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (visible.has(current)) continue;
      visible.add(current);
      if (collapsedNodeIds.has(current)) continue;
      const children = childrenByParent.get(current) || [];
      children.forEach((child) => stack.push(child));
    }

    const filteredNodes = data.nodes.filter((node) => visible.has(node.id));
    const filteredLinks = hierarchicalLinks.filter((link) => {
      const s = normalizeId(link.source);
      const t = normalizeId(link.target);
      return visible.has(s) && visible.has(t) && !collapsedNodeIds.has(s);
    });

    return { nodes: filteredNodes, links: filteredLinks, visibleSet: visible };
  }, [childrenByParent, collapsedNodeIds, data.nodes, getRootNodeId, hierarchicalLinks]);

  const handleConversationChange = useCallback((nodeId, messages) => {
    setConversationForNode(nodeId, messages);
  }, [setConversationForNode]);

  const handleCloseNode = useCallback((nodeId) => {
    if (expandedNodeId === nodeId) {
      collapseAssistantPanel();
    }
  }, [collapseAssistantPanel, expandedNodeId]);

  const handleNodeFocusRequest = useCallback((targetId, focusCallback) => {
    if (!targetId) {
      return;
    }

    pendingFocusNodeIdRef.current = targetId;
    selectNode(targetId);

    setExpandedNodeId((current) => {
      if (current && current !== targetId) {
        return null;
      }
      return current;
    });

    Promise.resolve(focusCallback())
      .catch(() => undefined)
      .then(() => {
        if (pendingFocusNodeIdRef.current !== targetId) {
          return;
        }

        if (expandTimeoutRef.current) {
          clearTimeout(expandTimeoutRef.current);
          expandTimeoutRef.current = null;
        }

        if (typeof window === 'undefined') {
          setExpandedNodeId(targetId);
          pendingFocusNodeIdRef.current = null;
          return;
        }

        expandTimeoutRef.current = window.setTimeout(() => {
          if (pendingFocusNodeIdRef.current === targetId) {
            setExpandedNodeId(targetId);
          }
          expandTimeoutRef.current = null;
          if (pendingFocusNodeIdRef.current === targetId) {
            pendingFocusNodeIdRef.current = null;
          }
        }, 140);
      });
  }, [selectNode]);

  const setWindowMousePassthrough = useCallback((shouldIgnore = true) => {
    toggleWindowMousePassthrough(shouldIgnore, isIgnoringMouseRef);
  }, []);

  useEffect(() => {
    if (!expandedNodeId) {
      outsidePointerRef.current = {
        active: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        moved: false,
      };
      return undefined;
    }

    if (typeof document === 'undefined') {
      return undefined;
    }

    const pointerState = outsidePointerRef.current;

    const resetState = () => {
      pointerState.active = false;
      pointerState.pointerId = null;
      pointerState.startX = 0;
      pointerState.startY = 0;
      pointerState.moved = false;
    };

    const handlePointerDown = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-interactive-zone="true"]')) {
        resetState();
        return;
      }
      if (target instanceof Element && target.closest('[data-node-id]')) {
        resetState();
        return;
      }

      pointerState.active = true;
      pointerState.pointerId = typeof event.pointerId === 'number' ? event.pointerId : null;
      pointerState.startX = typeof event.clientX === 'number' ? event.clientX : 0;
      pointerState.startY = typeof event.clientY === 'number' ? event.clientY : 0;
      pointerState.moved = false;
    };

    const handlePointerMove = (event) => {
      if (!pointerState.active) return;
      if (pointerState.pointerId !== null && event.pointerId !== pointerState.pointerId) return;

      const deltaX = Math.abs((typeof event.clientX === 'number' ? event.clientX : 0) - pointerState.startX);
      const deltaY = Math.abs((typeof event.clientY === 'number' ? event.clientY : 0) - pointerState.startY);
      if (deltaX > 6 || deltaY > 6) {
        pointerState.moved = true;
      }
    };

    const finalizePointer = (event) => {
      if (!pointerState.active) return;
      if (pointerState.pointerId !== null && event.pointerId !== pointerState.pointerId) {
        resetState();
        return;
      }

      const shouldClose = pointerState.moved === false;
      resetState();

      if (shouldClose) {
        collapseAssistantPanel();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', finalizePointer, true);
    document.addEventListener('pointercancel', finalizePointer, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', finalizePointer, true);
      document.removeEventListener('pointercancel', finalizePointer, true);
      resetState();
    };
  }, [collapseAssistantPanel, expandedNodeId]);

  useEffect(() => () => {
    clearPendingExpansion();
    outsidePointerRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      moved: false,
    };
  }, [clearPendingExpansion]);

  useEffect(() => {
    const hasNodes = Array.isArray(data.nodes) && data.nodes.length > 0;
    if (!hasNodes) {
      selectNode(null);
      setExpandedNodeId(null);
    }
  }, [data.nodes, selectNode]);

  const handlePlaceholderCreateWithFocus = useCallback((parentNodeId, keywords) => {
    const createdIds = handlePlaceholderCreate(parentNodeId, keywords);
    if (createdIds.length) {
      selectNode(parentNodeId);
      expandNode(parentNodeId);
    }
    return createdIds;
  }, [expandNode, handlePlaceholderCreate, selectNode]);

  const handleManualRootCreateWithFocus = useCallback((options = {}) => {
    const nodeId = handleManualRootCreate(options);
    if (nodeId) {
      selectNode(nodeId);
      setExpandedNodeId(null);
    }
    return nodeId;
  }, [handleManualRootCreate, selectNode]);

  const removeNodeAndDescendantsWithCleanup = useCallback((nodeId) => {
    const removed = removeNodeAndDescendants(nodeId);
    if (removed.has(selectedNodeId)) {
      selectNode(null);
    }
    if (removed.has(expandedNodeId)) {
      collapseAssistantPanel();
    }
    return removed;
  }, [collapseAssistantPanel, expandedNodeId, removeNodeAndDescendants, selectNode, selectedNodeId]);

  return {
    expandedNodeId,
    selectedNodeId,
    collapsedNodeIds,
    visibleGraph,
    selectNode,
    expandNode,
    collapseAssistantPanel,
    toggleCollapse,
    handleConversationChange,
    handleCloseNode,
    handleNodeFocusRequest,
    handlePlaceholderCreate: handlePlaceholderCreateWithFocus,
    handleManualRootCreate: handleManualRootCreateWithFocus,
    removeNodeAndDescendants: removeNodeAndDescendantsWithCleanup,
    setWindowMousePassthrough,
  };
};

export default useHierarchicalTreeInteractions;
