import { useCallback, useEffect, useRef, useState } from 'react';
import { saveTreeViewportState, loadTreeViewportState } from '../../services/supabaseTrees';

const buildNodePositionMap = (simulatedNodes, previousPositionsRef, getNodeDatum) => {
  const nodePositions = {};

  simulatedNodes.forEach((node) => {
    const datum = getNodeDatum(node);
    const nodeId = datum?.id || node.id;
    if (nodeId && Number.isFinite(node.x) && Number.isFinite(node.y)) {
      nodePositions[nodeId] = {
        x: node.x,
        y: node.y,
      };
    }
  });

  if (Object.keys(nodePositions).length === 0 && previousPositionsRef.current.size > 0) {
    previousPositionsRef.current.forEach((position, nodeId) => {
      if (Number.isFinite(position.x) && Number.isFinite(position.y)) {
        nodePositions[nodeId] = {
          x: position.x,
          y: position.y,
        };
      }
    });
  }

  return nodePositions;
};

const useTreeViewportPersistence = ({
  treeId,
  userId,
  simulatedNodes,
  previousPositionsRef,
  getNodeDatum,
}) => {
  const [viewportStateLoaded, setViewportStateLoaded] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());
  const saveTimeoutRef = useRef(null);

  const clearPendingViewportSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const saveViewportState = useCallback(() => {
    if (!treeId || !userId || !viewportStateLoaded) {
      return saveQueueRef.current;
    }

    const nodePositions = buildNodePositionMap(simulatedNodes, previousPositionsRef, getNodeDatum);

    const viewportData = { nodePositions };

    const enqueue = async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[tree][viewport:save]', {
            treeId,
            userId,
            nodeCount: Object.keys(nodePositions).length,
          });
        }

        await saveTreeViewportState({
          treeId,
          userId,
          viewportData,
        });

        if (process.env.NODE_ENV === 'development') {
          console.debug('[tree][viewport] save complete', {
            treeId,
            userId,
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[tree][viewport] save failed', error);
        } else {
          console.warn('[tree][viewport] save failed');
        }
      }
    };

    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(enqueue);

    return saveQueueRef.current;
  }, [treeId, userId, viewportStateLoaded, simulatedNodes, previousPositionsRef, getNodeDatum]);

  const debouncedSaveViewportState = useCallback(() => {
    clearPendingViewportSave();
    saveTimeoutRef.current = setTimeout(() => {
      saveViewportState();
    }, 1000);
  }, [saveViewportState, clearPendingViewportSave]);

  const loadViewportState = useCallback(async () => {
    if (!treeId || !userId || viewportStateLoaded) {
      return;
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[tree][viewport:load] start', { treeId, userId });
      }
      const savedState = await loadTreeViewportState({ treeId, userId });

      if (savedState) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[tree][viewport:load] payload', savedState);
        }

        if (savedState.nodePositions) {
          const nodePositionsMap = new Map(Object.entries(savedState.nodePositions));
          previousPositionsRef.current = nodePositionsMap;
          if (process.env.NODE_ENV === 'development') {
            console.debug('[tree][viewport:load] restored nodes', nodePositionsMap.size);
            console.debug('[tree][viewport:load] positions', Object.fromEntries(nodePositionsMap));
          }
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.debug('[tree][viewport:load] no saved state');
      }
      setViewportStateLoaded(true);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[tree][viewport:load] failed', error);
      } else {
        console.warn('[tree][viewport:load] failed');
      }
      setViewportStateLoaded(true);
    }
  }, [treeId, userId, viewportStateLoaded, previousPositionsRef]);

  useEffect(() => () => {
    clearPendingViewportSave();
  }, [clearPendingViewportSave]);

  return {
    viewportStateLoaded,
    setViewportStateLoaded,
    saveViewportState,
    debouncedSaveViewportState,
    loadViewportState,
    clearPendingViewportSave,
  };
};

export default useTreeViewportPersistence;
