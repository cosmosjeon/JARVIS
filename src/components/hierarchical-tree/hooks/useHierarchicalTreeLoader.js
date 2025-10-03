import { useCallback, useEffect, useRef, useState } from 'react';
import { treeData } from '../../../data/treeData';
import {
  fetchTreesWithNodes,
  upsertTreeMetadata,
  sanitizeConversationMessages,
} from '../../../services/supabaseTrees';

const useHierarchicalTreeLoader = ({
  user,
  session,
  hydrateConversationStore,
  setData,
  createClientGeneratedId,
}) => {
  const {
    sessionInfo,
    requestedTreeIdRef,
    hasResolvedInitialTreeRef,
    readSessionTreeId,
    writeSessionTreeId,
  } = session;

  const [activeTreeId, setActiveTreeId] = useState(null);
  const [initializingTree, setInitializingTree] = useState(false);
  const [treeSyncError, setTreeSyncError] = useState(null);
  const treeLibrarySyncRef = useRef(new Map());

  const loadActiveTree = useCallback(async ({ treeId: explicitTreeId } = {}) => {
    if (!user) {
      setActiveTreeId(null);
      hydrateConversationStore([]);
      setData(treeData);
      setInitializingTree(false);
      return;
    }

    setInitializingTree(true);
    setTreeSyncError(null);

    const resolvedTreeId = typeof explicitTreeId === 'string' && explicitTreeId.trim()
      ? explicitTreeId.trim()
      : (requestedTreeIdRef.current || readSessionTreeId());

    if (!resolvedTreeId) {
      hydrateConversationStore([]);
      setActiveTreeId(null);
      setData({ nodes: [], links: [] });
      writeSessionTreeId(null);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('jarvis.activeTreeId');
        } catch (error) {
          // ignore storage errors
        }
      }
      setInitializingTree(false);
      requestedTreeIdRef.current = null;
      return;
    }

    try {
      const trees = await fetchTreesWithNodes(user.id);
      const targetTree = trees.find((tree) => tree.id === resolvedTreeId);

      if (targetTree) {
        const mappedNodes = Array.isArray(targetTree.treeData?.nodes)
          ? targetTree.treeData.nodes.map((node) => ({
            ...node,
            conversation: sanitizeConversationMessages(node.conversation),
          }))
          : [];

        hydrateConversationStore(mappedNodes);
        setData({
          nodes: mappedNodes,
          links: Array.isArray(targetTree.treeData?.links) ? targetTree.treeData.links : [],
        });
        treeLibrarySyncRef.current.set(targetTree.id, {
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
        hydrateConversationStore([]);
        setActiveTreeId(null);
        setData({ nodes: [], links: [] });
        writeSessionTreeId(null);
        if (resolvedTreeId) {
          treeLibrarySyncRef.current.delete(resolvedTreeId);
        }
      }
    } catch (error) {
      setTreeSyncError(error);
    } finally {
      requestedTreeIdRef.current = null;
      setInitializingTree(false);
    }
  }, [hydrateConversationStore, readSessionTreeId, requestedTreeIdRef, setData, user, writeSessionTreeId]);

  useEffect(() => {
    if (!user || hasResolvedInitialTreeRef.current) {
      return undefined;
    }

    let cancelled = false;

    const resolveInitialTree = async () => {
      if (hasResolvedInitialTreeRef.current || cancelled) {
        return;
      }

      const initialTreeId = sessionInfo.initialTreeId || readSessionTreeId();
      if (initialTreeId) {
        hasResolvedInitialTreeRef.current = true;
        await loadActiveTree({ treeId: initialTreeId });
        return;
      }

      try {
        const existingTrees = await fetchTreesWithNodes(user.id);
        const shouldCreateNewTree = sessionInfo.fresh || !Array.isArray(existingTrees) || existingTrees.length === 0;

        if (!shouldCreateNewTree && Array.isArray(existingTrees) && existingTrees.length > 0) {
          const [mostRecent] = existingTrees;
          writeSessionTreeId(mostRecent.id);
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem('jarvis.activeTreeId', mostRecent.id);
            } catch (error) {
              // ignore storage errors
            }
          }

          requestedTreeIdRef.current = mostRecent.id;
          hasResolvedInitialTreeRef.current = true;
          await loadActiveTree({ treeId: mostRecent.id });
          return;
        }

        const freshTreeId = createClientGeneratedId('tree');
        await upsertTreeMetadata({
          treeId: freshTreeId,
          title: '새 지식 트리',
          userId: user.id,
        });

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
  }, [createClientGeneratedId, hasResolvedInitialTreeRef, loadActiveTree, readSessionTreeId, requestedTreeIdRef, sessionInfo.initialTreeId, sessionInfo.fresh, user, writeSessionTreeId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleFocus = () => {
      if (!user) return;
      const sessionTree = readSessionTreeId();
      const normalized = sessionTree || null;
      if (normalized !== activeTreeId) {
        loadActiveTree({ treeId: normalized || undefined });
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeTreeId, loadActiveTree, readSessionTreeId, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.jarvisAPI?.onWidgetSetActiveTree !== 'function') {
      return undefined;
    }

    const unsubscribe = window.jarvisAPI.onWidgetSetActiveTree((payload) => {
      if (payload && typeof payload.treeId === 'string') {
        requestedTreeIdRef.current = payload.treeId;
        loadActiveTree({ treeId: payload.treeId });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadActiveTree, requestedTreeIdRef]);

  return {
    activeTreeId,
    setActiveTreeId,
    initializingTree,
    setInitializingTree,
    treeSyncError,
    setTreeSyncError,
    loadActiveTree,
    treeLibrarySyncRef,
  };
};

export default useHierarchicalTreeLoader;
