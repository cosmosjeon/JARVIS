import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import {
  loadTreeViewportState,
  saveTreeViewportState,
} from 'infrastructure/supabase/services/treeService';

const SAVE_DEBOUNCE_MS = 1500;
const SAVE_THROTTLE_MS = 5000;

const toFiniteNumber = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

const normalizeTransform = (transform) => ({
  x: toFiniteNumber(transform?.x),
  y: toFiniteNumber(transform?.y),
  k: toFiniteNumber(transform?.k, 1),
});

const normalizeViewportSize = (dimensions = {}) => ({
  width: Number.isFinite(dimensions.width) ? dimensions.width : null,
  height: Number.isFinite(dimensions.height) ? dimensions.height : null,
});

const buildViewportPayload = ({ transform, viewport, updatedAt }) => ({
  zoom: {
    x: transform.x,
    y: transform.y,
    k: transform.k,
  },
  pan: {
    x: transform.x,
    y: transform.y,
  },
  viewport,
  updatedAt,
  version: 'tidy-tree.v1',
});

const parseServerViewport = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const zoom = payload.zoom || payload.transform || {};
  const parsed = normalizeTransform(zoom);
  if (!Number.isFinite(parsed.k) || parsed.k <= 0) {
    return null;
  }

  const updatedAt = toFiniteNumber(payload.updatedAt ?? payload.updated_at ?? Date.now(), Date.now());

  return {
    transform: parsed,
    updatedAt,
  };
};

const useIsMountedRef = () => {
  const ref = useRef(true);
  useEffect(() => () => {
    ref.current = false;
  }, []);
  return ref;
};

export const useTreeViewportSync = ({ treeId, viewportDimensions }) => {
  const { user } = useSupabaseAuth();
  const userId = user?.id ?? null;
  const [serverViewport, setServerViewport] = useState(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(null);

  const pendingPayloadRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastSaveAtRef = useRef(0);
  const isSavingRef = useRef(false);
  const lastAppliedServerVersionRef = useRef(null);
  const isMountedRef = useIsMountedRef();

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Reset state when tree or user changes
  useEffect(() => {
    clearDebounce();
    pendingPayloadRef.current = null;
    lastSaveAtRef.current = 0;
    lastAppliedServerVersionRef.current = null;
    setServerViewport(null);
    setServerUpdatedAt(null);
  }, [treeId, userId, clearDebounce]);

  // Cleanup timers on unmount
  useEffect(() => clearDebounce, [clearDebounce]);

  // Load server state
  useEffect(() => {
    if (!treeId || !userId) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await loadTreeViewportState({ treeId, userId });
        if (cancelled || !isMountedRef.current) {
          return;
        }
        const parsed = parseServerViewport(data);
        if (parsed) {
          setServerViewport(parsed.transform);
          setServerUpdatedAt(parsed.updatedAt);
        } else {
          setServerViewport(null);
          setServerUpdatedAt(null);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[treeViewportSync] Failed to load viewport state', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [treeId, userId, isMountedRef]);

  const flushSave = useCallback(async () => {
    if (!treeId || !userId) {
      return;
    }
    if (isSavingRef.current) {
      return;
    }
    const pending = pendingPayloadRef.current;
    if (!pending) {
      return;
    }

    isSavingRef.current = true;
    pendingPayloadRef.current = null;

    try {
      const viewportPayload = buildViewportPayload(pending);
      await saveTreeViewportState({
        treeId,
        userId,
        viewportData: viewportPayload,
      });
      lastSaveAtRef.current = Date.now();
      lastAppliedServerVersionRef.current = pending.updatedAt;
      if (isMountedRef.current) {
        setServerViewport(pending.transform);
        setServerUpdatedAt(pending.updatedAt);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[treeViewportSync] Failed to save viewport state', error);
      }
      // Re-queue for a later attempt
      pendingPayloadRef.current = pending;
      if (!debounceTimerRef.current && isMountedRef.current) {
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          flushSave();
        }, SAVE_THROTTLE_MS);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [treeId, userId, isMountedRef]);

  useEffect(() => () => {
    if (pendingPayloadRef.current) {
      clearDebounce();
      flushSave();
    }
  }, [flushSave, clearDebounce]);

  const scheduleViewportSave = useCallback((transform) => {
    if (!treeId || !userId) {
      return;
    }

    const normalizedTransform = normalizeTransform(transform);
    const payload = {
      transform: normalizedTransform,
      viewport: normalizeViewportSize(viewportDimensions),
      updatedAt: Date.now(),
    };

    pendingPayloadRef.current = payload;

    clearDebounce();
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      flushSave();
    }, SAVE_DEBOUNCE_MS);

    if (Date.now() - lastSaveAtRef.current >= SAVE_THROTTLE_MS) {
      clearDebounce();
      flushSave();
    }
  }, [treeId, userId, viewportDimensions, clearDebounce, flushSave]);

  const hasFreshServerViewport = useMemo(() => (
    Boolean(
      serverViewport
      && serverUpdatedAt
      && lastAppliedServerVersionRef.current !== serverUpdatedAt,
    )
  ), [serverViewport, serverUpdatedAt]);

  const markServerViewportApplied = useCallback((version) => {
    if (Number.isFinite(version)) {
      lastAppliedServerVersionRef.current = version;
    }
  }, []);

  return {
    userId,
    serverTransform: serverViewport,
    serverUpdatedAt,
    hasFreshServerViewport,
    scheduleViewportSave,
    markServerViewportApplied,
  };
};

export default useTreeViewportSync;
