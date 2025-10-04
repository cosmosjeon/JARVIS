import {
  fetchTreesWithNodes as legacyFetchTreesWithNodes,
  upsertTreeMetadata as legacyUpsertTreeMetadata,
  deleteTree as legacyDeleteTree,
  deleteNodes as legacyDeleteNodes,
  moveTreeToFolder as legacyMoveTreeToFolder,
} from 'services/supabaseTrees';

/**
 * TreeRepository는 Supabase 연동 로직을 한곳에 모아두기 위한 얇은 어댑터입니다.
 * 현재는 기존 `services/supabaseTrees` 함수에 위임하며, 추후 실제 쿼리가 이 모듈로 이전될 예정입니다.
 */
export const fetchTreesWithNodes = async (userId) => legacyFetchTreesWithNodes(userId);

export const upsertTreeMetadata = async ({ treeId, title, userId }) => legacyUpsertTreeMetadata({ treeId, title, userId });

export const deleteTree = async ({ treeId }) => legacyDeleteTree(treeId);

export const deleteNodes = async ({ nodeIds, userId }) => legacyDeleteNodes({ nodeIds, userId });

export const moveTreeToFolder = async ({ treeId, folderId, userId }) => legacyMoveTreeToFolder({ treeId, folderId, userId });

export default {
  fetchTreesWithNodes,
  upsertTreeMetadata,
  deleteTree,
  deleteNodes,
  moveTreeToFolder,
};
