import {
  fetchFolders as legacyFetchFolders,
  createFolder as legacyCreateFolder,
  updateFolder as legacyUpdateFolder,
  deleteFolder as legacyDeleteFolder,
} from 'services/supabaseTrees';

/**
 * FolderRepository는 폴더 관련 Supabase 연동을 캡슐화한다.
 * 현재는 기존 `services/supabaseTrees` 구현에 위임하며 점진적으로 쿼리를 이전할 예정이다.
 */
export const fetchFolders = async (userId) => legacyFetchFolders(userId);

export const createFolder = async ({ name, parentId, userId }) => legacyCreateFolder({ name, parentId, userId });

export const updateFolder = async ({ folderId, name, userId }) => legacyUpdateFolder({ folderId, name, userId });

export const deleteFolder = async ({ folderId, userId }) => legacyDeleteFolder({ folderId, userId });

export default {
  fetchFolders,
  createFolder,
  updateFolder,
  deleteFolder,
};
