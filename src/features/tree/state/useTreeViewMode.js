import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'jarvis.view.mode';
const VALID_MODES = new Set(['tree2', 'tree1']);
const ALIASES = {
  tree1: 'tree1',
};

const normalizeMode = (rawMode, fallback) => {
  if (typeof rawMode !== 'string') {
    return fallback;
  }
  const trimmed = rawMode.trim();
  const aliasResolved = ALIASES[trimmed] || trimmed;
  return VALID_MODES.has(aliasResolved) ? aliasResolved : fallback;
};

const useTreeViewMode = (defaultMode = 'tree1') => {
  const safeDefault = useMemo(() => normalizeMode(defaultMode, 'tree1'), [defaultMode]);

  const [viewMode, setViewModeState] = useState(() => {
    if (typeof window === 'undefined') {
      return safeDefault;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return normalizeMode(stored, safeDefault);
    } catch (error) {
      return safeDefault;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode);
    } catch (error) {
      // ignore storage errors
    }
  }, [viewMode]);

  const setViewMode = useCallback((nextMode) => {
    setViewModeState((previous) => {
      const resolved = typeof nextMode === 'function' ? nextMode(previous) : nextMode;
      return normalizeMode(resolved, safeDefault);
    });
  }, [safeDefault]);

  return [viewMode, setViewMode];
};

export default useTreeViewMode;
