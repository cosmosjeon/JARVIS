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

  const limit = resolveMessageLimit(maxMessages, chain.length);
  if (limit > 0) {
    return collected.length > limit
      ? collected.slice(collected.length - limit)
      : collected;
  }

  return collected;
};

export default collectAncestorConversationMessages;
