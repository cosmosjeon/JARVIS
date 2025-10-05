import { ensureRendererBridge, safeInvoke, createSubscription } from './utils';

/**
 * @param {import('../types').TreeWidgetBridge|any} bridge
 * @returns {import('../types').TreeWidgetBridge}
 */
export const createTreeWidgetBridge = (bridge = ensureRendererBridge()) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  const resolveWindowControls = () => {
    const target = resolveBridge();
    const controls = target?.windowControls;
    if (controls) {
      return controls;
    }
    return null;
  };

  return {
    setMousePassthrough: (options) => {
      const target = resolveBridge();
      return safeInvoke(target?.setMousePassthrough, options);
    },
    onSetActiveTree: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onWidgetSetActiveTree, listener);
    },
    requestLibraryRefresh: () => {
      const target = resolveBridge();
      return safeInvoke(target?.requestLibraryRefresh);
    },
    extractKeyword: (payload) => {
      const target = resolveBridge();
      return safeInvoke(target?.extractKeyword, payload);
    },
    openWidget: (payload) => {
      const target = resolveBridge();
      return safeInvoke(target?.openWidget, payload);
    },
    log: (level, event, context) => {
      const target = resolveBridge();
      safeInvoke(target?.log, level, event, context);
    },
    windowControls: {
      maximize: () => {
        const controls = resolveWindowControls();
        return safeInvoke(controls?.maximize);
      },
      toggleFullScreen: () => {
        const controls = resolveWindowControls();
        return safeInvoke(controls?.toggleFullScreen);
      },
      close: () => {
        const controls = resolveWindowControls();
        return safeInvoke(controls?.close);
      },
    },
    toggleWindow: () => {
      const target = resolveBridge();
      return safeInvoke(target?.toggleWindow);
    },
  };
};

export default createTreeWidgetBridge;
