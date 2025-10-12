const STORAGE_KEY = 'jarvis.nodeTitlePreferences';

const memoryCache = new Map();
let hydrated = false;

const toTrimmed = (value) => (typeof value === 'string' ? value.trim() : '');

const ensureTreeEntry = (treeId) => {
  if (!memoryCache.has(treeId)) {
    memoryCache.set(treeId, new Map());
  }
  return memoryCache.get(treeId);
};

const readFromStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
};

const writeToStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload = {};
    memoryCache.forEach((nodeMap, treeId) => {
      if (!treeId || !(nodeMap instanceof Map)) {
        return;
      }
      const nodesPayload = {};
      nodeMap.forEach((value, nodeId) => {
        if (!nodeId || !value || typeof value !== 'object') {
          return;
        }
        nodesPayload[nodeId] = {
          manual: value.manual === true,
          title: toTrimmed(value.title) || undefined,
        };
      });
      if (Object.keys(nodesPayload).length > 0) {
        payload[treeId] = nodesPayload;
      }
    });

    if (Object.keys(payload).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // ignore persistence errors
  }
};

const ensureHydrated = () => {
  if (hydrated) {
    return;
  }

  const snapshot = readFromStorage();
  if (snapshot && typeof snapshot === 'object') {
    Object.entries(snapshot).forEach(([treeId, nodes]) => {
      if (!treeId || !nodes || typeof nodes !== 'object') {
        return;
      }
      const nodeMap = ensureTreeEntry(treeId);
      Object.entries(nodes).forEach(([nodeId, value]) => {
        if (!nodeId || !value || typeof value !== 'object') {
          return;
        }
        nodeMap.set(nodeId, {
          manual: value.manual === true,
          title: toTrimmed(value.title) || null,
        });
      });
    });
  }

  hydrated = true;
};

const setPreference = (treeId, nodeId, preference) => {
  if (!treeId || !nodeId) {
    return;
  }

  ensureHydrated();
  const nodeMap = ensureTreeEntry(treeId);

  if (!preference) {
    nodeMap.delete(nodeId);
    writeToStorage();
    return;
  }

  const nextPreference = {
    manual: preference.manual === true,
    title: toTrimmed(preference.title) || null,
  };

  const existing = nodeMap.get(nodeId);
  if (existing && existing.manual === nextPreference.manual && existing.title === nextPreference.title) {
    return;
  }

  nodeMap.set(nodeId, nextPreference);
  writeToStorage();
};

const getPreference = (treeId, nodeId) => {
  if (!treeId || !nodeId) {
    return { manual: false, title: null };
  }

  ensureHydrated();
  const nodeMap = memoryCache.get(treeId);
  if (!nodeMap) {
    return { manual: false, title: null };
  }
  return nodeMap.get(nodeId) || { manual: false, title: null };
};

export const isNodeTitleManual = (treeId, nodeId) => getPreference(treeId, nodeId).manual === true;

export const markNodeTitleManual = (treeId, nodeId, title) => {
  setPreference(treeId, nodeId, { manual: true, title });
};

export const markNodeTitleAuto = (treeId, nodeId, title) => {
  setPreference(treeId, nodeId, { manual: false, title });
};

export const clearNodeTitlePreference = (treeId, nodeId) => {
  setPreference(treeId, nodeId, null);
};

export default {
  isNodeTitleManual,
  markNodeTitleManual,
  markNodeTitleAuto,
  clearNodeTitlePreference,
};
