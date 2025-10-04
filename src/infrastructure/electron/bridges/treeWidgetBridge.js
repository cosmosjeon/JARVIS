const once = (fn) => {
  let called = false;
  return (...args) => {
    if (called) {
      return undefined;
    }
    called = true;
    return typeof fn === 'function' ? fn(...args) : undefined;
  };
};

const ensureBridge = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.jarvisAPI || null;
};

const safeInvoke = (fn, ...args) => {
  if (typeof fn !== 'function') {
    return null;
  }
  try {
    return fn(...args);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[treeWidgetBridge] call failed', error);
    }
    return null;
  }
};

/**
 * @param {import('../types').TreeWidgetBridge|any} bridge
 * @returns {import('../types').TreeWidgetBridge}
 */
export const createTreeWidgetBridge = (bridge = ensureBridge()) => {
  const subscribe = (listener) => {
    if (typeof listener !== 'function') {
      return () => {};
    }
    const unsubscribe = safeInvoke(bridge?.onWidgetSetActiveTree, listener);
    if (typeof unsubscribe === 'function') {
      return once(unsubscribe);
    }
    return () => {};
  };

  return {
    setMousePassthrough: (options) => safeInvoke(bridge?.setMousePassthrough, options),
    onSetActiveTree: subscribe,
    requestLibraryRefresh: () => safeInvoke(bridge?.requestLibraryRefresh),
    extractKeyword: (payload) => safeInvoke(bridge?.extractKeyword, payload),
    log: (level, event, context) => {
      safeInvoke(bridge?.log, level, event, context);
    },
    windowControls: {
      maximize: () => safeInvoke(bridge?.windowControls?.maximize),
      close: () => safeInvoke(bridge?.windowControls?.close),
    },
    toggleWindow: () => safeInvoke(bridge?.toggleWindow),
  };
};

export default createTreeWidgetBridge;
