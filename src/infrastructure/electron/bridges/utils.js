const NOOP = () => {};

export const once = (fn) => {
  let called = false;
  return (...args) => {
    if (called) {
      return undefined;
    }
    called = true;
    if (typeof fn !== 'function') {
      return undefined;
    }
    return fn(...args);
  };
};

export const ensureRendererBridge = (bridge) => {
  if (bridge) {
    return bridge;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  return window.jarvisAPI || null;
};

export const safeInvoke = (fn, ...args) => {
  if (typeof fn !== 'function') {
    return null;
  }
  try {
    return fn(...args);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[electron-bridge] invoke failed', error);
    }
    return null;
  }
};

export const createSubscription = (registerFn, listener) => {
  if (typeof listener !== 'function') {
    return NOOP;
  }
  const unsubscribe = safeInvoke(registerFn, listener);
  if (typeof unsubscribe === 'function') {
    return once(unsubscribe);
  }
  return NOOP;
};

export const NOOP_UNSUBSCRIBE = NOOP;
