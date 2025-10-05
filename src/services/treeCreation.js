import { generateTreeId, upsertTreeMetadata } from './supabaseTrees';
import { createTreeWidgetBridge } from '../infrastructure/electron/bridges';

const DEFAULT_TITLE = '새 지식 트리';

// 빈 트리 추적을 위한 전역 상태
const emptyTreeTracker = new Map();

// 빈 트리인지 확인하는 함수
export const isEmptyTree = (tree) => {
  if (!tree || !tree.treeData) return true;
  const { nodes = [], links = [] } = tree.treeData;
  
  // 노드가 없거나, 노드가 있어도 모두 빈 노드인 경우
  if (nodes.length === 0) return true;
  
  // 모든 노드가 빈 노드인지 확인 (keyword, questionData, content가 모두 없는 경우)
  const hasContent = nodes.some(node => {
    return node.keyword || 
           node.questionData?.question || 
           node.content || 
           (node.children && node.children.length > 0);
  });
  
  return !hasContent;
};

// 빈 트리 추적 시작
export const trackEmptyTree = (treeId) => {
  emptyTreeTracker.set(treeId, {
    createdAt: Date.now(),
    isTracked: true
  });
};

// 빈 트리 추적 중지
export const stopTrackingEmptyTree = (treeId) => {
  emptyTreeTracker.delete(treeId);
};

// 추적 중인 빈 트리인지 확인
export const isTrackingEmptyTree = (treeId) => {
  return emptyTreeTracker.has(treeId);
};

// 추적 중인 모든 빈 트리 ID 반환
export const getTrackedEmptyTrees = () => {
  return Array.from(emptyTreeTracker.keys());
};

// 빈 트리 정리 함수
export const cleanupEmptyTrees = async (trees = []) => {
  const { deleteTree } = await import('./supabaseTrees');
  const trackedTreeIds = getTrackedEmptyTrees();
  const treesToDelete = [];

  for (const treeId of trackedTreeIds) {
    const tree = trees.find(t => t.id === treeId);
    if (tree && isEmptyTree(tree)) {
      treesToDelete.push(treeId);
    }
  }

  // 빈 트리들 삭제
  for (const treeId of treesToDelete) {
    try {
      await deleteTree(treeId);
      stopTrackingEmptyTree(treeId);
      console.log(`빈 트리 삭제됨: ${treeId}`);
    } catch (error) {
      console.error(`빈 트리 삭제 실패: ${treeId}`, error);
    }
  }

  return treesToDelete.length;
};

export const createTreeForUser = async ({ userId, title = DEFAULT_TITLE } = {}) => {
  if (!userId) {
    throw new Error('userId가 필요합니다.');
  }

  const treeId = generateTreeId();
  const now = Date.now();

  await upsertTreeMetadata({ treeId, title, userId });

  // 새 트리 생성 시 빈 트리 추적 시작
  trackEmptyTree(treeId);

  return {
    id: treeId,
    title,
    treeData: { nodes: [], links: [] },
    createdAt: now,
    updatedAt: now,
  };
};

const resolveTreeBridge = (bridgeOverride) => createTreeWidgetBridge(bridgeOverride);

export const openWidgetForTree = async ({ treeId, fresh = true, bridge } = {}) => {
  if (!treeId) {
    return { success: false };
  }

  const payload = {
    treeId,
    reusePrimary: false,
    fresh,
  };

  const treeBridge = resolveTreeBridge(bridge);

  try {
    const widgetResult = await treeBridge.openWidget?.(payload);
    if (widgetResult) {
      if (typeof widgetResult === 'object' && 'success' in widgetResult) {
        if (widgetResult.success) {
          return { ...widgetResult, success: true };
        }
      } else {
        return { success: true, result: widgetResult };
      }
    }

    const toggleResult = treeBridge.toggleWindow?.();
    if (toggleResult !== null) {
      return { success: true, result: toggleResult };
    }

    if (typeof window === 'undefined') {
      return { success: false };
    }

    const runningInElectron = /Electron/i.test(window.navigator?.userAgent || '')
      || Boolean(window.process?.versions?.electron);

    if (runningInElectron) {
      const error = new Error('Expected electron widget bridge to handle openWidget/toggleWindow.');
      error.code = 'WIDGET_BRIDGE_UNAVAILABLE';
      treeBridge.log?.('error', 'widget_open_bridge_missing', { message: error.message, treeId });
      return { success: false, error };
    }

    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'widget');
    url.searchParams.set('treeId', treeId);
    url.searchParams.set('fresh', fresh ? '1' : '0');
    window.open(url.toString(), '_blank', 'noopener');
    return { success: true };
  } catch (error) {
    treeBridge.log?.('error', 'admin_panel_open_widget_failed', { message: error?.message, treeId });
    return { success: false, error };
  }
};
