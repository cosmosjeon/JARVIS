import { useCallback, useEffect, useRef, useState } from 'react';
import {
  upsertTreeMetadata,
  upsertTreeNodes,
  sanitizeConversationMessages,
  buildFallbackConversation,
} from '../../../services/supabaseTrees';
import { stopTrackingEmptyTree, isTrackingEmptyTree, cleanupEmptyTrees } from '../../../services/treeCreation';

const useHierarchicalTreeSync = ({
  user,
  session,
  baseState,
  graphState,
  loaderState,
}) => {
  const {
    data,
    setData,
    dataRef,
    conversationStoreRef,
  } = baseState;
  const {
    hierarchicalLinks,
    getRootNodeId,
  } = graphState;
  const {
    activeTreeId,
    setActiveTreeId,
    initializingTree,
    setTreeSyncError,
  } = loaderState;
  const {
    requestedTreeIdRef,
    writeSessionTreeId,
  } = session;

  const [isTreeSyncing, setIsTreeSyncing] = useState(false);
  const [linkValidationError, setLinkValidationError] = useState(null);

  const pendingTreeIdRef = useRef(null);
  const linkValidationTimeoutRef = useRef(null);
  const treeSyncDebounceRef = useRef(null);

  useEffect(() => () => {
    if (linkValidationTimeoutRef.current) {
      const clear = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;
      clear(linkValidationTimeoutRef.current);
      linkValidationTimeoutRef.current = null;
    }
  }, []);

  const showLinkValidationMessage = useCallback((message) => {
    setLinkValidationError(message);
    if (linkValidationTimeoutRef.current) {
      const clear = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout;
      clear(linkValidationTimeoutRef.current);
    }
    const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
    linkValidationTimeoutRef.current = schedule(() => {
      setLinkValidationError(null);
      linkValidationTimeoutRef.current = null;
    }, 2600);
  }, []);

  const persistTreeData = useCallback(async () => {
    if (!user || initializingTree) {
      return;
    }

    if (!data?.nodes?.length) {
      return;
    }

    setIsTreeSyncing(true);
    setTreeSyncError(null);

    try {
      const parentByChild = new Map();
      hierarchicalLinks.forEach((link) => {
        const sourceId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
        if (sourceId && targetId) {
          parentByChild.set(targetId, sourceId);
        }
      });

      const normalizedNodes = data.nodes.map((node) => {
        const parentId = parentByChild.get(node.id) || null;
        const createdAt = node.createdAt || Date.now();
        const baseQuestion = typeof node.question === 'string' && node.question.trim()
          ? node.question.trim()
          : (node.questionData?.question || null);
        const baseAnswer = typeof node.answer === 'string' && node.answer.trim()
          ? node.answer.trim()
          : node.questionData?.answer || node.fullText || null;
        const isMemoNode = node.nodeType === 'memo';
        const normalizedConversation = isMemoNode
          ? []
          : sanitizeConversationMessages(conversationStoreRef.current.get(node.id));
        const conversation = isMemoNode
          ? []
          : (normalizedConversation.length
            ? normalizedConversation
            : buildFallbackConversation(baseQuestion, baseAnswer));
        const memoPayload = isMemoNode
          ? {
            title: node.memo?.title || node.keyword || '',
            content: node.memo?.content || node.fullText || '',
            metadata: node.memo?.metadata || node.memoMetadata || null,
          }
          : null;

        return {
          id: node.id,
          keyword: node.keyword || null,
          fullText: node.fullText || '',
          question: baseQuestion,
          answer: baseAnswer,
          status: node.status || 'answered',
          createdAt,
          updatedAt: Date.now(),
          parentId,
          conversation,
          questionData: node.questionData,
          nodeType: node.nodeType || null,
          memoParentId: node.memoParentId || null,
          memo: memoPayload,
          memoMetadata: memoPayload?.metadata || null,
        };
      });

      const rootNodeId = getRootNodeId();
      const rootNode = data.nodes.find((node) => node.id === rootNodeId) || data.nodes[0];
      const title = rootNode?.keyword
        || rootNode?.questionData?.question
        || '새 지식 트리';

      let workingTreeId = activeTreeId || pendingTreeIdRef.current;
      if (!workingTreeId) {
        const timestamp = Date.now();
        const randomPart = Math.random().toString(16).slice(2, 10);
        workingTreeId = `tree_${timestamp}_${randomPart}`;
        pendingTreeIdRef.current = workingTreeId;
      }

      const treeRecord = await upsertTreeMetadata({
        treeId: workingTreeId,
        title,
        userId: user.id,
      });

      const resolvedTreeId = treeRecord?.id || workingTreeId;
      pendingTreeIdRef.current = resolvedTreeId;
      if (resolvedTreeId) {
        writeSessionTreeId(resolvedTreeId);
        requestedTreeIdRef.current = resolvedTreeId;
      }
      if (!activeTreeId && resolvedTreeId) {
        setActiveTreeId(resolvedTreeId);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('jarvis.activeTreeId', resolvedTreeId);
          } catch (error) {
            // ignore storage errors
          }
        }
      }

      if (resolvedTreeId) {
        await upsertTreeNodes({
          treeId: resolvedTreeId,
          nodes: normalizedNodes,
          userId: user.id,
        });

        const stateMap = loaderState.treeLibrarySyncRef.current;
        const existingState = stateMap.get(resolvedTreeId) || { lastCount: 0, refreshed: false };
        const previousCount = existingState.lastCount || 0;
        const alreadyRefreshed = existingState.refreshed === true;
        const nextCount = normalizedNodes.length;

        if (!alreadyRefreshed && previousCount === 0 && nextCount > 0 && typeof window !== 'undefined') {
          try {
            window.jarvisAPI?.requestLibraryRefresh?.();
          } catch (error) {
            // IPC failures are non-fatal for sync notifications
          }
          stateMap.set(resolvedTreeId, { lastCount: nextCount, refreshed: true });
        } else {
          stateMap.set(resolvedTreeId, {
            lastCount: nextCount,
            refreshed: alreadyRefreshed || nextCount > 0,
          });
        }

        if (isTrackingEmptyTree(resolvedTreeId)) {
          stopTrackingEmptyTree(resolvedTreeId);
          console.log(`트리에 내용이 추가되어 빈 트리 추적 중지: ${resolvedTreeId}`);
        }
      }
    } catch (error) {
      setTreeSyncError(error);
      if (!activeTreeId) {
        pendingTreeIdRef.current = null;
      }
    } finally {
      setIsTreeSyncing(false);
    }
  }, [activeTreeId, conversationStoreRef, data, getRootNodeId, hierarchicalLinks, initializingTree, requestedTreeIdRef, setActiveTreeId, setTreeSyncError, user, writeSessionTreeId]);

  useEffect(() => {
    if (!user || initializingTree) {
      return undefined;
    }

    if (!data?.nodes?.length) {
      return undefined;
    }

    if (treeSyncDebounceRef.current) {
      clearTimeout(treeSyncDebounceRef.current);
    }

    treeSyncDebounceRef.current = setTimeout(() => {
      persistTreeData();
    }, 800);

    return () => {
      if (treeSyncDebounceRef.current) {
        clearTimeout(treeSyncDebounceRef.current);
      }
    };
  }, [data, initializingTree, persistTreeData, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleBeforeUnload = async () => {
      try {
        const currentTree = {
          id: activeTreeId,
          treeData: data,
        };

        if (activeTreeId && data && data.nodes && data.nodes.length === 0) {
          await cleanupEmptyTrees([currentTree]);
        }
      } catch (error) {
        console.error('빈 트리 정리 중 오류:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeTreeId, data]);

  return {
    isTreeSyncing,
    setIsTreeSyncing,
    linkValidationError,
    setLinkValidationError,
    showLinkValidationMessage,
    persistTreeData,
  };
};

export default useHierarchicalTreeSync;
