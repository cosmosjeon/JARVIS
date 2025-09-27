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

    // Panel dimensions with some padding
    const panelWidth = Math.min(panelSize.width, containerWidth * 0.8);
    const panelHeight = Math.min(panelSize.height, containerHeight * 0.7);
    
    // Calculate initial position (centered on node)
    let x = screenX - panelWidth / 2;
    let y = screenY - panelHeight / 2;

    // Adjust horizontal position to stay within bounds
    const minX = 10; // Padding from left edge
    const maxX = containerWidth - panelWidth - 10; // Padding from right edge
    
    if (x < minX) {
      x = minX;
    } else if (x > maxX) {
      x = maxX;
    }

    // Adjust vertical position to stay within bounds
    const minY = 10; // Padding from top edge
    const maxY = containerHeight - panelHeight - 10; // Padding from bottom edge
    
    if (y < minY) {
      y = minY;
    } else if (y > maxY) {
      y = maxY;
    }

    // If panel is too large for container, reduce size
    const finalWidth = Math.min(panelWidth, containerWidth - 20);
    const finalHeight = Math.min(panelHeight, containerHeight - 20);

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
