import { ensureRendererBridge, safeInvoke, createSubscription } from './utils';

/**
 * @param {import('../types').SettingsBridge|any} bridge
 * @returns {import('../types').SettingsBridge}
 */
export const createSettingsBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    getSettings: () => {
      const target = resolveBridge();
      return safeInvoke(target?.getSettings);
    },
    updateSettings: (partial) => {
      const target = resolveBridge();
      return safeInvoke(target?.updateSettings, partial);
    },
    onSettings: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onSettings, listener);
    },
  };
};

export default createSettingsBridge;
