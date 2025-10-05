import { ensureRendererBridge, safeInvoke } from './utils';

/**
 * @param {import('../types').AdminBridge|any} bridge
 * @returns {import('../types').AdminBridge}
 */
export const createAdminBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    openAdminPanel: () => {
      const target = resolveBridge();
      return safeInvoke(target?.openAdminPanel);
    },
    closeAdminPanel: () => {
      const target = resolveBridge();
      return safeInvoke(target?.closeAdminPanel);
    },
  };
};

export default createAdminBridge;
