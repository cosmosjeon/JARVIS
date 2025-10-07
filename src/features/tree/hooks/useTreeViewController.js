import { useCallback, useMemo } from 'react';
import useTreeViewMode from 'features/tree/state/useTreeViewMode';

const DEFAULT_INITIAL_MODE = 'tree1';

const useTreeViewController = ({ initialMode = DEFAULT_INITIAL_MODE } = {}) => {
  const [viewModeState, setViewModeState] = useTreeViewMode(initialMode);

  const setViewMode = useCallback((nextMode) => {
    if (typeof nextMode !== 'string') {
      return;
    }
    setViewModeState(nextMode);
  }, [setViewModeState]);

  const isTidyView = viewModeState === 'tree1';
  const isForceView = viewModeState === 'tree2';
  const toolbarProps = useMemo(() => ({
    viewMode: viewModeState,
    onChange: setViewMode,
  }), [viewModeState, setViewMode]);

  return {
    viewMode: viewModeState,
    setViewMode,
    isTidyView,
    isForceView,
    toolbarProps,
  };
};

export default useTreeViewController;
