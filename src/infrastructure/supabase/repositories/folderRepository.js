import { ensureSupabase } from 'shared/lib/supabaseClient';

const buildFolderQuery = (supabase, userId) => {
  const query = supabase
    .from('folders')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (userId) {
    query.eq('user_id', userId);
  }

  return query;
};

export const fetchFolders = async (userId) => {
  const supabase = ensureSupabase();
  const { data, error } = await buildFolderQuery(supabase, userId);
  if (error) {
    throw error;
  }
  return data || [];
};

export const createFolder = async ({ name, parentId, userId }) => {
  if (!userId) {
    throw new Error('userId is required to create folder');
  }

  const supabase = ensureSupabase();
  const now = Date.now();

  const payload = {
    name,
    user_id: userId,
    created_at: now,
    updated_at: now,
  };

  if (parentId) {
    payload.parent_id = parentId;
  }

  const { data, error } = await supabase
    .from('folders')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const updateFolder = async ({ folderId, name, userId }) => {
  if (!folderId) {
    throw new Error('folderId is required to update folder');
  }

  const supabase = ensureSupabase();
  const now = Date.now();

  const builder = supabase
    .from('folders')
    .update({
      name,
      updated_at: now,
    })
    .eq('id', folderId);

  if (userId) {
    builder.eq('user_id', userId);
  }

  const { data, error } = await builder.select().single();
  if (error) {
    throw error;
  }

  return data;
};

export const deleteFolder = async ({ folderId, userId }) => {
  if (!folderId) {
    throw new Error('folderId is required to delete folder');
  }

  const supabase = ensureSupabase();
  const now = Date.now();

  const builder = supabase
    .from('folders')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', folderId);

  if (userId) {
    builder.eq('user_id', userId);
  }

  const { error } = await builder;
  if (error) {
    throw error;
  }
};

export default {
  fetchFolders,
  createFolder,
  updateFolder,
  deleteFolder,
};
