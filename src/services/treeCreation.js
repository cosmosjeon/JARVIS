import { generateTreeId, upsertTreeMetadata } from './supabaseTrees';

const DEFAULT_TITLE = '새 지식 트리';

export const createTreeForUser = async ({ userId, title = DEFAULT_TITLE } = {}) => {
  if (!userId) {
    throw new Error('userId가 필요합니다.');
  }

  const treeId = generateTreeId();
  const now = Date.now();

  await upsertTreeMetadata({ treeId, title, userId });

  return {
    id: treeId,
    title,
    treeData: { nodes: [], links: [] },
    createdAt: now,
    updatedAt: now,
  };
};

export const openWidgetForTree = async ({ treeId, fresh = true } = {}) => {
  if (!treeId) {
    return { success: false };
  }

  if (typeof window === 'undefined') {
    return { success: false };
  }

  const payload = {
    treeId,
    reusePrimary: false,
    fresh,
  };

  try {
    if (window.jarvisAPI?.openWidget) {
      await window.jarvisAPI.openWidget(payload);
      return { success: true };
    }

    if (window.jarvisAPI?.toggleWindow) {
      window.jarvisAPI.toggleWindow();
      return { success: true };
    }

    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'widget');
    url.searchParams.set('treeId', treeId);
    url.searchParams.set('fresh', fresh ? '1' : '0');
    window.open(url.toString(), '_blank', 'noopener');
    return { success: true };
  } catch (error) {
    window.jarvisAPI?.log?.('error', 'admin_panel_open_widget_failed', { message: error?.message, treeId });
    return { success: false, error };
  }
};
