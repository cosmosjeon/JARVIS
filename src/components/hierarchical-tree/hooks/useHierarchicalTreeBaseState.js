import { useCallback, useEffect, useRef, useState } from 'react';
import { treeData } from '../../../data/treeData';
import { sanitizeConversationMessages, buildFallbackConversation } from '../../../services/supabaseTrees';
import { hydrateConversationStore as hydrateConversationStoreHelper } from './hierarchicalTreeHelpers';

const BOOTSTRAP_NODE_ID = '__bootstrap__';

const useHierarchicalTreeBaseState = () => {
  const [data, setData] = useState(treeData);
  const dataRef = useRef(treeData);
  const conversationStoreRef = useRef(new Map());
  const [showBootstrapChat, setShowBootstrapChat] = useState(false);

  const hydrateConversationStore = useCallback((incomingNodes = []) => {
    hydrateConversationStoreHelper(
      conversationStoreRef,
      incomingNodes,
      sanitizeConversationMessages,
      buildFallbackConversation,
    );
  }, []);

  const setConversationForNode = useCallback((nodeId, messages) => {
    const normalized = Array.isArray(messages)
      ? messages.map((message) => ({ ...message }))
      : [];
    conversationStoreRef.current.set(nodeId, normalized);
  }, []);

  const getInitialConversationForNode = useCallback((nodeId) => {
    const stored = conversationStoreRef.current.get(nodeId);
    return stored ? stored.map((message) => ({ ...message })) : [];
  }, []);

  const createClientGeneratedId = useCallback((prefix = 'tree') => {
    try {
      const uuid = crypto?.randomUUID?.();
      if (uuid) {
        return `${prefix}_${uuid}`;
      }
    } catch (error) {
      // ignore and fallback below
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const isEmpty = !Array.isArray(data.nodes) || data.nodes.length === 0;
    setShowBootstrapChat(isEmpty);

    if (isEmpty) {
      if (!conversationStoreRef.current.has(BOOTSTRAP_NODE_ID)) {
        conversationStoreRef.current.set(BOOTSTRAP_NODE_ID, []);
      }
    } else {
      conversationStoreRef.current.delete(BOOTSTRAP_NODE_ID);
    }
  }, [data.nodes]);

  useEffect(() => {
    data.nodes.forEach((node) => {
      if (!conversationStoreRef.current.has(node.id)) {
        setConversationForNode(node.id, []);
      }
    });
  }, [data.nodes, setConversationForNode]);

  return {
    data,
    setData,
    dataRef,
    conversationStoreRef,
    hydrateConversationStore,
    setConversationForNode,
    getInitialConversationForNode,
    showBootstrapChat,
    setShowBootstrapChat,
    conversationStoreBootstrapKey: BOOTSTRAP_NODE_ID,
    createClientGeneratedId,
  };
};

export default useHierarchicalTreeBaseState;
