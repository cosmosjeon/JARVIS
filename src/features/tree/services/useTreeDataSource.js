import { useCallback, useMemo } from 'react';
import {
  fetchTreeSummaries,
  fetchTreeWithNodesById,
  upsertTreeMetadata,
  upsertTreeNodes,
  deleteTree,
} from 'infrastructure/supabase/services/treeService';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';

/**
 * Supabase tree service wrappers.
 *
 * | Function              | Source export                | Responsibility                          |
 * | --------------------- | ---------------------------- | --------------------------------------- |
 * | loadTreeSummaries     | fetchTreeSummaries           | 사용자별 트리 메타데이터 목록 로드           |
 * | loadTreeById          | fetchTreeWithNodesById       | 단일 트리 노드 데이터 로드                  |
 * | saveTreeNodes         | upsertTreeNodes              | 노드 컬렉션을 Supabase에 일괄 저장            |
 * | saveTreeMetadata      | upsertTreeMetadata           | 트리 메타데이터(제목 등)를 사용자 ID와 함께 저장 |
 */
export const useTreeDataSource = (overrides = {}) => {
  const { user } = useSupabaseAuth();
  const userId = overrides.userId ?? user?.id ?? null;

  const loadTreeSummaries = useCallback(async () => {
    if (!userId) {
      return [];
    }
    return fetchTreeSummaries(userId);
  }, [userId]);

  const loadTreeById = useCallback(async (treeId) => {
    if (!userId) {
      return null;
    }
    if (!treeId) {
      throw new Error('loadTreeById requires a treeId');
    }
    return fetchTreeWithNodesById({ treeId, userId });
  }, [userId]);

  const saveTreeMetadata = useCallback(async ({ treeId, title }) => {
    if (!userId) {
      return null;
    }
    if (!treeId) {
      throw new Error('saveTreeMetadata requires a treeId');
    }
    return upsertTreeMetadata({ treeId, title, userId });
  }, [userId]);

  const saveTreeNodes = useCallback(async ({ treeId, nodes }) => {
    if (!userId) {
      return null;
    }
    if (!treeId) {
      throw new Error('saveTreeNodes requires a treeId');
    }
    if (!Array.isArray(nodes)) {
      throw new Error('saveTreeNodes requires nodes to be an array');
    }
    return upsertTreeNodes({ treeId, nodes, userId });
  }, [userId]);

  const removeTree = useCallback(async (treeId) => {
    if (!userId) {
      return null;
    }
    if (!treeId) {
      throw new Error('removeTree requires a treeId');
    }
    return deleteTree({ treeId });
  }, [userId]);

  return useMemo(() => ({
    userId,
    loadTreeSummaries,
    loadTreeById,
    loadTrees: loadTreeSummaries,
    saveTreeMetadata,
    saveTreeNodes,
    removeTree,
  }), [userId, loadTreeSummaries, loadTreeById, saveTreeMetadata, saveTreeNodes, removeTree]);
};

export default useTreeDataSource;
