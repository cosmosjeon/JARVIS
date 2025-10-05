import { ensureRendererBridge, safeInvoke } from './utils';

/**
 * @param {import('../types').SystemBridge|any} bridge
 * @returns {import('../types').SystemBridge}
 */
export const createSystemBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    checkAccessibilityPermission: () => {
      const target = resolveBridge();
      return safeInvoke(target?.checkAccessibilityPermission);
    },
    requestAccessibilityPermission: () => {
      const target = resolveBridge();
      return safeInvoke(target?.requestAccessibilityPermission);
    },
  };
};

export default createSystemBridge;
