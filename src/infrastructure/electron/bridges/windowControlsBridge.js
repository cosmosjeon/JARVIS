import { ensureRendererBridge, safeInvoke, createSubscription } from './utils';

/**
 * @param {import('../types').WindowControlsBridge|any} bridge
 * @returns {import('../types').WindowControlsBridge}
 */
export const createWindowControlsBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  const resolveControls = () => {
    const target = resolveBridge();
    return target?.windowControls || null;
  };

  return {
    getState: () => {
      const controls = resolveControls();
      return safeInvoke(controls?.getState);
    },
    onStateChange: (listener) => {
      const controls = resolveControls();
      return createSubscription(controls?.onStateChange, listener);
    },
    maximize: () => {
      const controls = resolveControls();
      return safeInvoke(controls?.maximize);
    },
    minimize: () => {
      const controls = resolveControls();
      return safeInvoke(controls?.minimize);
    },
    toggleFullScreen: () => {
      const controls = resolveControls();
      return safeInvoke(controls?.toggleFullScreen);
    },
    close: () => {
      const controls = resolveControls();
      return safeInvoke(controls?.close);
    },
    restore: () => {
      const controls = resolveControls();
      return safeInvoke(controls?.restore);
    },
  };
};

export default createWindowControlsBridge;
