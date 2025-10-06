import { ensureSupabase } from 'shared/lib/supabaseClient';
import {
  sanitizeConversationMessages,
  buildFallbackConversation,
} from 'features/tree/utils/conversation';

import {
  fetchTreesWithNodes as repositoryFetchTreesWithNodes,
  upsertTreeMetadata as repositoryUpsertTreeMetadata,
  deleteTree as repositoryDeleteTree,
  deleteNodes as repositoryDeleteNodes,
  moveTreeToFolder as repositoryMoveTreeToFolder,
} from 'infrastructure/supabase/repositories/treeRepository';
import {
  fetchFolders as repositoryFetchFolders,
  createFolder as repositoryCreateFolder,
  updateFolder as repositoryUpdateFolder,
  deleteFolder as repositoryDeleteFolder,
} from 'infrastructure/supabase/repositories/folderRepository';

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
  if (row?.node_type === 'memo') {
    return [];
  }

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

export const generateTreeId = () => generateId('tree');

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
  const nodeType = row.node_type || 'question';
  const resolveMemoMetadata = () => {
    const value = row.memo_metadata;
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'object') {
      return value;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null ? parsed : null;
      } catch (error) {
        return null;
      }
    }
    return null;
  };

  const memo = nodeType === 'memo'
    ? {
      title: row.memo_title || row.keyword || row.question || '메모',
      content: row.memo_content || '',
      metadata: resolveMemoMetadata(),
    }
    : null;

  const conversation = nodeType === 'memo'
    ? []
    : mapRowConversation(row);

  const keyword = nodeType === 'memo'
    ? (memo?.title || row.keyword || row.question || '메모')
    : (row.keyword || row.question || '신규 노드');

  const fullText = nodeType === 'memo'
    ? (memo?.content || '')
    : (row.answer || '');

  return {
    id: row.id,
    keyword,
    fullText,
    status: row.status || (nodeType === 'memo' ? 'memo' : 'answered'),
    level,
    size: nodeType === 'memo' ? 8 : (level === 0 ? 20 : 14),
    parentId: row.parent_id || row.memo_parent_id || null,
    memoParentId: row.memo_parent_id || null,
    nodeType,
    memo: memo || undefined,
    memoMetadata: memo?.metadata || null,
    question: nodeType === 'memo' ? null : (row.question || null),
    answer: nodeType === 'memo' ? null : (row.answer || null),
    conversation: conversation.map((message) => ({ ...message })),
    questionData: nodeType === 'memo' ? undefined : (row.question ? {
      question: row.question,
      answer: row.answer || '',
    } : undefined),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
};

const buildLinks = (nodeRows) => nodeRows
  .map((node) => ({
    parent: node.parent_id || node.memo_parent_id,
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
      folderId: tree.folder_id || null,
    };
  });
};

export const fetchTreesWithNodes = (userId) => repositoryFetchTreesWithNodes(userId);

