const buildSupabaseConfig = () => {
  const url = process.env.REACT_APP_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.SUPABASE_URL;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {};
  }

  return {
    url,
    anonKey,
  };
};

const normalizeKey = (key) => {
  if (typeof key !== 'string') {
    return null;
  }
  const trimmed = key.trim();
  return trimmed ? trimmed : null;
};

module.exports = () => ({
  getEnv: (key) => {
    const normalized = normalizeKey(key);
    if (!normalized) {
      return undefined;
    }
    return process.env[normalized];
  },
  getSupabaseConfig: () => buildSupabaseConfig(),
});
