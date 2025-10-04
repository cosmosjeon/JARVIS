import {
  fetchTreesWithNodes,
  upsertTreeMetadata,
  deleteTree,
  deleteNodes,
  moveTreeToFolder,
} from 'infrastructure/supabase/repositories/treeRepository';
import {
  fetchFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} from 'infrastructure/supabase/repositories/folderRepository';
import { mapToLibraryTree } from 'domain/library/models/tree';
import { mapToLibraryFolder } from 'domain/library/models/folder';

const EMPTY_ARRAY = Object.freeze([]);

const ensureUserId = (userId) => {
  if (typeof userId !== 'string' || !userId.trim()) {
    return null;
  }
  return userId.trim();
};

/**
 * LibraryRepository: 라이브러리 화면을 위한 Supabase 연동 어댑터.
 *
 * | Method | Responsibility | Delegates |
 * | --- | --- | --- |
 * | `loadTrees(userId)` | 사용자 트리 목록 + 노드 로드 | `fetchTreesWithNodes` |
 * | `loadFolders(userId)` | 폴더 목록 로드 | `fetchFolders` |
 * | `createLibraryFolder(params)` | 새 폴더 생성 | `createFolder` |
 * | `renameLibraryFolder(params)` | 폴더명 수정 | `updateFolder` |
 * | `removeLibraryFolder(params)` | 폴더 삭제 | `deleteFolder` |
 * | `assignTreeToFolder(params)` | 트리를 폴더에 연결 | `moveTreeToFolder` |
 * | `removeTree(params)` | 트리 삭제 | `deleteTree` |
 * | `removeNodes(params)` | 노드 일괄 삭제 | `deleteNodes` |
 * | `saveTreeMetadata(params)` | 트리 메타데이터 저장 | `upsertTreeMetadata` |
 */
export const loadTrees = async (userId) => {
  const normalizedUserId = ensureUserId(userId);
  if (!normalizedUserId) {
    return EMPTY_ARRAY;
  }
  const trees = await fetchTreesWithNodes(normalizedUserId);
  return Array.isArray(trees) ? trees.map(mapToLibraryTree) : EMPTY_ARRAY;
};

export const loadFolders = async (userId) => {
  const normalizedUserId = ensureUserId(userId);
  if (!normalizedUserId) {
    return EMPTY_ARRAY;
  }
  const folders = await fetchFolders(normalizedUserId);
  return Array.isArray(folders) ? folders.map(mapToLibraryFolder) : EMPTY_ARRAY;
};

export const saveTreeMetadata = async ({ treeId, title, userId }) => {
  const normalizedUserId = ensureUserId(userId);
  if (!normalizedUserId) {
    return null;
  }
  return upsertTreeMetadata({ treeId, title, userId: normalizedUserId });
};

export const removeTree = async ({ treeId }) => {
  if (!treeId) {
    return null;
  }
  return deleteTree({ treeId });
};

export const removeNodes = async ({ nodeIds, userId }) => {
  const normalizedUserId = ensureUserId(userId);
  if (!normalizedUserId || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    return null;
  }
  return deleteNodes({ nodeIds, userId: normalizedUserId });
};

export const assignTreeToFolder = async ({ treeId, folderId, userId }) => {
  const normalizedUserId = ensureUserId(userId);
  if (!normalizedUserId) {
    return null;
  }
  return moveTreeToFolder({ treeId, folderId, userId: normalizedUserId });
};

export const createLibraryFolder = async ({ name, parentId, userId }) => {
  const normalizedUserId = ensureUserId(userId);
  if (!normalizedUserId) {
    return null;
  }
  const folder = await createFolder({ name, parentId, userId: normalizedUserId });
  return mapToLibraryFolder(folder);
};

export const renameLibraryFolder = async ({ folderId, name, userId }) => {
  const normalizedUserId = ensureUserId(userId);
  if (!normalizedUserId) {
    return null;
  }
  const folder = await updateFolder({ folderId, name, userId: normalizedUserId });
  return mapToLibraryFolder(folder);
};

export const removeLibraryFolder = async ({ folderId, userId }) => {
  const normalizedUserId = ensureUserId(userId);
  if (!normalizedUserId) {
    return null;
  }
  await deleteFolder({ folderId, userId: normalizedUserId });
  return true;
};

export default {
  loadTrees,
  loadFolders,
  saveTreeMetadata,
  removeTree,
  removeNodes,
  assignTreeToFolder,
  createLibraryFolder,
  renameLibraryFolder,
  removeLibraryFolder,
};
