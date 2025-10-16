import { useCallback, useEffect, useRef } from 'react';
import {
  getTreeTitlePreference,
  markTreeTitleAuto,
  markTreeTitleManual,
} from 'features/tree/utils/treeTitlePreferences';

const TREE_SAVE_DEBOUNCE_MS = 800;

const sanitizeTitle = (value) => (typeof value === 'string' ? value.trim() : '');

const sanitizeTreeState = (value = {}) => ({
  nodes: Array.isArray(value?.nodes) ? value.nodes : [],
  links: Array.isArray(value?.links) ? value.links : [],
});

const mapError = (error) => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : '트리를 저장하지 못했습니다.');
};

export const useTreePersistence = ({
  user,
  data,
  hierarchicalLinks,
  getRootNodeId,
  normalizeLinkEndpoint,
  activeTreeId,
  setActiveTreeId,
  writeSessionTreeId,
  saveTreeMetadata,
  saveTreeNodes,
  treeBridge,
  requestedTreeIdRef,
  treeLibrarySyncRef,
  setTreeSyncError,
  setIsTreeSyncing,
  isTrackingEmptyTree,
  stopTrackingEmptyTree,
  cleanupEmptyTrees,
  initializingTree,
}) => {
  const pendingTreeIdRef = useRef(null);
  const debounceRef = useRef(null);

  const persistTreeDataRef = useRef(() => Promise.resolve());

  const persistTreeData = useCallback(async ({ force = false, snapshot } = {}) => {
    const targetState = sanitizeTreeState(snapshot ?? data);

    if (!user) {
      return;
    }

    if (!force && (initializingTree || targetState.nodes.length === 0)) {
      return;
    }

    if (targetState.nodes.length === 0) {
      return;
    }

    setIsTreeSyncing(true);
    setTreeSyncError(null);

    try {
      const snapshotLinks = Array.isArray(snapshot?.links) ? snapshot.links : null;
      const effectiveHierarchicalLinks = Array.isArray(snapshotLinks)
        ? snapshotLinks
        : (Array.isArray(hierarchicalLinks) ? hierarchicalLinks : []);

      const normalizedNodes = targetState.nodes.map((node) => {
        const parentId = (() => {
          const explicitParent = node.parentId ?? node.parent_id ?? null;
          if (explicitParent) {
            return normalizeLinkEndpoint(explicitParent);
          }

          if (!Array.isArray(effectiveHierarchicalLinks)) {
            return null;
          }

          const parentLink = effectiveHierarchicalLinks.find((link) => normalizeLinkEndpoint(link.target) === node.id);
          return parentLink ? normalizeLinkEndpoint(parentLink.source) : null;
        })();

        const baseQuestion = node.question || node.questionText || node.prompt || null;
        const baseAnswer = node.answer || node.answerText || node.response || null;

        const conversation = Array.isArray(node.conversation)
          ? node.conversation.map((entry) => ({
            role: entry.role,
            content: entry.content,
            createdAt: entry.createdAt,
            id: entry.id,
          }))
          : [];

        const createdAt = node.createdAt || Date.now();

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
          nodeType: 'question',
        };
      });

      const rootNodeId = getRootNodeId();
      const rootNode = targetState.nodes.find((node) => node.id === rootNodeId) || targetState.nodes[0];
      const rootTitleCandidate = sanitizeTitle(rootNode?.keyword)
        || sanitizeTitle(rootNode?.questionData?.question)
        || '새 지식 트리';

      let workingTreeId = activeTreeId || pendingTreeIdRef.current;
      if (!workingTreeId) {
        const timestamp = Date.now();
        const randomPart = Math.random().toString(16).slice(2, 10);
        workingTreeId = `tree_${timestamp}_${randomPart}`;
        pendingTreeIdRef.current = workingTreeId;
      }

      const preference = getTreeTitlePreference(workingTreeId);
      const manualPreferenceTitle = sanitizeTitle(preference.title);
      let manualOverrideActive = preference.manual === true
        && Boolean(manualPreferenceTitle)
        && manualPreferenceTitle !== rootTitleCandidate;

      const effectiveTitle = manualOverrideActive ? manualPreferenceTitle : rootTitleCandidate;
      const payloadTitle = sanitizeTitle(effectiveTitle) || '새 지식 트리';

      const treeRecord = await saveTreeMetadata({
        treeId: workingTreeId,
        title: payloadTitle,
      });

      const persistedTitle = sanitizeTitle(treeRecord?.title) || payloadTitle;
      if (manualOverrideActive && persistedTitle === rootTitleCandidate) {
        manualOverrideActive = false;
      }

      if (manualOverrideActive) {
        markTreeTitleManual(workingTreeId, persistedTitle);
      } else {
        markTreeTitleAuto(workingTreeId, persistedTitle);
      }

      const resolvedTreeId = treeRecord?.id || workingTreeId;
      pendingTreeIdRef.current = resolvedTreeId;
      if (resolvedTreeId) {
        writeSessionTreeId(resolvedTreeId);
        if (requestedTreeIdRef) {
          requestedTreeIdRef.current = resolvedTreeId;
        }
      }

      if (!activeTreeId && resolvedTreeId) {
        setActiveTreeId(resolvedTreeId);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('jarvis.activeTreeId', resolvedTreeId);
          } catch (error) {
            // storage access is best-effort only
          }
        }
      }

      if (resolvedTreeId) {
        await saveTreeNodes({
          treeId: resolvedTreeId,
          nodes: normalizedNodes,
        });

        const stateMap = treeLibrarySyncRef?.current;
        if (stateMap) {
          const existingState = stateMap.get(resolvedTreeId) || { lastCount: 0, refreshed: false };
          const previousCount = existingState.lastCount || 0;
          const alreadyRefreshed = existingState.refreshed === true;
          const nextCount = normalizedNodes.length;

          if (!alreadyRefreshed && previousCount === 0 && nextCount > 0) {
            try {
              treeBridge?.requestLibraryRefresh?.();
            } catch (error) {
              // IPC failures are non-fatal for sync notifications
            }
            stateMap.set(resolvedTreeId, { lastCount: nextCount, refreshed: true, manualTitle: manualOverrideActive, lastTitle: persistedTitle });
          } else {
            stateMap.set(resolvedTreeId, {
              lastCount: nextCount,
              refreshed: alreadyRefreshed || nextCount > 0,
              manualTitle: manualOverrideActive,
              lastTitle: persistedTitle,
            });
          }
        }

        if (isTrackingEmptyTree?.(resolvedTreeId)) {
          stopTrackingEmptyTree?.(resolvedTreeId);
        }
      }
    } catch (error) {
      setTreeSyncError(mapError(error));
      if (!activeTreeId) {
        pendingTreeIdRef.current = null;
      }
    } finally {
      setIsTreeSyncing(false);
    }
  }, [
    user,
    initializingTree,
    data,
    hierarchicalLinks,
    normalizeLinkEndpoint,
    getRootNodeId,
    activeTreeId,
    saveTreeMetadata,
    saveTreeNodes,
    writeSessionTreeId,
    requestedTreeIdRef,
    treeLibrarySyncRef,
    treeBridge,
    setActiveTreeId,
    isTrackingEmptyTree,
    stopTrackingEmptyTree,
    cleanupEmptyTrees,
    setTreeSyncError,
    setIsTreeSyncing,
  ]);

  persistTreeDataRef.current = persistTreeData;

  const schedulePersist = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      persistTreeDataRef.current();
    }, TREE_SAVE_DEBOUNCE_MS);
  }, [persistTreeData]);

  useEffect(() => {
    if (!user || initializingTree) {
      return undefined;
    }
    if (!Array.isArray(data?.nodes) || data.nodes.length === 0) {
      return undefined;
    }

    schedulePersist();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [user, data, initializingTree, schedulePersist]);

  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      persistTreeDataRef.current({ force: true });
    }
  }, []);

  const wasInitializingRef = useRef(initializingTree);

  useEffect(() => {
    const wasInitializing = wasInitializingRef.current;
    if (wasInitializing === false && initializingTree === true) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      persistTreeDataRef.current({ force: true });
    }
    wasInitializingRef.current = initializingTree;
  }, [initializingTree]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleBeforeUnload = async () => {
      if (!activeTreeId || !Array.isArray(data?.nodes)) {
        return;
      }

      if (data.nodes.length === 0 && typeof cleanupEmptyTrees === 'function') {
        try {
          await cleanupEmptyTrees([{ id: activeTreeId, treeData: data }]);
        } catch (error) {
          // 빈 트리 정리 실패는 치명적이지 않으므로 무시
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeTreeId, data, cleanupEmptyTrees]);

  return {
    persistTreeData,
  };
};

export default useTreePersistence;
