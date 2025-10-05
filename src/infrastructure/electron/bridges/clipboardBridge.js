import { ensureRendererBridge, createSubscription } from './utils';

/**
 * @param {import('../types').ClipboardBridge|any} bridge
 * @returns {import('../types').ClipboardBridge}
 */
export const createClipboardBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    onClipboard: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onClipboard, listener);
    },
    onClipboardError: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onClipboardError, listener);
    },
  };
};

export default createClipboardBridge;
