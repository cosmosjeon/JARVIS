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
  const selectionRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('드래그하여 캡처할 영역을 선택하세요');

  const resetSelection = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setSelectionRect(null);
  }, []);

  const handlePointerDown = useCallback((event) => {
    if (isProcessing) {
      return;
    }
    const startPoint = {
      x: event.clientX,
      y: event.clientY,
    };
    setDragStart(startPoint);
    setSelectionRect({ x: startPoint.x, y: startPoint.y, width: 0, height: 0 });
    setIsDragging(true);
  }, [isProcessing]);

  const handlePointerMove = useCallback((event) => {
    if (!isDragging || !dragStart) {
      return;
    }
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

  const finalizeSelection = useCallback(async (rect) => {
    if (!rect || rect.width < MIN_SELECTION_SIZE || rect.height < MIN_SELECTION_SIZE) {
      setStatusMessage('선택 영역이 너무 작습니다. 다시 시도해주세요.');
      resetSelection();
      return;
    }

    setIsProcessing(true);
    setStatusMessage('캡처 중...');

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
        setStatusMessage('캡처에 실패했습니다. 다시 시도해주세요.');
        setIsProcessing(false);
        return;
      }

      const result = response.result;
      if (result?.base64) {
        setStatusMessage('캡처 완료');
        const dataUrl = buildDataUrl(result.base64, result.mimeType);
        window.localStorage.setItem('jarvis:lastCapturePreview', dataUrl);
      }
    } catch (error) {
      setStatusMessage('캡처에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
      }, 1200);
    }
  }, [bridge, params.boundsX, params.boundsY, params.displayId, params.scaleFactor, resetSelection]);

  const handlePointerUp = useCallback(() => {
    if (!isDragging || !selectionRect) {
      resetSelection();
      return;
    }
    setIsDragging(false);
    finalizeSelection(selectionRect);
  }, [finalizeSelection, isDragging, resetSelection, selectionRect]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      bridge.cancelCapture();
    }
  }, [bridge]);

  useEffect(() => {
    const currentSelection = selectionRef.current;
    if (!currentSelection) {
      return undefined;
    }

    currentSelection.addEventListener('pointerdown', handlePointerDown);
    currentSelection.addEventListener('pointermove', handlePointerMove);
    currentSelection.addEventListener('pointerup', handlePointerUp);
    currentSelection.addEventListener('pointerleave', handlePointerUp);

    return () => {
      currentSelection.removeEventListener('pointerdown', handlePointerDown);
      currentSelection.removeEventListener('pointermove', handlePointerMove);
      currentSelection.removeEventListener('pointerup', handlePointerUp);
      currentSelection.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const unsubscribe = bridge.onCaptureCancelled(() => {
      setStatusMessage('캡처가 취소되었습니다.');
      resetSelection();
    });
    return () => unsubscribe();
  }, [bridge, resetSelection]);

  useEffect(() => {
    const unsubscribeFailed = bridge.onCaptureFailed(() => {
      setStatusMessage('캡처에 실패했습니다. 다시 시도해주세요.');
      resetSelection();
      setIsProcessing(false);
    });
    return () => unsubscribeFailed();
  }, [bridge, resetSelection]);

  return (
    <div
      ref={selectionRef}
      className="fixed inset-0 cursor-crosshair select-none"
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 999999,
      }}
    >
      <div
        className="absolute left-1/2 top-12 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-2 text-sm text-white shadow-xl"
      >
        {isProcessing ? '캡처 중...' : statusMessage}
      </div>

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
