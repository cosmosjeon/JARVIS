import { ensureRendererBridge, safeInvoke, createSubscription } from './utils';

/**
 * @param {import('../types').LibraryBridge|any} bridge
 * @returns {import('../types').LibraryBridge}
 */
export const createLibraryBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    showLibrary: () => {
      const target = resolveBridge();
      return safeInvoke(target?.showLibrary);
    },
    requestLibraryRefresh: () => {
      const target = resolveBridge();
      return safeInvoke(target?.requestLibraryRefresh);
    },
    onLibraryRefresh: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onLibraryRefresh, listener);
    },
  };
};

export default createLibraryBridge;
