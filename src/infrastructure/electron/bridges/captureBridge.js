import { ensureRendererBridge, safeInvoke, createSubscription } from './utils';

/**
 * @param {import('../types').CaptureBridge|any} bridge
 * @returns {import('../types').CaptureBridge}
 */
export const createCaptureBridge = (bridge = ensureRendererBridge()) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    requestCapture: () => {
      const target = resolveBridge();
      return safeInvoke(target?.requestCapture);
    },
    performCapture: (payload) => {
      const target = resolveBridge();
      return safeInvoke(target?.performCapture, payload);
    },
    cancelCapture: () => {
      const target = resolveBridge();
      return safeInvoke(target?.cancelCapture);
    },
    onCaptureCompleted: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onCaptureCompleted, listener);
    },
    onCaptureCancelled: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onCaptureCancelled, listener);
    },
    onCaptureFailed: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onCaptureFailed, listener);
    },
  };
};

export default createCaptureBridge;
