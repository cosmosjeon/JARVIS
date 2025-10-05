import { ensureRendererBridge, safeInvoke, createSubscription } from './utils';

/**
 * @param {import('../types').OAuthBridge|any} bridge
 * @returns {import('../types').OAuthBridge}
 */
export const createOAuthBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    onOAuthCallback: (listener) => {
      const target = resolveBridge();
      return createSubscription(target?.onOAuthCallback, listener);
    },
    getOAuthRedirect: (options) => {
      const target = resolveBridge();
      return safeInvoke(target?.getOAuthRedirect, options);
    },
    launchOAuth: (url) => {
      const target = resolveBridge();
      return safeInvoke(target?.launchOAuth, url);
    },
  };
};

export default createOAuthBridge;
