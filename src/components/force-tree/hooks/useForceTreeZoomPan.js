import { useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const useForceTreeZoomPan = ({
  svgRef,
  containerRef,
  viewTransform,
  setViewTransform,
  centerX,
  centerY,
  isDraggingNode,
  isSelectionBoxActive,
  isSpacePressed,
  isForceSimulationEnabled,
  hasRenderableNodes,
}) => {
  const zoomBehaviorRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !hasRenderableNodes) return;

    const svg = d3.select(svgRef.current);

    const zoom = d3.zoom()
      .scaleExtent([0.3, 8])
      .filter((event) => {
        if (isDraggingNode || isSelectionBoxActive) return false;

        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('foreignObject')) return false;

        if (event.type === 'wheel') return true;
        if (event.type === 'dblclick') return false;

        if (isForceSimulationEnabled) {
          if (event.type === 'mousedown' || event.type === 'pointerdown') return true;
          if (event.type === 'mousemove' || event.type === 'pointermove') return true;
          if (event.type === 'mouseup' || event.type === 'pointerup') return true;
        }

        if (!isForceSimulationEnabled && isSpacePressed) {
          if (event.type === 'mousedown' || event.type === 'pointerdown') return true;
          if (event.type === 'mousemove' || event.type === 'pointermove') return true;
          if (event.type === 'mouseup' || event.type === 'pointerup') return true;
        }

        return false;
      })
      .on('zoom', (event) => {
        setViewTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        });
      });

    const initialTransform = d3.zoomIdentity
      .translate(viewTransform.x, viewTransform.y)
      .scale(viewTransform.k);
    svg.call(zoom.transform, initialTransform);

    const defaultWheelDelta = zoom.wheelDelta();
    zoom.wheelDelta((event) => {
      if (event.ctrlKey || event.metaKey) {
        const base = typeof defaultWheelDelta === 'function'
          ? defaultWheelDelta(event)
          : (-event.deltaY * (event.deltaMode ? 120 : 1) / 500);
        return base * 0.3;
      }

      return 0;
    });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    svg.on('wheel.treepan', (event) => {
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      event.preventDefault();

      const deltaX = event.deltaX || 0;
      const deltaY = event.deltaY || 0;

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      const currentTransform = d3.zoomTransform(svg.node());
      const scale = Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1;
      const panX = -deltaX / scale;
      const panY = -deltaY / scale;
      zoom.translateBy(svg, panX, panY);
    });

    return () => {
      svg.on('.zoom', null);
      svg.on('.treepan', null);
    };
  }, [
    svgRef,
    hasRenderableNodes,
    isDraggingNode,
    isSelectionBoxActive,
    isSpacePressed,
    isForceSimulationEnabled,
  ]);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    const handleKeyDown = (event) => {
      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!arrowKeys.includes(event.key)) {
        return;
      }

      event.preventDefault();

      const svg = d3.select(svgRef.current);
      const zoom = zoomBehaviorRef.current;
      if (!zoom) return;

      const panDistance = 50;
      const currentTransform = d3.zoomTransform(svg.node());
      const scale = Number.isFinite(currentTransform.k) && currentTransform.k > 0 ? currentTransform.k : 1;
      const adjustedDistance = panDistance / scale;

      let panX = 0;
      let panY = 0;

      switch (event.key) {
        case 'ArrowUp':
          panY = adjustedDistance;
          break;
        case 'ArrowDown':
          panY = -adjustedDistance;
          break;
        case 'ArrowLeft':
          panX = adjustedDistance;
          break;
        case 'ArrowRight':
          panX = -adjustedDistance;
          break;
        default:
          break;
      }

      zoom.translateBy(svg, panX, panY);
    };

    const container = containerRef.current;
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, svgRef]);

  const centerNodeOnScreen = useCallback((node) => {
    if (!node || !svgRef.current || !zoomBehaviorRef.current) return;

    const targetX = centerX - node.x * viewTransform.k;
    const targetY = centerY - node.y * viewTransform.k;

    const svg = d3.select(svgRef.current);
    const targetTransform = d3.zoomIdentity
      .translate(targetX, targetY)
      .scale(viewTransform.k);

    svg.transition()
      .duration(500)
      .ease(d3.easeCubicInOut)
      .call(zoomBehaviorRef.current.transform, targetTransform);
  }, [centerX, centerY, svgRef, viewTransform.k]);

  return { centerNodeOnScreen, zoomBehaviorRef };
};

export default useForceTreeZoomPan;
