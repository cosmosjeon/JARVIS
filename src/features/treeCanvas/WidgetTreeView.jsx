import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CanvasRenderer from "./CanvasRenderer";
import TreeRenderController from "./TreeRenderController";
import TreeRepository from "./TreeRepository";
import TreeDataService from "./TreeDataService";
import RenderPerformanceMonitor from "./RenderPerformanceMonitor";
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_HORIZONTAL_GAP,
  NODE_VERTICAL_GAP,
} from "./constants";

const approxEqual = (a, b) => Math.abs(a - b) < 0.5;

const WidgetTreeView = ({
  treeData,
  onNodeClick,
  className = "",
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const repositoryRef = useRef(null);
  const dataServiceRef = useRef(null);
  const rendererRef = useRef(null);
  const controllerRef = useRef(null);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const lastViewportRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const [metrics, setMetrics] = useState({
    nodeCount: 0,
    virtualHeight: 0,
    rootCount: 0,
    maxDepth: 0,
  });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const repository = new TreeRepository();
    const dataService = new TreeDataService(repository);
    const renderer = new CanvasRenderer();
    const monitor = new RenderPerformanceMonitor();
    const controller = new TreeRenderController({
      dataService,
      canvasRenderer: renderer,
      performanceMonitor: monitor,
    });

    repositoryRef.current = repository;
    dataServiceRef.current = dataService;
    rendererRef.current = renderer;
    controllerRef.current = controller;

    renderer.attachCanvas(canvasRef.current);
    const unsubscribe = dataService.subscribe((nextMetrics) => {
      setMetrics({ ...nextMetrics });
    });

    return () => {
      unsubscribe();
      controller.dispose();
      repositoryRef.current = null;
      dataServiceRef.current = null;
      rendererRef.current = null;
      controllerRef.current = null;
    };
  }, []);

  const updateViewport = useCallback(() => {
    const container = containerRef.current;
    const controller = controllerRef.current;
    const renderer = rendererRef.current;
    if (!container || !controller || !renderer) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (
      !approxEqual(viewportSizeRef.current.width, width) ||
      !approxEqual(viewportSizeRef.current.height, height)
    ) {
      viewportSizeRef.current = { width, height };
      setViewportSize({ width, height });
      renderer.resize(width, height);
    }

    const viewport = {
      left: container.scrollLeft,
      top: container.scrollTop,
      width,
      height,
    };
    lastViewportRef.current = viewport;
    controller.requestRender(viewport);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => updateViewport());
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [updateViewport]);

  useEffect(() => {
    const dataService = dataServiceRef.current;
    if (!dataService) return;
    dataService.load(treeData || { nodes: [], links: [] });
    requestAnimationFrame(() => updateViewport());
  }, [treeData, updateViewport]);

  const handleScroll = useCallback(() => {
    updateViewport();
  }, [updateViewport]);

  const handlePointerUp = useCallback(
    (event) => {
      const container = containerRef.current;
      const controller = controllerRef.current;
      if (!container || !controller) return;
      if (!onNodeClick) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left + container.scrollLeft;
      const y = event.clientY - rect.top + container.scrollTop;

      const nodes = controller.getLastNodes() || [];
      for (const node of nodes) {
        const withinX = x >= node.x && x <= node.x + NODE_WIDTH;
        const withinY = y >= node.y && y <= node.y + NODE_HEIGHT;
        if (withinX && withinY) {
          onNodeClick(node.raw || node);
          break;
        }
      }
    },
    [onNodeClick]
  );

  const virtualHeight = useMemo(() => {
    return Math.max(metrics.virtualHeight || 0, viewportSize.height || 0);
  }, [metrics.virtualHeight, viewportSize.height]);

  const virtualWidth = useMemo(() => {
    const depth = metrics.maxDepth || 0;
    const contentWidth = (depth + 1) * (NODE_WIDTH + NODE_HORIZONTAL_GAP) + NODE_HORIZONTAL_GAP;
    return Math.max(contentWidth, viewportSize.width || 0);
  }, [metrics.maxDepth, viewportSize.width]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-auto bg-slate-950/40 ${className}`}
      onScroll={handleScroll}
      onPointerUp={handlePointerUp}
    >
      <div
        className="relative"
        style={{ width: virtualWidth, height: virtualHeight }}
      >
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
};

export default WidgetTreeView;