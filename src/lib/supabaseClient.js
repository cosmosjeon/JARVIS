import { createClient } from '@supabase/supabase-js';

const getSupabaseEnv = () => {
  const url = process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[supabase] Missing environment configuration.');
    }
    return { url: undefined, anonKey: undefined };
  }

  return { url, anonKey };
};

const { url, anonKey } = getSupabaseEnv();

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        storageKey: 'jarvis-supabase-auth',
        flowType: 'pkce',
      },
    })
  : null;

export const ensureSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase client has not been configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
  }
  return supabase;
};

export default supabase;
