import { createTreeForUser, openWidgetForTree } from 'services/treeCreation';
import { fetchTreesWithNodes } from 'services/supabaseTrees';

const ensureWindow = () => (typeof window !== 'undefined' ? window : undefined);

const invokeJarvis = (method, ...args) => {
  const w = ensureWindow();
  const target = w?.jarvisAPI?.[method];
  if (typeof target === 'function') {
    return target(...args);
  }
  return undefined;
};

export const loadRecentTrees = async ({ userId, limit = 2 }) => {
  if (!userId) {
    return [];
  }
  const trees = await fetchTreesWithNodes(userId);
  if (!Array.isArray(trees)) {
    return [];
  }
  return trees.slice(0, limit);
};

export const createAndOpenTree = async ({ userId }) => {
  if (!userId) {
    return null;
  }
  const newTree = await createTreeForUser({ userId });
  await openWidgetForTree({ treeId: newTree.id, fresh: true });
  invokeJarvis('requestLibraryRefresh');
  return newTree;
};

export const openExistingTree = async ({ treeId }) => {
  if (!treeId) {
    return;
  }
  await openWidgetForTree({ treeId, fresh: false });
};

export const showLibraryWindow = async () => {
  await invokeJarvis('showLibrary');
};

export const closePanel = () => {
  invokeJarvis('closeAdminPanel');
};

export const logWarning = (eventKey, payload = {}) => {
  invokeJarvis('log', 'warn', eventKey, payload);
};
