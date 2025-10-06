import { useCallback, useRef } from 'react';
import { sanitizeConversationMessages, buildFallbackConversation } from 'features/tree/utils/conversation';

const BOOTSTRAP_KEY = '__bootstrap__';

const cloneMessages = (messages = []) => (
  Array.isArray(messages)
    ? messages.map((entry) => ({ ...entry }))
    : []
);

const useConversationStore = () => {
  const storeRef = useRef(new Map());

  const hydrateFromNodes = useCallback((nodes = []) => {
    storeRef.current.clear();
    nodes.forEach((node) => {
      if (!node || !node.id) {
        return;
      }

      const sanitized = sanitizeConversationMessages(node.conversation);
      const fallback = sanitized.length
        ? sanitized
        : buildFallbackConversation(
          node.question || node.questionData?.question,
          node.answer || node.questionData?.answer || node.fullText,
        );

      storeRef.current.set(node.id, fallback);
    });
  }, []);

  const getConversation = useCallback((nodeId) => {
    if (!nodeId) {
      return [];
    }
    const stored = storeRef.current.get(nodeId);
    return cloneMessages(stored);
  }, []);

  const setConversation = useCallback((nodeId, messages) => {
    if (!nodeId) {
      return;
    }
    storeRef.current.set(nodeId, cloneMessages(messages));
  }, []);

  const deleteConversation = useCallback((nodeId) => {
    if (!nodeId) {
      return;
    }
    storeRef.current.delete(nodeId);
  }, []);

  const hasConversation = useCallback((nodeId) => (
    nodeId ? storeRef.current.has(nodeId) : false
  ), []);

  const ensureBootstrap = useCallback(() => {
    if (!storeRef.current.has(BOOTSTRAP_KEY)) {
      storeRef.current.set(BOOTSTRAP_KEY, []);
    }
  }, []);

  const clearBootstrap = useCallback(() => {
    storeRef.current.delete(BOOTSTRAP_KEY);
  }, []);

  const clearAll = useCallback(() => {
    storeRef.current.clear();
  }, []);

  return {
    hydrateFromNodes,
    getConversation,
    setConversation,
    deleteConversation,
    hasConversation,
    ensureBootstrap,
    clearBootstrap,
    clearAll,
    storeRef,
  };
};

export default useConversationStore;
