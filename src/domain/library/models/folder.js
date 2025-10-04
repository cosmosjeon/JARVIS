const DEFAULT_FOLDER_NAME = '새 폴더';

/**
 * @typedef {Object} LibraryFolder
 * @property {string} id
 * @property {string} name
 * @property {string|null} parentId
 * @property {number|string|null} createdAt
 * @property {number|string|null} updatedAt
 */

/**
 * Supabase 폴더 레코드를 라이브러리 도메인 모델로 매핑한다.
 * @param {Object} raw
 * @returns {LibraryFolder}
 */
export const mapToLibraryFolder = (raw = {}) => {
  const id = typeof raw.id === 'string' ? raw.id : String(raw.id || '') || `folder_${Date.now()}`;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : DEFAULT_FOLDER_NAME;

  return {
    id,
    name,
    parentId: raw.parentId ?? raw.parent_id ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
  };
};

export default {
  mapToLibraryFolder,
};
