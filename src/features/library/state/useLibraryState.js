import { useMemo, useReducer } from 'react';

const EMPTY_ARRAY = Object.freeze([]);

const ACTIONS = {
  SET_TREES: 'setTrees',
  SET_FOLDERS: 'setFolders',
  SET_LOADING: 'setLoading',
  SET_FOLDERS_LOADING: 'setFoldersLoading',
  SET_ERROR: 'setError',
  SET_SELECTED_TREE: 'setSelectedTree',
  SET_SELECTED_FOLDER: 'setSelectedFolder',
  SET_EXPANDED_FOLDERS: 'setExpandedFolders',
  SET_SELECTED_NODE: 'setSelectedNode',
  SET_NAV_SELECTED_IDS: 'setNavSelectedIds',
  SET_DRAGGED_TREE_IDS: 'setDraggedTreeIds',
  SET_DRAG_OVER_FOLDER: 'setDragOverFolder',
  SET_DRAG_OVER_VORAN: 'setDragOverVoran',
  SET_SHOW_VORAN_BOX: 'setShowVoranBox',
  SET_SHOW_CREATE_DIALOG: 'setShowCreateDialog',
  SET_CREATE_TYPE: 'setCreateType',
  SET_SIDEBAR_COLLAPSED: 'setSidebarCollapsed',
  SET_QA_PANEL_VISIBLE: 'setQAPanelVisible',
  SET_LIBRARY_INTRO_TREE_ID: 'setLibraryIntroTreeId',
  SET_SHOW_SETTINGS_DIALOG: 'setShowSettingsDialog',
};

const BASE_STATE = {
  trees: EMPTY_ARRAY,
  folders: EMPTY_ARRAY,
  selectedTreeId: null,
  selectedFolderId: null,
  loading: true,
  foldersLoading: true,
  error: null,
  selectedNode: null,
  navSelectedIds: EMPTY_ARRAY,
  draggedTreeIds: EMPTY_ARRAY,
  dragOverFolderId: null,
  dragOverVoranBox: false,
  showVoranBoxManager: false,
  showCreateDialog: false,
  createType: 'folder',
  isSidebarCollapsed: false,
  isQAPanelVisible: false,
  libraryIntroTreeId: null,
  showSettingsDialog: false,
};

const createInitialState = (overrides = {}) => {
  const {
    trees,
    folders,
    expandedFolders,
    navSelectedIds,
    draggedTreeIds,
    ...rest
  } = overrides;

  return {
    ...BASE_STATE,
    ...rest,
    trees: Array.isArray(trees) ? trees : BASE_STATE.trees,
    folders: Array.isArray(folders) ? folders : BASE_STATE.folders,
    navSelectedIds: Array.isArray(navSelectedIds) ? navSelectedIds : BASE_STATE.navSelectedIds,
    draggedTreeIds: Array.isArray(draggedTreeIds) ? draggedTreeIds : BASE_STATE.draggedTreeIds,
    expandedFolders: expandedFolders instanceof Set
      ? new Set(expandedFolders)
      : new Set(Array.isArray(expandedFolders) ? expandedFolders : []),
  };
};

const resolveNext = (payload, previous) => (
  typeof payload === 'function' ? payload(previous) : payload
);

const reducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_TREES:
      return { ...state, trees: resolveNext(action.payload, state.trees) };
    case ACTIONS.SET_FOLDERS:
      return { ...state, folders: resolveNext(action.payload, state.folders) };
    case ACTIONS.SET_LOADING:
      return { ...state, loading: resolveNext(action.payload, state.loading) };
    case ACTIONS.SET_FOLDERS_LOADING:
      return { ...state, foldersLoading: resolveNext(action.payload, state.foldersLoading) };
    case ACTIONS.SET_ERROR:
      return { ...state, error: resolveNext(action.payload, state.error) };
    case ACTIONS.SET_SELECTED_TREE:
      return { ...state, selectedTreeId: resolveNext(action.payload, state.selectedTreeId) };
    case ACTIONS.SET_SELECTED_FOLDER:
      return { ...state, selectedFolderId: resolveNext(action.payload, state.selectedFolderId) };
    case ACTIONS.SET_EXPANDED_FOLDERS:
      return { ...state, expandedFolders: resolveNext(action.payload, state.expandedFolders) };
    case ACTIONS.SET_SELECTED_NODE:
      return { ...state, selectedNode: resolveNext(action.payload, state.selectedNode) };
    case ACTIONS.SET_NAV_SELECTED_IDS:
      return { ...state, navSelectedIds: resolveNext(action.payload, state.navSelectedIds) };
    case ACTIONS.SET_DRAGGED_TREE_IDS:
      return { ...state, draggedTreeIds: resolveNext(action.payload, state.draggedTreeIds) };
    case ACTIONS.SET_DRAG_OVER_FOLDER:
      return { ...state, dragOverFolderId: resolveNext(action.payload, state.dragOverFolderId) };
    case ACTIONS.SET_DRAG_OVER_VORAN:
      return { ...state, dragOverVoranBox: resolveNext(action.payload, state.dragOverVoranBox) };
    case ACTIONS.SET_SHOW_VORAN_BOX:
      return { ...state, showVoranBoxManager: resolveNext(action.payload, state.showVoranBoxManager) };
    case ACTIONS.SET_SHOW_CREATE_DIALOG:
      return { ...state, showCreateDialog: resolveNext(action.payload, state.showCreateDialog) };
    case ACTIONS.SET_CREATE_TYPE:
      return { ...state, createType: resolveNext(action.payload, state.createType) };
    case ACTIONS.SET_SIDEBAR_COLLAPSED:
      return { ...state, isSidebarCollapsed: resolveNext(action.payload, state.isSidebarCollapsed) };
    case ACTIONS.SET_QA_PANEL_VISIBLE:
      return { ...state, isQAPanelVisible: resolveNext(action.payload, state.isQAPanelVisible) };
    case ACTIONS.SET_LIBRARY_INTRO_TREE_ID:
      return { ...state, libraryIntroTreeId: resolveNext(action.payload, state.libraryIntroTreeId) };
    case ACTIONS.SET_SHOW_SETTINGS_DIALOG:
      return { ...state, showSettingsDialog: resolveNext(action.payload, state.showSettingsDialog) };
    default:
      return state;
  }
};