export const upsertTreeNodes = async ({ treeId, nodes, userId }) => {
  const supabase = ensureSupabase();

  const formattedNodes = nodes.map((node) => {
    const nodeType = node.nodeType || node.node_type || (node.memo ? 'memo' : 'question');
    const question = typeof node.question === 'string' && node.question.trim()
      ? node.question.trim()
      : (node.questionData?.question || null);
    const answer = typeof node.answer === 'string' && node.answer.trim()
      ? node.answer.trim()
      : (node.fullText || node.questionData?.answer || null);
    const normalizedConversation = sanitizeConversationMessages(node.conversation);
    const conversation = nodeType === 'memo'
      ? []
      : (normalizedConversation.length
        ? normalizedConversation
        : buildFallbackConversation(question, answer));

    const memo = node.memo || (nodeType === 'memo' ? {
      title: node.keyword || null,
      content: node.fullText || null,
    } : null);
    const memoMetadata = node.memoMetadata || node.memo_metadata || memo?.metadata || null;

    return {
      id: node.id,
      user_id: userId,
      tree_id: treeId,
      parent_id: node.parentId || node.memoParentId || null,
      keyword: node.keyword || (memo?.title ?? null),
      question: nodeType === 'memo' ? null : question,
      answer: nodeType === 'memo' ? null : answer,
      status: node.status || (nodeType === 'memo' ? 'memo' : 'answered'),
      node_type: nodeType,
      memo_parent_id: node.memoParentId || node.parentId || null,
      memo_title: memo?.title ?? null,
      memo_content: memo?.content ?? null,
      memo_metadata: memoMetadata || null,
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

  // 노드 삭제 로직 제거 - 트리 생성 시 기존 노드들을 삭제하지 않음
  // 동기화가 필요한 경우 별도의 함수로 처리해야 함
};

// 링크는 parent_id로 관리되므로 별도 테이블 불필요

export const upsertTreeMetadata = (payload) => repositoryUpsertTreeMetadata(payload);

export const deleteTree = (input) => {
  const treeId = typeof input === 'string' ? input : input?.treeId;
  if (!treeId) {
    throw new Error('treeId is required');
  }
  return repositoryDeleteTree({ treeId });
};

export const deleteNodes = (params) => repositoryDeleteNodes(params);

// Folder management functions
export const fetchFolders = (userId) => repositoryFetchFolders(userId);

export const createFolder = (payload) => repositoryCreateFolder(payload);

export const updateFolder = (payload) => repositoryUpdateFolder(payload);

export const deleteFolder = (payload) => repositoryDeleteFolder(payload);

export const moveTreeToFolder = (params) => repositoryMoveTreeToFolder(params);

// ==================== Memos Management ====================

/**
 * 트리의 메모들을 가져옵니다
 */
export const fetchMemosForTree = async ({ treeId, userId }) => {
  const supabase = ensureSupabase();

  const { data, error } = await supabase
    .from('memos')
    .select('*')
    .eq('tree_id', treeId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  // 데이터 변환 (DB 형식 → 앱 형식)
  return (data || []).map(memo => ({
    id: memo.id,
    nodeId: memo.node_id,
    content: memo.content,
    position: {
      x: memo.position_x || 0,
      y: memo.position_y || 0,
    },
    createdAt: normalizeTimestamp(memo.created_at),
    updatedAt: normalizeTimestamp(memo.updated_at),
  }));
};

/**
 * 메모를 생성하거나 업데이트합니다
 */
export const upsertMemo = async ({ memo, treeId, userId }) => {
  const supabase = ensureSupabase();
  const now = Date.now();

  const payload = {
    id: memo.id,
    user_id: userId,
    tree_id: treeId,
    node_id: memo.nodeId,
    content: memo.content,
    position_x: memo.position?.x || 0,
    position_y: memo.position?.y || 0,
    updated_at: now,
  };

  // 새 메모인 경우 created_at 추가
  if (!memo.createdAt) {
    payload.created_at = now;
  } else {
    payload.created_at = normalizeTimestamp(memo.createdAt);
  }

  const { data, error } = await supabase
    .from('memos')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * 메모를 삭제합니다 (soft delete)
 */
export const deleteMemo = async ({ memoId, userId }) => {
  const supabase = ensureSupabase();
  const now = Date.now();

  const { error } = await supabase
    .from('memos')
    .update({ deleted_at: now })
    .eq('id', memoId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
};

// ==================== Tree Viewport State Management ====================

/**
 * 트리의 뷰포트 상태를 저장합니다
 * @param {Object} params
 * @param {string} params.treeId - 트리 ID
 * @param {string} params.userId - 사용자 ID
 * @param {Object} params.viewportData - 뷰포트 데이터 {zoom: {k, x, y}, pan: {x, y}, nodePositions: {nodeId: {x, y}}}
 */
export const saveTreeViewportState = async ({ treeId, userId, viewportData }) => {
  const supabase = ensureSupabase();
  const now = Date.now();

  // 기존 뷰포트 상태가 있는지 확인
  const { data: existingState, error: fetchError } = await supabase
    .from('tree_viewport_states')
    .select('id')
    .eq('tree_id', treeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const payload = {
    tree_id: treeId,
    user_id: userId,
    viewport_data: viewportData,
    updated_at: now,
  };

  let result;
  if (existingState) {
    // 기존 상태 업데이트
    const { data, error } = await supabase
      .from('tree_viewport_states')
      .update(payload)
      .eq('id', existingState.id)
      .select()
      .single();

    if (error) {
      throw error;
    }
    result = data;
  } else {
    // 새 상태 생성
    payload.created_at = now;
    const { data, error } = await supabase
      .from('tree_viewport_states')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }
    result = data;
  }

  return result;
};

/**
 * 트리의 뷰포트 상태를 불러옵니다
 * @param {Object} params
 * @param {string} params.treeId - 트리 ID
 * @param {string} params.userId - 사용자 ID
 * @returns {Object|null} 뷰포트 데이터 또는 null
 */
export const loadTreeViewportState = async ({ treeId, userId }) => {
  const supabase = ensureSupabase();

  const { data, error } = await supabase
    .from('tree_viewport_states')
    .select('viewport_data')
    .eq('tree_id', treeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.viewport_data || null;
};

/**
 * 트리의 뷰포트 상태를 삭제합니다
 * @param {Object} params
 * @param {string} params.treeId - 트리 ID
 * @param {string} params.userId - 사용자 ID
 */
export const deleteTreeViewportState = async ({ treeId, userId }) => {
  const supabase = ensureSupabase();

  const { error } = await supabase
    .from('tree_viewport_states')
    .delete()
    .eq('tree_id', treeId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
};
