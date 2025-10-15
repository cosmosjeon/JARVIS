import {
  sanitizeConversationMessages,
  buildFallbackConversation,
} from 'features/tree/utils/conversation';

const EMPTY_ARRAY = Object.freeze([]);

const parseConversationField = (value) => {
  if (!value) {
    return EMPTY_ARRAY;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : EMPTY_ARRAY;
    } catch (error) {
      return EMPTY_ARRAY;
    }
  }

  return EMPTY_ARRAY;
};

const mapRowConversation = (row) => {
  const parsed = parseConversationField(row?.conversation);
  const sanitized = sanitizeConversationMessages(parsed);
  if (sanitized.length) {
    return sanitized;
  }

  return buildFallbackConversation(row?.question, row?.answer);
};

export const normalizeTimestamp = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? Date.parse(value) || Date.now() : parsed;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return Date.now();
};

export const mapNodeRow = (row, level = 0) => {
  const conversation = mapRowConversation(row);
  const keyword = row.keyword || row.question || '신규 노드';
  const fullText = row.answer || '';

  return {
    id: row.id,
    keyword,
    fullText,
    status: row.status || 'answered',
    level,
    size: level === 0 ? 20 : 14,
    parentId: row.parent_id || null,
    nodeType: 'question',
    question: row.question || null,
    answer: row.answer || null,
    conversation: conversation.map((message) => ({ ...message })),
    questionData: row.question ? {
      question: row.question,
      answer: row.answer || '',
    } : undefined,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
};

const buildLinks = (nodeRows) => nodeRows
  .map((node) => ({
    parent: node.parent_id,
    id: node.id,
  }))
  .filter((entry) => entry.parent)
  .map((node) => ({
    source: node.parent,
    target: node.id,
    value: 1,
  }));

export const transformTreeRowsToLibraryData = (trees, nodeRows) => {
  const nodesByTree = nodeRows.reduce((acc, node) => {
    if (!acc.has(node.tree_id)) {
      acc.set(node.tree_id, []);
    }
    acc.get(node.tree_id).push(node);
    return acc;
  }, new Map());

  return trees.map((tree) => {
    const rows = nodesByTree.get(tree.id) || EMPTY_ARRAY;
    const rowMap = new Map(rows.map((row) => [row.id, row]));
    const levelCache = new Map();

    const resolveLevel = (row) => {
      if (levelCache.has(row.id)) {
        return levelCache.get(row.id);
      }
      if (!row.parent_id) {
        levelCache.set(row.id, 0);
        return 0;
      }
      const parent = rowMap.get(row.parent_id);
      const level = parent ? resolveLevel(parent) + 1 : 0;
      levelCache.set(row.id, level);
      return level;
    };

    const nodes = rows.map((row) => mapNodeRow(row, resolveLevel(row)));
    return {
      id: tree.id,
      title: tree.title,
      treeData: {
        nodes,
        links: buildLinks(rows),
      },
      createdAt: normalizeTimestamp(tree.created_at),
      updatedAt: normalizeTimestamp(tree.updated_at),
      folderId: tree.folder_id || null,
    };
  });
};

export default {
  normalizeTimestamp,
  transformTreeRowsToLibraryData,
  mapNodeRow,
};
