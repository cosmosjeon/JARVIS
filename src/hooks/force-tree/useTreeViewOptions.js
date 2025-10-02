import { useEffect, useState } from 'react';

export const VIEW_MODES = {
  TREE: 'tree1',
  FORCE: 'force-tree',
  CHART: 'chart',
};

export const ORIENTATIONS = {
  VERTICAL: 'vertical',
  HORIZONTAL: 'horizontal',
};

const VIEW_MODE_STORAGE_KEY = 'jarvis.view.mode';
const ORIENTATION_STORAGE_KEY = 'jarvis.tree.orientation';

const resolveInitialViewMode = () => {
  if (typeof window === 'undefined') {
    return VIEW_MODES.TREE;
  }
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'tree2') {
      return VIEW_MODES.FORCE;
    }
    if (stored && Object.values(VIEW_MODES).includes(stored)) {
      return stored;
    }
  } catch (error) {
    // ignore storage errors
  }
  return VIEW_MODES.TREE;
};

const resolveInitialOrientation = () => {
  if (typeof window === 'undefined') {
    return ORIENTATIONS.VERTICAL;
  }
  try {
    const stored = window.localStorage.getItem(ORIENTATION_STORAGE_KEY);
    return stored === ORIENTATIONS.HORIZONTAL ? ORIENTATIONS.HORIZONTAL : ORIENTATIONS.VERTICAL;
  } catch (error) {
    return ORIENTATIONS.VERTICAL;
  }
};

const useTreeViewOptions = () => {
  const [viewMode, setViewMode] = useState(resolveInitialViewMode);
  const [layoutOrientation, setLayoutOrientation] = useState(resolveInitialOrientation);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (Object.values(VIEW_MODES).includes(viewMode)) {
        window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
      }
    } catch (error) {
      // ignore storage errors
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (Object.values(ORIENTATIONS).includes(layoutOrientation)) {
        window.localStorage.setItem(ORIENTATION_STORAGE_KEY, layoutOrientation);
      }
    } catch (error) {
      // ignore storage errors
    }
  }, [layoutOrientation]);

  return {
    viewMode,
    setViewMode,
    layoutOrientation,
    setLayoutOrientation,
  };
};

export default useTreeViewOptions;
