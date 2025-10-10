const DEFAULT_MAX_MESSAGES = 12;

const resolveParentId = (parentByChild, nodeId) => {
  if (!parentByChild || !nodeId) {
    return null;
  }

  if (typeof parentByChild.get === 'function') {
    return parentByChild.get(nodeId) ?? null;
  }

  if (typeof parentByChild === 'object' && parentByChild !== null) {
    return parentByChild[nodeId] ?? null;
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
} = {}) => {
  if (!nodeId || typeof getConversation !== 'function') {
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
    currentId = resolveParentId(parentByChild, currentId);
  }

  const collected = [];
  chain.forEach((id) => {
    const history = getConversation(id);
    if (!Array.isArray(history)) {
      return;
    }
    history.forEach((entry) => {
      const normalized = normalizeHistoryEntry(entry);
      if (normalized) {
        collected.push(normalized);
      }
    });
  });

  if (typeof maxMessages === 'number' && Number.isFinite(maxMessages) && maxMessages > 0) {
    return collected.length > maxMessages
      ? collected.slice(collected.length - maxMessages)
      : collected;
  }

  return collected;
};

export default collectAncestorConversationMessages;
