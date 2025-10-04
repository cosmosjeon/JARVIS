import { useCallback, useState } from 'react';

const sanitizeTreePayload = (payload = {}) => ({
  nodes: Array.isArray(payload?.nodes) ? payload.nodes : [],
  links: Array.isArray(payload?.links) ? payload.links : [],
});

/**
 * 트리 데이터와 관련 상태를 관리하는 훅.
 *
 * 반환 API는 다음과 같다.
 * - `nodes`: 현재 트리 노드 배열
 * - `links`: 현재 트리 링크 배열
 * - `setActiveTreeId(treeId)`: 활성 트리 ID 갱신
 * - `loadTree(treeData)`: `{ nodes, links }` 형태 입력으로 상태 초기화
 */
export const useTreeState = (initialData) => {
  const [data, setData] = useState(() => sanitizeTreePayload(initialData));
  const [activeTreeId, setActiveTreeId] = useState(null);
  const [initializingTree, setInitializingTree] = useState(false);
  const [treeSyncError, setTreeSyncError] = useState(null);
  const [isTreeSyncing, setIsTreeSyncing] = useState(false);

  const loadTree = useCallback((payload) => {
    setData(sanitizeTreePayload(payload));
  }, []);

  return {
    data,
    nodes: data.nodes,
    links: data.links,
    setData,
    loadTree,
    activeTreeId,
    setActiveTreeId,
    initializingTree,
    setInitializingTree,
    treeSyncError,
    setTreeSyncError,
    isTreeSyncing,
    setIsTreeSyncing,
  };
};

export default useTreeState;
