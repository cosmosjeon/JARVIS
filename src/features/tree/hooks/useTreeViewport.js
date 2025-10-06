import { useCallback, useEffect, useRef, useState } from 'react';
import { getViewportDimensions, calculateNodeScaleFactor } from 'features/tree/utils/viewport';

const DEFAULT_VIEW_TRANSFORM = { x: 0, y: 0, k: 1 };
const RESIZE_DEBOUNCE_MS = 140;

export const useTreeViewport = () => {
  const initialDimensionsRef = useRef(getViewportDimensions());
  const [dimensions, setDimensions] = useState(initialDimensionsRef.current);
  const [nodeScaleFactor, setNodeScaleFactor] = useState(() =>
    calculateNodeScaleFactor(initialDimensionsRef.current),
  );
  const [viewTransform, setViewTransform] = useState(DEFAULT_VIEW_TRANSFORM);
  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef(null);

  const refreshViewport = useCallback(() => {
    const nextDimensions = getViewportDimensions();
    setDimensions(nextDimensions);
    setNodeScaleFactor(calculateNodeScaleFactor(nextDimensions));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleResize = () => {
      setIsResizing(true);
      refreshViewport();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        setIsResizing(false);
      }, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [refreshViewport]);

  return {
    dimensions,
    nodeScaleFactor,
    viewTransform,
    setViewTransform,
    isResizing,
    refreshViewport,
  };
};

export default useTreeViewport;
