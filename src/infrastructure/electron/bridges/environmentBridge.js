import { ensureRendererBridge, safeInvoke } from './utils';

const sanitizeSupabaseConfig = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const url = typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : undefined;
  const anonKey = typeof raw.anonKey === 'string' && raw.anonKey.trim() ? raw.anonKey.trim() : undefined;
  return {
    url,
    anonKey,
  };
};

/**
 * @param {import('../types').EnvironmentBridge|any} bridge
 * @returns {import('../types').EnvironmentBridge}
 */
export const createEnvironmentBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    getEnv: (key) => {
      const target = resolveBridge();
      return safeInvoke(target?.getEnv, key);
    },
    getSupabaseConfig: () => {
      const target = resolveBridge();
      const result = safeInvoke(target?.getSupabaseConfig);
      return sanitizeSupabaseConfig(result);
    },
  };
};

export default createEnvironmentBridge;
