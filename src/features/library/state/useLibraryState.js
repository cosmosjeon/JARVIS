import { useMemo, useReducer } from 'react';

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
};

const initialState = {
  trees: [],
  folders: [],
  selectedTreeId: null,
  selectedFolderId: null,
  expandedFolders: new Set(),
  loading: true,
  foldersLoading: true,
  error: null,
  selectedNode: null,
  navSelectedIds: [],
  draggedTreeIds: [],
  dragOverFolderId: null,
  dragOverVoranBox: false,
  showVoranBoxManager: false,
  showCreateDialog: false,
  createType: 'folder',
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
    default:
      return state;
  }
};

const buildActions = (dispatch) => ({
  setTrees: (trees) => dispatch({ type: ACTIONS.SET_TREES, payload: trees }),
  setFolders: (folders) => dispatch({ type: ACTIONS.SET_FOLDERS, payload: folders }),
  setLoading: (value) => dispatch({ type: ACTIONS.SET_LOADING, payload: value }),
  setFoldersLoading: (value) => dispatch({ type: ACTIONS.SET_FOLDERS_LOADING, payload: value }),
  setError: (value) => dispatch({ type: ACTIONS.SET_ERROR, payload: value }),
  setSelectedTreeId: (value) => dispatch({ type: ACTIONS.SET_SELECTED_TREE, payload: value }),
  setSelectedFolderId: (value) => dispatch({ type: ACTIONS.SET_SELECTED_FOLDER, payload: value }),
  setExpandedFolders: (value) => dispatch({ type: ACTIONS.SET_EXPANDED_FOLDERS, payload: value }),
  setSelectedNode: (value) => dispatch({ type: ACTIONS.SET_SELECTED_NODE, payload: value }),
  setNavSelectedIds: (value) => dispatch({ type: ACTIONS.SET_NAV_SELECTED_IDS, payload: value }),
  setDraggedTreeIds: (value) => dispatch({ type: ACTIONS.SET_DRAGGED_TREE_IDS, payload: value }),
  setDragOverFolderId: (value) => dispatch({ type: ACTIONS.SET_DRAG_OVER_FOLDER, payload: value }),
  setDragOverVoranBox: (value) => dispatch({ type: ACTIONS.SET_DRAG_OVER_VORAN, payload: value }),
  setShowVoranBoxManager: (value) => dispatch({ type: ACTIONS.SET_SHOW_VORAN_BOX, payload: value }),
  setShowCreateDialog: (value) => dispatch({ type: ACTIONS.SET_SHOW_CREATE_DIALOG, payload: value }),
  setCreateType: (value) => dispatch({ type: ACTIONS.SET_CREATE_TYPE, payload: value }),
});

export const useLibraryState = (overrides = {}) => {
  const [state, dispatch] = useReducer(reducer, { ...initialState, ...overrides });

  const actions = useMemo(() => buildActions(dispatch), [dispatch]);

  return {
    state,
    actions,
  };
};

export default useLibraryState;
