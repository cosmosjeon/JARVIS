import { ensureSupabase } from '../lib/supabaseClient';

const MESSAGE_LIMIT = 48;

export const sanitizeConversationMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  const sanitized = [];
  messages.forEach((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (!text) {
      return;
    }

    const entry = { role, text };

    if (typeof message.status === 'string' && message.status.trim()) {
      entry.status = message.status.trim();
    }

    const tsCandidate = typeof message.timestamp === 'string'
      ? Number(message.timestamp)
      : Number(message.timestamp);
    if (Number.isFinite(tsCandidate) && tsCandidate > 0) {
      entry.timestamp = tsCandidate;
    }

    if (message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)) {
      entry.metadata = message.metadata;
    }

    sanitized.push(entry);
  });

  if (sanitized.length > MESSAGE_LIMIT) {
    return sanitized.slice(sanitized.length - MESSAGE_LIMIT);
  }

  return sanitized;
};

export const buildFallbackConversation = (question, answer) => {
  const conversation = [];
  if (typeof question === 'string' && question.trim()) {
    conversation.push({ role: 'user', text: question.trim() });
  }
  if (typeof answer === 'string' && answer.trim()) {
    conversation.push({ role: 'assistant', text: answer.trim() });
  }
  return conversation;
};

const parseConversationField = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const mapRowConversation = (row) => {
  const parsed = parseConversationField(row?.conversation);
  const sanitized = sanitizeConversationMessages(parsed);
  if (sanitized.length) {
    return sanitized;
  }

  return buildFallbackConversation(row?.question, row?.answer);
};

const generateId = (prefix = 'tree') => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (error) {
    // ignore and fallback
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
};

const normalizeTimestamp = (value) => {
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

const mapNodeRow = (row, level = 0) => {
  const conversation = mapRowConversation(row);
  return {
    id: row.id,
    keyword: row.keyword || row.question || '신규 노드',
    fullText: row.answer || '',
    status: row.status || 'answered',
    level,
    size: level === 0 ? 20 : 14,
    parentId: row.parent_id,
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
  .filter((node) => node.parent_id)
  .map((node) => ({
    source: node.parent_id,
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
    const rows = nodesByTree.get(tree.id) || [];
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
    };
  });
};

export const fetchTreesWithNodes = async (userId) => {
  const supabase = ensureSupabase();

  const query = supabase
    .from('trees')
    .select('id, title, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (userId) {
    query.eq('user_id', userId);
  }

  const { data: treeRows, error: treeError } = await query.range(0, 199);

  if (treeError) {
    throw treeError;
  }

  if (!treeRows?.length) {
    return [];
  }

  const treeIds = treeRows.map((tree) => tree.id);

  const nodeQuery = supabase
    .from('nodes')
    .select('id, tree_id, parent_id, keyword, question, answer, status, created_at, updated_at, deleted_at, conversation')
    .in('tree_id', treeIds)
    .is('deleted_at', null);

  if (userId) {
    nodeQuery.eq('user_id', userId);
  }

  const { data: nodeRows, error: nodeError } = await nodeQuery.range(0, 9999);

  if (nodeError) {
    throw nodeError;
  }

  return transformTreeRowsToLibraryData(treeRows, nodeRows || []);
};

export const upsertTreeNodes = async ({ treeId, nodes, userId }) => {
  const supabase = ensureSupabase();

  const formattedNodes = nodes.map((node) => {
    const question = typeof node.question === 'string' && node.question.trim()
      ? node.question.trim()
      : (node.questionData?.question || null);
    const answer = typeof node.answer === 'string' && node.answer.trim()
      ? node.answer.trim()
      : (node.fullText || node.questionData?.answer || null);
    const normalizedConversation = sanitizeConversationMessages(node.conversation);
    const conversation = normalizedConversation.length
      ? normalizedConversation
      : buildFallbackConversation(question, answer);

    return {
      id: node.id,
      user_id: userId,
      tree_id: treeId,
      parent_id: node.parentId || null,
      keyword: node.keyword || null,
      question,
      answer,
      status: node.status || 'answered',
      created_at: normalizeTimestamp(node.createdAt) || Date.now(),
      updated_at: Date.now(),
      conversation,
    };
  });

  const { error } = await supabase.from('nodes').upsert(formattedNodes, {
    onConflict: 'id',
  });

  if (error) {
    throw error;
  }

  const nodeIds = nodes.map((node) => node.id);
  if (nodeIds.length) {
    const { error: deleteError } = await supabase
      .from('nodes')
      .update({ deleted_at: Date.now() })
      .not('id', 'in', `(${nodeIds.map((id) => `'${id}'`).join(',')})`)
      .eq('tree_id', treeId)
      .is('deleted_at', null);

    if (deleteError && deleteError.code !== 'PGRST116') {
      // ignore if nothing to update
      throw deleteError;
    }
  } else {
    const { error: deleteAllError } = await supabase
      .from('nodes')
      .update({ deleted_at: Date.now() })
      .eq('tree_id', treeId)
      .is('deleted_at', null);

    if (deleteAllError && deleteAllError.code !== 'PGRST116') {
      throw deleteAllError;
    }
  }
};

export const upsertTreeMetadata = async ({ treeId, title, userId }) => {
  const supabase = ensureSupabase();
  const now = Date.now();
  const resolvedTreeId = treeId || generateId('tree');

  const payload = {
    id: resolvedTreeId,
    title,
    updated_at: now,
    user_id: userId,
  };

  if (!treeId) {
    payload.created_at = now;
  } else {
    const { data: existingTree, error: fetchError } = await supabase
      .from('trees')
      .select('created_at')
      .eq('id', treeId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    payload.created_at = existingTree?.created_at ?? now;
  }

  const { data, error } = await supabase
    .from('trees')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const deleteTree = async (treeId) => {
  const supabase = ensureSupabase();

  const timestamp = Date.now();
  const { error } = await supabase
    .from('trees')
    .update({ deleted_at: timestamp, updated_at: timestamp })
    .eq('id', treeId);

  if (error) {
    throw error;
  }
};
