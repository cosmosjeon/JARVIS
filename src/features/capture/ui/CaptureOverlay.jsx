import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { createCaptureBridge } from 'infrastructure/electron/bridges';

const MIN_SELECTION_SIZE = 8;

const parseQueryParams = () => {
  if (typeof window === 'undefined') {
    return {
      displayId: null,
      scaleFactor: 1,
      boundsX: 0,
      boundsY: 0,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    displayId: toNumber(params.get('displayId'), null),
    scaleFactor: toNumber(params.get('scale'), window.devicePixelRatio || 1),
    boundsX: toNumber(params.get('boundsX'), 0),
    boundsY: toNumber(params.get('boundsY'), 0),
  };
};

const buildDataUrl = (base64, mimeType = 'image/png') => `data:${mimeType};base64,${base64}`;

const CaptureOverlay = () => {
  const bridge = useMemo(() => createCaptureBridge(), []);
  const params = useMemo(() => parseQueryParams(), []);
  const overlayRef = useRef(null);
  const activePointerIdRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetSelection = useCallback(() => {
    activePointerIdRef.current = null;
    setIsDragging(false);
    setDragStart(null);
    setSelectionRect(null);
  }, []);

  const finalizeSelection = useCallback(async (rect) => {
    if (!rect || rect.width < MIN_SELECTION_SIZE || rect.height < MIN_SELECTION_SIZE) {
      resetSelection();
      return;
    }

    setIsProcessing(true);

    const payload = {
      displayId: params.displayId,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scaleFactor: window.devicePixelRatio || params.scaleFactor || 1,
        boundsX: params.boundsX,
        boundsY: params.boundsY,
      },
    };

    try {
      const response = await bridge.performCapture(payload);
      if (!response?.success) {
        setIsProcessing(false);
        resetSelection();
        return;
      }

      const result = response.result;
      if (result?.base64) {
        const dataUrl = buildDataUrl(result.base64, result.mimeType);
        try {
          window.localStorage.setItem('jarvis:lastCapturePreview', dataUrl);
        } catch (storageError) {
          // localStorage 접근 실패는 무시
        }
      }
    } catch (error) {
      setIsProcessing(false);
      resetSelection();
      return;
    }

    setIsProcessing(false);
    resetSelection();
  }, [bridge, params.boundsX, params.boundsY, params.displayId, params.scaleFactor, resetSelection]);

  const handlePointerDown = useCallback((event) => {
    // eslint-disable-next-line no-console
    console.log('[overlay] pointerdown', event.clientX, event.clientY);
    if (isProcessing || (typeof event.button === 'number' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const pointerId = typeof event.pointerId === 'number' ? event.pointerId : 'mouse';
    activePointerIdRef.current = pointerId;

    const startPoint = {
      x: event.clientX,
      y: event.clientY,
    };

    setDragStart(startPoint);
    setSelectionRect({ x: startPoint.x, y: startPoint.y, width: 0, height: 0 });
    setIsDragging(true);
  }, [isProcessing]);

  const handlePointerMove = useCallback((event) => {
    // eslint-disable-next-line no-console
    console.log('[overlay] pointermove', event.clientX, event.clientY, 'dragging?', isDragging);
    if (!isDragging || !dragStart) {
      return;
    }

    if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentPoint = {
      x: event.clientX,
      y: event.clientY,
    };

    const nextRect = {
      x: Math.min(dragStart.x, currentPoint.x),
      y: Math.min(dragStart.y, currentPoint.y),
      width: Math.abs(currentPoint.x - dragStart.x),
      height: Math.abs(currentPoint.y - dragStart.y),
    };
    setSelectionRect(nextRect);
  }, [dragStart, isDragging]);

  const handlePointerUp = useCallback((event) => {
    // eslint-disable-next-line no-console
    console.log('[overlay] pointerup', event?.clientX, event?.clientY);
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
      return;
    }

    const hasSelection = isDragging && selectionRect;

    activePointerIdRef.current = null;
    setIsDragging(false);

    if (!hasSelection) {
      resetSelection();
      return;
    }

    finalizeSelection(selectionRect);
  }, [finalizeSelection, isDragging, resetSelection, selectionRect]);

  const handlePointerCancel = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('[overlay] pointercancel');
    resetSelection();
  }, [resetSelection]);

  const handlePointerLeave = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('[overlay] pointerleave');
    if (!isProcessing) {
      resetSelection();
    }
  }, [isProcessing, resetSelection]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      bridge.cancelCapture();
    }
  }, [bridge]);

  useEffect(() => {
    const element = overlayRef.current;
    if (!element) {
      return undefined;
    }

    if (typeof element.focus === 'function') {
      element.focus();
    }

    const pointerDown = (event) => handlePointerDown(event);
    const pointerMove = (event) => handlePointerMove(event);
    const pointerUp = (event) => handlePointerUp(event);
    const pointerCancel = (event) => handlePointerCancel(event);
    const pointerLeave = () => handlePointerLeave();

    element.addEventListener('pointerdown', pointerDown, { passive: false });
    element.addEventListener('pointermove', pointerMove, { passive: false });
    element.addEventListener('pointerup', pointerUp, { passive: false });
    element.addEventListener('pointercancel', pointerCancel, { passive: false });
    element.addEventListener('pointerleave', pointerLeave, { passive: false });

    return () => {
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp);
      element.removeEventListener('pointercancel', pointerCancel);
      element.removeEventListener('pointerleave', pointerLeave);
    };
  }, [handlePointerCancel, handlePointerDown, handlePointerLeave, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    const handlePointerDownWindow = (event) => {
      // eslint-disable-next-line no-console
      console.log('[overlay] window pointerdown', event.clientX, event.clientY);
    };
    window.addEventListener('pointerdown', handlePointerDownWindow, true);
    return () => window.removeEventListener('pointerdown', handlePointerDownWindow, true);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  useEffect(() => {
    const unsubscribe = bridge.onCaptureCancelled(() => {
      resetSelection();
      setIsProcessing(false);
    });
    return () => unsubscribe();
  }, [bridge, resetSelection]);

  useEffect(() => {
    const unsubscribeFailed = bridge.onCaptureFailed(() => {
      resetSelection();
      setIsProcessing(false);
    });
    return () => unsubscribeFailed();
  }, [bridge, resetSelection]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 cursor-crosshair select-none"
      tabIndex={-1}
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.45)',
        backdropFilter: 'blur(2px)',
        WebkitAppRegion: 'no-drag',
        zIndex: 999999,
      }}
    >
      {selectionRect ? (
        <div
          className={clsx(
            'absolute rounded-lg border-2 border-sky-400/80 bg-sky-400/10 shadow-xl'
          )}
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
        >
          <div className="absolute bottom-2 right-2 rounded-full bg-sky-500/90 px-3 py-1 text-xs font-semibold text-white">
            {Math.round(selectionRect.width)} × {Math.round(selectionRect.height)}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CaptureOverlay;
