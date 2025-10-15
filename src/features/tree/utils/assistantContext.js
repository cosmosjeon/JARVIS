const DEFAULT_MAX_MESSAGES = 12;
const MAX_DYNAMIC_MESSAGES = 36;
const MIN_DYNAMIC_MESSAGES = 12;

const resolveMessageLimit = (maxMessages, depth) => {
  if (typeof maxMessages === 'number' && Number.isFinite(maxMessages)) {
    return Math.max(1, Math.floor(maxMessages));
  }
  const dynamicBase = MIN_DYNAMIC_MESSAGES + Math.max(0, depth - 1) * 4;
  return Math.min(MAX_DYNAMIC_MESSAGES, dynamicBase);
};

const resolveParentId = (parentByChild, nodeId, fallbackParentResolver) => {
  if (!nodeId) {
    return null;
  }

  if (parentByChild) {
    if (typeof parentByChild.get === 'function') {
      const resolved = parentByChild.get(nodeId);
      if (resolved !== undefined && resolved !== null) {
        return resolved;
      }
    } else if (typeof parentByChild === 'object' && parentByChild !== null) {
      const resolved = parentByChild[nodeId];
      if (resolved !== undefined && resolved !== null) {
        return resolved;
      }
    }
  }

  if (typeof fallbackParentResolver === 'function') {
    return fallbackParentResolver(nodeId) ?? null;
  }

  return null;
};

const normalizeHistoryEntry = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const text = typeof entry.text === 'string' ? entry.text.trim() : '';
  if (!text) {
    return null;
  }

  const role = entry.role === 'assistant' ? 'assistant' : 'user';
  return { role, content: text };
};

export const collectAncestorConversationMessages = ({
  nodeId,
  parentByChild,
  getConversation,
  maxMessages = DEFAULT_MAX_MESSAGES,
  fallbackParentResolver = null,
} = {}) => {
  if (!nodeId || typeof getConversation !== 'function') {
    console.log('[collectAncestorConversationMessages] 조기 반환: nodeId 또는 getConversation 없음', { nodeId, hasGetConversation: typeof getConversation === 'function' });
    return [];
  }

  const chain = [];
  const guard = new Set();
  let currentId = nodeId;

  while (currentId) {
    if (guard.has(currentId)) {
      break;
    }
    guard.add(currentId);
    chain.unshift(currentId);
    currentId = resolveParentId(parentByChild, currentId, fallbackParentResolver);
  }

  console.log('[collectAncestorConversationMessages] 노드 체인 수집 완료:', {
    targetNodeId: nodeId,
    chainLength: chain.length,
    chain: chain
  });

  const collected = [];
  chain.forEach((id) => {
    const history = getConversation(id);
    console.log('[collectAncestorConversationMessages] 노드의 대화 히스토리:', {
      nodeId: id,
      historyType: Array.isArray(history) ? 'array' : typeof history,
      historyLength: Array.isArray(history) ? history.length : 0,
      history: history
    });

    if (!Array.isArray(history)) {
      return;
    }
    history.forEach((entry) => {
      const normalized = normalizeHistoryEntry(entry);
      if (normalized) {
        collected.push(normalized);
      } else {
        console.log('[collectAncestorConversationMessages] 메시지 정규화 실패:', { entry });
      }
    });
  });

  const limit = resolveMessageLimit(maxMessages, chain.length);
  console.log('[collectAncestorConversationMessages] 최종 수집 결과:', {
    totalCollected: collected.length,
    limit,
    finalCount: limit > 0 ? Math.min(collected.length, limit) : collected.length,
    messages: collected
  });

  if (limit > 0) {
    return collected.length > limit
      ? collected.slice(collected.length - limit)
      : collected;
  }

  return collected;
};

export default collectAncestorConversationMessages;
