import { ensureSupabase } from 'shared/lib/supabaseClient';
import {
  transformTreeRowsToLibraryData,
} from 'infrastructure/supabase/mappers/libraryTreeMapper';

const TREE_FETCH_LIMIT = 200;
const NODE_FETCH_LIMIT = 10000;

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

const buildTreeQuery = (supabase, userId) => {
  const query = supabase
    .from('trees')
    .select('id, title, created_at, updated_at, deleted_at, folder_id, user_id')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(0, TREE_FETCH_LIMIT - 1);

  if (userId) {
    query.eq('user_id', userId);
  }

  return query;
};

const buildNodeQuery = (supabase, treeIds, userId) => {
  const query = supabase
    .from('nodes')
    .select('id, tree_id, parent_id, keyword, question, answer, status, node_type, memo_parent_id, memo_title, memo_content, memo_metadata, created_at, updated_at, deleted_at, conversation, user_id')
    .in('tree_id', treeIds)
    .is('deleted_at', null)
    .range(0, NODE_FETCH_LIMIT - 1);

  if (userId) {
    query.eq('user_id', userId);
  }

  return query;
};

export const fetchTreesWithNodes = async (userId) => {
  const supabase = ensureSupabase();

  const { data: treeRows, error: treeError } = await buildTreeQuery(supabase, userId);
  if (treeError) {
    throw treeError;
  }

  if (!treeRows?.length) {
    return [];
  }

  const treeIds = treeRows.map((tree) => tree.id);
  const { data: nodeRows, error: nodeError } = await buildNodeQuery(supabase, treeIds, userId);

  if (nodeError) {
    throw nodeError;
  }

  return transformTreeRowsToLibraryData(treeRows, nodeRows || []);
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

export const deleteTree = async ({ treeId }) => {
  if (!treeId) {
    throw new Error('treeId is required');
  }

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

export const deleteNodes = async ({ nodeIds, userId }) => {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
    return;
  }

  const supabase = ensureSupabase();
  const timestamp = Date.now();

  const query = supabase
    .from('nodes')
    .update({ deleted_at: timestamp, updated_at: timestamp })
    .in('id', nodeIds);

  if (userId) {
    query.eq('user_id', userId);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
};

export const moveTreeToFolder = async ({ treeId, folderId, userId }) => {
  if (!treeId) {
    throw new Error('treeId is required');
  }

  const supabase = ensureSupabase();
  const timestamp = Date.now();

  const query = supabase
    .from('trees')
    .update({
      folder_id: folderId,
      updated_at: timestamp,
    })
    .eq('id', treeId);

  if (userId) {
    query.eq('user_id', userId);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
};

export default {
  fetchTreesWithNodes,
  upsertTreeMetadata,
  deleteTree,
  deleteNodes,
  moveTreeToFolder,
};
