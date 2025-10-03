import { useCallback, useEffect, useMemo, useRef } from 'react';

const useHierarchicalTreeSession = () => {
  const sessionInfo = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        sessionId: null,
        initialTreeId: null,
        fresh: false,
      };
    }

    const currentUrl = new URL(window.location.href);
    let sessionId = currentUrl.searchParams.get('session');
    let mutated = false;

    if (!sessionId) {
      sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
      currentUrl.searchParams.set('session', sessionId);
      mutated = true;
    }

    const initialTreeId = currentUrl.searchParams.get('treeId');
    const freshFlag = currentUrl.searchParams.get('fresh') === '1';

    if (mutated) {
      window.history.replaceState({}, '', currentUrl.toString());
    }

    return {
      sessionId,
      initialTreeId: initialTreeId || null,
      fresh: freshFlag,
    };
  }, []);

  const sessionStorageKey = useMemo(() => (
    sessionInfo.sessionId ? `jarvis.widget.session.${sessionInfo.sessionId}.activeTreeId` : null
  ), [sessionInfo.sessionId]);

  const requestedTreeIdRef = useRef(sessionInfo.initialTreeId);
  const hasResolvedInitialTreeRef = useRef(false);

  const readSessionTreeId = useCallback(() => {
    if (!sessionStorageKey || typeof window === 'undefined') {
      return null;
    }

    try {
      const storedValue = window.sessionStorage.getItem(sessionStorageKey);
      return storedValue || null;
    } catch (error) {
      return null;
    }
  }, [sessionStorageKey]);

  const writeSessionTreeId = useCallback((treeId) => {
    if (!sessionStorageKey || typeof window === 'undefined') {
      return;
    }

    try {
      if (!treeId) {
        window.sessionStorage.removeItem(sessionStorageKey);
      } else {
        window.sessionStorage.setItem(sessionStorageKey, treeId);
      }
    } catch (error) {
      // ignore storage errors
    }
  }, [sessionStorageKey]);

  useEffect(() => {
    if (!sessionStorageKey || typeof window === 'undefined') {
      return;
    }
    if (sessionInfo.fresh) {
      try {
        window.sessionStorage.removeItem(sessionStorageKey);
      } catch (error) {
        // ignore storage errors
      }
    }
  }, [sessionInfo.fresh, sessionStorageKey]);

  return {
    sessionInfo,
    sessionStorageKey,
    requestedTreeIdRef,
    hasResolvedInitialTreeRef,
    readSessionTreeId,
    writeSessionTreeId,
  };
};

export default useHierarchicalTreeSession;
