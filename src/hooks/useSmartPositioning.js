import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Smart positioning hook that keeps panels within widget bounds
 * and automatically adjusts when the window resizes
 */
export const useSmartPositioning = (nodePosition, panelSize, viewTransform, containerRef) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [adjustedSize, setAdjustedSize] = useState(panelSize);
  const [isPositioned, setIsPositioned] = useState(false);
  const resizeObserverRef = useRef(null);

  // Calculate available space and optimal position
  const calculateOptimalPosition = useCallback(() => {
    if (!containerRef?.current || !panelSize.width || !panelSize.height) {
      return { x: 0, y: 0, width: panelSize.width, height: panelSize.height };
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Calculate node position in screen coordinates
    const nodeX = nodePosition.x || 0;
    const nodeY = nodePosition.y || 0;
    const screenX = viewTransform.x + nodeX * viewTransform.k;
    const screenY = viewTransform.y + nodeY * viewTransform.k;

    const desiredWidth = Math.min(
      panelSize.width,
      Math.min(Math.max(containerWidth - 48, containerWidth * 0.92), Math.max(containerWidth - 4, 0))
    );
    const desiredHeight = Math.min(
      panelSize.height,
      Math.min(Math.max(containerHeight - 64, containerHeight * 0.9), Math.max(containerHeight - 4, 0))
    );

    const panelWidth = Number.isFinite(desiredWidth) && desiredWidth > 0 ? desiredWidth : Math.max(containerWidth - 48, 240);
    const panelHeight = Number.isFinite(desiredHeight) && desiredHeight > 0 ? desiredHeight : Math.max(containerHeight - 64, 200);

    // Calculate initial position (centered on node)
    let x = screenX - panelWidth / 2;
    let y = screenY - panelHeight / 2;

    // Adjust horizontal position to stay within bounds
    let minX = 24; // Base padding from left edge
    let maxX = containerWidth - panelWidth - 24; // Base padding from right edge

    if (maxX < minX) {
      const centeredMargin = Math.max((containerWidth - panelWidth) / 2, 0);
      minX = Math.max(10, centeredMargin);
      maxX = Math.max(containerWidth - panelWidth - minX, minX);
    }

    if (x < minX) {
      x = minX;
    } else if (x > maxX) {
      x = maxX;
    }

    // Adjust vertical position to stay within bounds
    let minY = 24; // Base padding from top edge
    let maxY = containerHeight - panelHeight - 24; // Base padding from bottom edge

    if (maxY < minY) {
      const centeredVertical = Math.max((containerHeight - panelHeight) / 2, 0);
      minY = Math.max(10, centeredVertical);
      maxY = Math.max(containerHeight - panelHeight - minY, minY);
    }

    if (y < minY) {
      y = minY;
    } else if (y > maxY) {
      y = maxY;
    }

    // If panel is too large for container, reduce size
    const finalWidth = Math.min(panelWidth, Math.max(containerWidth - 20, 0));
    const finalHeight = Math.min(panelHeight, Math.max(containerHeight - 20, 0));

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: finalWidth,
      height: finalHeight
    };
  }, [nodePosition.x, nodePosition.y, panelSize.width, panelSize.height, viewTransform.x, viewTransform.y, viewTransform.k, containerRef?.current]);

  // Update position when dependencies change
  useEffect(() => {
    const optimal = calculateOptimalPosition();
    setPosition({ x: optimal.x, y: optimal.y });
    setAdjustedSize({ width: optimal.width, height: optimal.height });
    setIsPositioned(true);
  }, [calculateOptimalPosition]);

  // Listen for window resize events
  useEffect(() => {
    const handleResize = () => {
      const optimal = calculateOptimalPosition();
      setPosition({ x: optimal.x, y: optimal.y });
      setAdjustedSize({ width: optimal.width, height: optimal.height });
    };

    window.addEventListener('resize', handleResize);
    
    // Also observe container size changes
    if (containerRef?.current) {
      resizeObserverRef.current = new ResizeObserver(handleResize);
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [calculateOptimalPosition]); // containerRef 제거

  // Listen for zoom/pan changes
  useEffect(() => {
    const optimal = calculateOptimalPosition();
    setPosition({ x: optimal.x, y: optimal.y });
    setAdjustedSize({ width: optimal.width, height: optimal.height });
  }, [calculateOptimalPosition]); // 개별 viewTransform 속성 제거

  return {
    position,
    adjustedSize,
    isPositioned,
    recalculate: calculateOptimalPosition
  };
};
