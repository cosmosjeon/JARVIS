const EMPTY_ARRAY = Object.freeze([]);

/**
 * @typedef {Object} LibraryTreeNode
 * @property {string} id
 * @property {string|null} [parentId]
 * @property {string|null} [keyword]
 * @property {string|null} [fullText]
 * @property {string|null} [status]
 * @property {Array<Object>} [conversation]
 * @property {number|null} [level]
 * @property {number|null} [size]
 * @property {number|string|null} [createdAt]
 * @property {number|string|null} [updatedAt]
 */

/**
 * @typedef {Object} LibraryTreeLink
 * @property {string|Object} source
 * @property {string|Object} target
 * @property {number} [value]
 * @property {string} [relationship]
 */

/**
 * @typedef {Object} LibraryTreeData
 * @property {LibraryTreeNode[]} nodes
 * @property {LibraryTreeLink[]} links
 */

/**
 * @typedef {Object} LibraryTree
 * @property {string} id
 * @property {string} title
 * @property {LibraryTreeData} treeData
 * @property {number|string|null} createdAt
 * @property {number|string|null} updatedAt
 * @property {string|null} folderId
 */

const coerceArray = (value) => (Array.isArray(value) ? value : EMPTY_ARRAY);

const cloneArray = (value) => coerceArray(value).map((item) => ({ ...item }));

/**
 * Supabase에서 가져온 트리 레코드를 라이브러리 도메인 모델로 매핑한다.
 * @param {Object} raw
 * @returns {LibraryTree}
 */
export const mapToLibraryTree = (raw = {}) => {
  const id = typeof raw.id === 'string' ? raw.id : String(raw.id || '') || `tree_${Date.now()}`;
  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim()
    : '제목 없는 트리';

  const treeDataSource = raw.treeData || raw.treedata || {};

  return {
    id,
    title,
    treeData: {
      nodes: cloneArray(treeDataSource.nodes),
      links: cloneArray(treeDataSource.links),
    },
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    folderId: raw.folderId ?? raw.folder_id ?? null,
  };
};

/**
 * 빈 트리 모델을 반환한다.
 * @param {Partial<LibraryTree>} [overrides]
 * @returns {LibraryTree}
 */
export const createEmptyLibraryTree = (overrides = {}) => ({
  id: overrides.id || `tree_${Date.now()}`,
  title: overrides.title || '제목 없는 트리',
  treeData: {
    nodes: overrides.treeData?.nodes ? cloneArray(overrides.treeData.nodes) : EMPTY_ARRAY,
    links: overrides.treeData?.links ? cloneArray(overrides.treeData.links) : EMPTY_ARRAY,
  },
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
  folderId: overrides.folderId ?? null,
});

export default {
  mapToLibraryTree,
  createEmptyLibraryTree,
};
