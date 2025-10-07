import { useCallback, useEffect, useRef } from 'react';
import { sanitizeConversationMessages } from 'features/tree/utils/conversation';

const getNormalizedId = (value) => (
  typeof value === 'object' && value !== null ? value.id : value
);

const useTreeDataController = ({
  user,
  baseTreeData,
  loadTrees,
  loadTree,
  hydrateFromNodes,
  clearConversationStore,
  setData,
  setActiveTreeId,
  writeSessionTreeId,
  readSessionTreeId,
  setTreeSyncError,
  setInitializingTree,
  treeBridge,
  sessionInfo,
  createClientGeneratedId,
  treeLibrarySyncRef,
  saveTreeMetadata,
}) => {
  const requestedTreeIdRef = useRef(sessionInfo?.initialTreeId || null);
  const hasResolvedInitialTreeRef = useRef(false);

  const resetToEmptyTree = useCallback(() => {
    clearConversationStore();
    setActiveTreeId(null);
    loadTree({ nodes: [], links: [] });
    setData(baseTreeData);
    writeSessionTreeId(null);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('jarvis.activeTreeId');
      } catch (error) {
        // ignore storage errors
      }
    }
  }, [baseTreeData, clearConversationStore, loadTree, setActiveTreeId, setData, writeSessionTreeId]);

  const loadActiveTree = useCallback(async ({ treeId: explicitTreeId } = {}) => {
    if (!user) {
      resetToEmptyTree();
      setInitializingTree(false);
      requestedTreeIdRef.current = null;
      return;
    }

    setInitializingTree(true);
    setTreeSyncError(null);

    const resolvedTreeId = typeof explicitTreeId === 'string' && explicitTreeId.trim()
      ? explicitTreeId.trim()
      : (requestedTreeIdRef.current || readSessionTreeId());

    if (!resolvedTreeId) {
      resetToEmptyTree();
      requestedTreeIdRef.current = null;
      setInitializingTree(false);
      return;
    }

    try {
      const trees = await loadTrees();
      const targetTree = Array.isArray(trees)
        ? trees.find((tree) => tree.id === resolvedTreeId)
        : undefined;

      if (targetTree) {
        const rawNodes = Array.isArray(targetTree.treeData?.nodes)
          ? targetTree.treeData.nodes
          : [];
        const mappedNodes = rawNodes.map((node) => ({
          ...node,
          conversation: sanitizeConversationMessages(node.conversation),
        }));

        hydrateFromNodes(mappedNodes);
        loadTree({
          nodes: mappedNodes,
          links: Array.isArray(targetTree.treeData?.links)
            ? targetTree.treeData.links
            : [],
        });

        treeLibrarySyncRef.current?.set(targetTree.id, {
          lastCount: mappedNodes.length,
          refreshed: mappedNodes.length > 0,
        });

        setActiveTreeId(targetTree.id);
        writeSessionTreeId(targetTree.id);

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('jarvis.activeTreeId', targetTree.id);
          } catch (error) {
            // ignore storage errors
          }
        }
      } else {
        resetToEmptyTree();
        if (resolvedTreeId) {
          treeLibrarySyncRef.current?.delete(resolvedTreeId);
        }
      }
    } catch (error) {
      setTreeSyncError(error);
    } finally {
      requestedTreeIdRef.current = null;
      setInitializingTree(false);
    }
  }, [
    user,
    loadTrees,
    hydrateFromNodes,
    loadTree,
    resetToEmptyTree,
    setActiveTreeId,
    writeSessionTreeId,
    setTreeSyncError,
    setInitializingTree,
    readSessionTreeId,
    treeLibrarySyncRef,
  ]);

  useEffect(() => {
    if (!user || hasResolvedInitialTreeRef.current) {
      return undefined;
    }

    let cancelled = false;

    const resolveInitialTree = async () => {
      if (hasResolvedInitialTreeRef.current || cancelled) {
        return;
      }

      const initialTreeId = sessionInfo?.initialTreeId || readSessionTreeId();
      if (initialTreeId) {
        hasResolvedInitialTreeRef.current = true;
        requestedTreeIdRef.current = initialTreeId;
        await loadActiveTree({ treeId: initialTreeId });
        return;
      }

      try {
        const existingTrees = await loadTrees();
        const hasTrees = Array.isArray(existingTrees) && existingTrees.length > 0;
        const shouldCreateNewTree = sessionInfo?.fresh || !hasTrees;

        if (!shouldCreateNewTree && hasTrees) {
          const [mostRecent] = existingTrees;
          const normalizedId = getNormalizedId(mostRecent?.id);
          if (normalizedId) {
            writeSessionTreeId(normalizedId);
            if (typeof window !== 'undefined') {
              try {
                window.localStorage.setItem('jarvis.activeTreeId', normalizedId);
              } catch (error) {
                // ignore storage errors
              }
            }
            requestedTreeIdRef.current = normalizedId;
            hasResolvedInitialTreeRef.current = true;
            await loadActiveTree({ treeId: normalizedId });
          }
          return;
        }

        const freshTreeId = createClientGeneratedId('tree');
        if (typeof saveTreeMetadata === 'function') {
          await saveTreeMetadata({
            treeId: freshTreeId,
            title: '새 지식 트리',
          });
        }
        writeSessionTreeId(freshTreeId);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('jarvis.activeTreeId', freshTreeId);
          } catch (error) {
            // ignore storage errors
          }
        }
        requestedTreeIdRef.current = freshTreeId;
        hasResolvedInitialTreeRef.current = true;
        await loadActiveTree({ treeId: freshTreeId });
      } catch (error) {
        setTreeSyncError(error);
        setInitializingTree(false);
        hasResolvedInitialTreeRef.current = true;
      }
    };

    resolveInitialTree();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    sessionInfo?.initialTreeId,
    sessionInfo?.fresh,
    loadTrees,
    readSessionTreeId,
    writeSessionTreeId,
    loadActiveTree,
    createClientGeneratedId,
    setTreeSyncError,
    setInitializingTree,
  ]);

  useEffect(() => {
    if (!treeBridge?.onSetActiveTree) {
      return undefined;
    }

    const unsubscribe = treeBridge.onSetActiveTree((payload) => {
      const nextTreeId = getNormalizedId(payload?.treeId);
      if (!nextTreeId) {
        return;
      }
      requestedTreeIdRef.current = nextTreeId;
      loadActiveTree({ treeId: nextTreeId });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadActiveTree, treeBridge]);

  return {
    loadActiveTree,
    requestedTreeIdRef,
  };
};

export default useTreeDataController;
