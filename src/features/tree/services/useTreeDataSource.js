import { useCallback, useMemo } from 'react';
import {
  fetchTreesWithNodes,
  upsertTreeMetadata,
  upsertTreeNodes,
} from 'services/supabaseTrees';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';

/**
 * Supabase tree service wrappers.
 *
 * | Function            | Source export           | Responsibility                          |
 * | ------------------- | ----------------------- | --------------------------------------- |
 * | loadTrees           | fetchTreesWithNodes     | 사용자별 트리 목록 + 노드 데이터 로드          |
 * | saveTreeNodes       | upsertTreeNodes         | 노드 컬렉션을 Supabase에 일괄 저장            |
 * | saveTreeMetadata    | upsertTreeMetadata      | 트리 메타데이터(제목 등)를 사용자 ID와 함께 저장 |
 */
export const useTreeDataSource = (overrides = {}) => {
  const { user } = useSupabaseAuth();
  const userId = overrides.userId ?? user?.id ?? null;

  const loadTrees = useCallback(async () => {
    if (!userId) {
      return [];
    }
    return fetchTreesWithNodes(userId);
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

  return useMemo(() => ({
    userId,
    loadTrees,
    saveTreeMetadata,
    saveTreeNodes,
  }), [userId, loadTrees, saveTreeMetadata, saveTreeNodes]);
};

export default useTreeDataSource;
