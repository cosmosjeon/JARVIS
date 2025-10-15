import { createClient } from '@supabase/supabase-js';
import { createEnvironmentBridge } from 'infrastructure/electron/bridges';

const environmentBridge = createEnvironmentBridge();

const resolveRuntimeSupabaseConfig = () => {
  if (!environmentBridge || typeof environmentBridge.getSupabaseConfig !== 'function') {
    return {};
  }
  return environmentBridge.getSupabaseConfig() || {};
};

const getSupabaseEnv = () => {
  const runtimeConfig = resolveRuntimeSupabaseConfig();
  const url = process.env.REACT_APP_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || runtimeConfig.url;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || runtimeConfig.anonKey;

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
    throw new Error('Supabase client has not been configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY (또는 Electron 런타임 환경 변수를 구성하세요).');
  }
  return supabase;
};

export default supabase;
