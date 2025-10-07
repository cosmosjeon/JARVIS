import { useCallback, useMemo } from 'react';
import useTreeViewMode from 'features/tree/state/useTreeViewMode';

const DEFAULT_INITIAL_MODE = 'tree1';

const useTreeViewController = ({ initialMode = DEFAULT_INITIAL_MODE, showChart = true } = {}) => {
  const [viewModeState, setViewModeState] = useTreeViewMode(initialMode);

  const setViewMode = useCallback((nextMode) => {
    if (typeof nextMode !== 'string') {
      return;
    }
    setViewModeState(nextMode);
  }, [setViewModeState]);

  const isTidyView = viewModeState === 'tree1';
  const isForceView = viewModeState === 'tree2';
  const isChartView = viewModeState === 'chart';

  const toolbarProps = useMemo(() => ({
    viewMode: viewModeState,
    onChange: setViewMode,
    showChart,
  }), [viewModeState, setViewMode, showChart]);

  return {
    viewMode: viewModeState,
    setViewMode,
    isTidyView,
    isForceView,
    isChartView,
    toolbarProps,
  };
};

export default useTreeViewController;
