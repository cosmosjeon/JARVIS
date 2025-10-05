import { ensureRendererBridge, createSubscription } from './utils';

/**
 * @param {import('../types').TrayBridge|any} bridge
 * @returns {import('../types').TrayBridge}
 */
export const createTrayBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    onTrayCommand: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onTrayCommand, listener);
    },
  };
};

export default createTrayBridge;