const buildActions = (dispatch) => {
  const dispatchAction = (type) => (payload) => dispatch({ type, payload });

  const setTrees = dispatchAction(ACTIONS.SET_TREES);
  const setFolders = dispatchAction(ACTIONS.SET_FOLDERS);
  const setLoading = dispatchAction(ACTIONS.SET_LOADING);
  const setFoldersLoading = dispatchAction(ACTIONS.SET_FOLDERS_LOADING);
  const setError = dispatchAction(ACTIONS.SET_ERROR);
  const setSelectedTreeId = dispatchAction(ACTIONS.SET_SELECTED_TREE);
  const setSelectedFolderId = dispatchAction(ACTIONS.SET_SELECTED_FOLDER);
  const setExpandedFolders = dispatchAction(ACTIONS.SET_EXPANDED_FOLDERS);
  const setSelectedNode = dispatchAction(ACTIONS.SET_SELECTED_NODE);
  const setNavSelectedIds = dispatchAction(ACTIONS.SET_NAV_SELECTED_IDS);
  const setDraggedTreeIds = dispatchAction(ACTIONS.SET_DRAGGED_TREE_IDS);
  const setDragOverFolderId = dispatchAction(ACTIONS.SET_DRAG_OVER_FOLDER);
  const setDragOverVoranBox = dispatchAction(ACTIONS.SET_DRAG_OVER_VORAN);
  const setShowVoranBoxManager = dispatchAction(ACTIONS.SET_SHOW_VORAN_BOX);
  const setShowCreateDialog = dispatchAction(ACTIONS.SET_SHOW_CREATE_DIALOG);
  const setCreateType = dispatchAction(ACTIONS.SET_CREATE_TYPE);
  const setSidebarCollapsed = dispatchAction(ACTIONS.SET_SIDEBAR_COLLAPSED);
  const setQAPanelVisible = dispatchAction(ACTIONS.SET_QA_PANEL_VISIBLE);
  const setLibraryIntroTreeId = dispatchAction(ACTIONS.SET_LIBRARY_INTRO_TREE_ID);
  const setShowSettingsDialog = dispatchAction(ACTIONS.SET_SHOW_SETTINGS_DIALOG);

  const toggleFolder = (folderId) => {
    if (!folderId) {
      return;
    }
    setExpandedFolders((previous) => {
      const next = new Set(previous);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const selectTree = (treeId, options = {}) => {
    const { folderId, navIds } = options;
    const nextTreeId = treeId ?? null;
    setSelectedTreeId(nextTreeId);
    if (typeof navIds !== 'undefined') {
      setNavSelectedIds(navIds);
    } else if (nextTreeId) {
      setNavSelectedIds([nextTreeId]);
    } else {
      setNavSelectedIds([]);
    }
    if (typeof folderId !== 'undefined') {
      setSelectedFolderId(folderId);
    }
  };

  const selectFolder = (folderId) => {
    setSelectedFolderId(folderId ?? null);
    setSelectedTreeId(null);
    setNavSelectedIds([]);
  };

  const clearTreeSelection = () => {
    setSelectedTreeId(null);
    setNavSelectedIds([]);
    setSelectedNode(null);
  };

  const resetDragState = () => {
    setDraggedTreeIds([]);
    setDragOverFolderId(null);
    setDragOverVoranBox(false);
  };

  const showVoranBox = () => setShowVoranBoxManager(true);
  const hideVoranBox = () => setShowVoranBoxManager(false);

  const openCreateDialog = (type = 'folder') => {
    setCreateType(type);
    setShowCreateDialog(true);
  };

  const closeCreateDialog = () => setShowCreateDialog(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((previous) => !previous);
  };

  const toggleQAPanel = () => {
    setQAPanelVisible((previous) => !previous);
  };

  const hideQAPanel = () => {
    setQAPanelVisible(false);
    setSelectedNode(null);
  };
  const showQAPanel = () => setQAPanelVisible(true);

  const startLibraryIntro = (treeId) => {
    if (!treeId) {
      return;
    }
    setLibraryIntroTreeId(treeId);
  };

  const clearLibraryIntro = (treeId) => {
    setLibraryIntroTreeId((previous) => {
      if (!previous) {
        return previous;
      }
      if (treeId && previous !== treeId) {
        return previous;
      }
      return null;
    });
  };

  const showSettingsDialog = () => setShowSettingsDialog(true);
  const hideSettingsDialog = () => setShowSettingsDialog(false);

  return {
    data: {
      setTrees,
      setFolders,
      setLoading,
      setFoldersLoading,
      setError,
    },
    selection: {
      selectTree,
      selectFolder,
      setSelectedNode,
      setNavSelectedIds,
      clearTreeSelection,
    },
    folder: {
      toggleFolder,
      setSelectedFolderId,
      setExpandedFolders,
    },
    drag: {
      setDraggedTreeIds,
      setDragOverFolderId,
      setDragOverVoranBox,
      resetDragState,
    },
    modal: {
      showVoranBox,
      hideVoranBox,
      openCreateDialog,
      closeCreateDialog,
      setShowCreateDialog,
      setCreateType,
      showSettingsDialog,
      hideSettingsDialog,
      setShowSettingsDialog,
    },
    layout: {
      setSidebarCollapsed,
      toggleSidebar,
      setQAPanelVisible,
      toggleQAPanel,
      hideQAPanel,
      showQAPanel,
    },
    flow: {
      startLibraryIntro,
      clearLibraryIntro,
      setLibraryIntroTreeId,
    },
  };
};

const buildSelectors = (state) => {
  const {
    selectedTreeId,
    selectedFolderId,
    trees,
    folders,
    expandedFolders,
    libraryIntroTreeId,
  } = state;

  const selectedTree = selectedTreeId
    ? trees.find((tree) => tree.id === selectedTreeId) ?? null
    : null;

  const selectedFolder = selectedFolderId
    ? folders.find((folder) => folder.id === selectedFolderId) ?? null
    : null;

  const treesByFolder = trees.reduce((acc, tree) => {
    const key = tree.folderId ?? null;
    if (!acc.has(key)) {
      acc.set(key, []);
    }
    acc.get(key).push(tree);
    return acc;
  }, new Map());

  const voranTrees = treesByFolder.get(null) ?? EMPTY_ARRAY;

  return {
    selectedTree,
    selectedFolder,
    voranTrees,
    getTreesByFolder: (folderId) => treesByFolder.get(folderId) ?? EMPTY_ARRAY,
    isFolderExpanded: (folderId) => expandedFolders.has(folderId),
    hasSelectedTree: Boolean(selectedTreeId),
    libraryIntroTreeId,
    isLibraryIntroActive: Boolean(libraryIntroTreeId),
    isLibraryIntroTree: (treeId) => Boolean(treeId && libraryIntroTreeId === treeId),
  };
};

export const useLibraryState = (overrides = {}) => {
  const [state, dispatch] = useReducer(reducer, overrides, createInitialState);

  const actions = useMemo(() => buildActions(dispatch), [dispatch]);
  const selectors = useMemo(() => buildSelectors(state), [state]);

  return {
    state,
    actions,
    selectors,
  };
};

export default useLibraryState;
