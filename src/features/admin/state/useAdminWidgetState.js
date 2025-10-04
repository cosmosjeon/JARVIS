import { useMemo, useReducer } from 'react';

const ACTIONS = {
  SET_CREATING: 'setCreating',
  SET_ERROR: 'setError',
  CLEAR_ERROR: 'clearError',
  SET_RECENT_TREES: 'setRecentTrees',
  SET_LOADING_TREES: 'setLoadingTrees',
};

const INITIAL_STATE = {
  creating: false,
  error: null,
  recentTrees: [],
  loadingTrees: false,
};

const reducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_CREATING:
      return { ...state, creating: Boolean(action.payload) };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload || null };
    case ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    case ACTIONS.SET_RECENT_TREES: {
      const trees = Array.isArray(action.payload) ? action.payload : [];
      return { ...state, recentTrees: trees };
    }
    case ACTIONS.SET_LOADING_TREES:
      return { ...state, loadingTrees: Boolean(action.payload) };
    default:
      return state;
  }
};

const buildActions = (dispatch) => {
  const setCreating = (value) => dispatch({ type: ACTIONS.SET_CREATING, payload: value });
  const setError = (value) => dispatch({ type: ACTIONS.SET_ERROR, payload: value });
  const clearError = () => dispatch({ type: ACTIONS.CLEAR_ERROR });
  const setRecentTrees = (value) => dispatch({ type: ACTIONS.SET_RECENT_TREES, payload: value });
  const setLoadingTrees = (value) => dispatch({ type: ACTIONS.SET_LOADING_TREES, payload: value });

  const beginCreate = () => {
    setCreating(true);
    clearError();
  };

  const endCreate = () => setCreating(false);

  return {
    setCreating,
    setError,
    clearError,
    setRecentTrees,
    setLoadingTrees,
    beginCreate,
    endCreate,
  };
};

const buildSelectors = (state) => ({
  hasError: Boolean(state.error),
  hasRecentTrees: Array.isArray(state.recentTrees) && state.recentTrees.length > 0,
});

export const useAdminWidgetState = (overrides = {}) => {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, ...overrides });

  const actions = useMemo(() => buildActions(dispatch), [dispatch]);
  const selectors = useMemo(() => buildSelectors(state), [state]);

  return {
    state,
    actions,
    selectors,
  };
};

export default useAdminWidgetState;
