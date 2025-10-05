import { ensureRendererBridge, safeInvoke } from './utils';

/**
 * @param {import('../types').AgentBridge|any} bridge
 * @returns {import('../types').AgentBridge}
 */
export const createAgentBridge = (bridge) => {
  let cachedBridge = bridge;

  const resolveBridge = () => {
    const next = ensureRendererBridge(cachedBridge);
    if (next) {
      cachedBridge = next;
    }
    return cachedBridge;
  };

  return {
    askRoot: (payload) => {
      const target = resolveBridge();
      return safeInvoke(target?.askRoot, payload);
    },
    askChild: (payload) => {
      const target = resolveBridge();
      return safeInvoke(target?.askChild, payload);
    },
    extractKeyword: (payload) => {
      const target = resolveBridge();
      return safeInvoke(target?.extractKeyword, payload);
    },
  };
};

export default createAgentBridge;
