import { ensureRendererBridge, safeInvoke, createSubscription } from './utils';

/**
 * @param {import('../types').LoggerBridge|any} bridge
 * @returns {import('../types').LoggerBridge}
 */
export const createLoggerBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    log: (level, message, meta) => {
      const target = resolveBridge();
      return safeInvoke(target?.log, level, message, meta);
    },
    onLog: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onLog, listener);
    },
    exportLogs: (options) => {
      const target = resolveBridge();
      return safeInvoke(target?.exportLogs, options);
    },
  };
};

export default createLoggerBridge;
