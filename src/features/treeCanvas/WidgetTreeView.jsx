import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CanvasRenderer from "./CanvasRenderer";
import TreeRenderController from "./TreeRenderController";
import TreeRepository from "./TreeRepository";
import TreeDataService from "./TreeDataService";
import RenderPerformanceMonitor from "./RenderPerformanceMonitor";
import { NODE_WIDTH, NODE_HEIGHT } from "./constants";
import { useSettings } from "shared/hooks/SettingsContext";

const approxEqual = (a, b) => Math.abs(a - b) < 0.5;
const zoomEqual = (a, b) => Math.abs(a - b) < 0.001;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const WidgetTreeView = ({
  treeData,
  onNodeClick,
  className = "",
}) => {
  console.log("[WidgetTreeView] render start", { timestamp: Date.now() });
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const repositoryRef = useRef(null);
  const dataServiceRef = useRef(null);
  const controllerRef = useRef(null);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const lastViewportRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const [metrics, setMetrics] = useState({
    nodeCount: 0,
    virtualHeight: 0,
    rootCount: 0,
    maxDepth: 0,
    virtualWidth: 0,
  });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const { inputMode = "mouse" } = useSettings();

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
      controllerRef.current = null;
    };
  }, []);

  const updateViewport = useCallback((options = {}) => {
    const container = containerRef.current;
    const controller = controllerRef.current;
    if (!container || !controller) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const scale = zoomRef.current || 1;

    const viewport = {
      left: container.scrollLeft / scale,
      top: container.scrollTop / scale,
      width: width / scale,
      height: height / scale,
      scale,
    };

    if (
      !approxEqual(viewportSizeRef.current.width, width) ||
      !approxEqual(viewportSizeRef.current.height, height)
    ) {
      viewportSizeRef.current = { width, height };
      setViewportSize({ width, height });
      lastViewportRef.current = viewport;
      controller.requestRender(viewport, { force: true });
      return;
    }

    lastViewportRef.current = viewport;
    if (options.forceRender) {
      controller.requestRender(viewport, { force: true });
    } else {
      controller.handleViewportChange(viewport);
    }
  }, []);

  const applyZoom = useCallback(
    (requestedZoom, anchor) => {
      const container = containerRef.current;
      if (!container) return;
      const prevZoom = zoomRef.current || 1;
      const nextZoom = clampZoom(requestedZoom || 1);
      if (zoomEqual(prevZoom, nextZoom)) {
        return;
      }

      zoomRef.current = nextZoom;
      setZoom(nextZoom);

      const rect = container.getBoundingClientRect();
      const anchorOffsetX =
        anchor && typeof anchor.x === "number" ? anchor.x - rect.left : rect.width / 2;
      const anchorOffsetY =
        anchor && typeof anchor.y === "number" ? anchor.y - rect.top : rect.height / 2;

      const worldX = (container.scrollLeft + anchorOffsetX) / prevZoom;
      const worldY = (container.scrollTop + anchorOffsetY) / prevZoom;

      const nextScrollLeft = worldX * nextZoom - anchorOffsetX;
      const nextScrollTop = worldY * nextZoom - anchorOffsetY;

      container.scrollLeft = nextScrollLeft;
      container.scrollTop = nextScrollTop;

      updateViewport({ forceRender: true });
    },
    [updateViewport]
  );

  useEffect(() => {
    if (inputMode === "trackpad" && !zoomEqual(zoomRef.current, 1)) {
      applyZoom(1);
    }
  }, [applyZoom, inputMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => updateViewport({ forceRender: true }));
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [updateViewport]);

  useEffect(() => {
    const container = containerRef.current;
    console.log("[WidgetTreeView] wheel effect init", {
      hasContainer: !!container,
      inputMode,
    });
    if (!container) return;

    if (inputMode !== "mouse") {
      console.log("[WidgetTreeView] wheel effect skipped (not mouse mode)", { inputMode });
      container.style.overscrollBehavior = "";
      return undefined;
    }

    console.log("[WidgetTreeView] wheel effect active (mouse mode)");

    const handleWheelCapture = (event) => {
      if (!container.contains(event.target)) {
        return;
      }

      console.log("[WidgetTreeView] wheel capture", { deltaY: event.deltaY, target: event.target });

      if (!event.cancelable || !Number.isFinite(event.deltaY)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    };

    const handleWheel = (event) => {
      if (!container.contains(event.target)) {
        return;
      }

      console.log("[WidgetTreeView] wheel handler", { deltaY: event.deltaY });

      if (!event.cancelable || !Number.isFinite(event.deltaY)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      const baseZoom = zoomRef.current || 1;
      const zoomFactor = Math.pow(2, -event.deltaY / 240);
      const targetZoom = clampZoom(baseZoom * zoomFactor);
      if (zoomEqual(baseZoom, targetZoom)) {
        console.log("[WidgetTreeView] zoom unchanged", { baseZoom, targetZoom });
        return;
      }
      console.log("[WidgetTreeView] applying zoom", { baseZoom, targetZoom });
      applyZoom(targetZoom, { x: event.clientX, y: event.clientY });
    };

    const wheelOptions = { passive: false, capture: true };
    container.style.overscrollBehavior = "contain";
    window.addEventListener("wheel", handleWheelCapture, wheelOptions);
    container.addEventListener("wheel", handleWheel, wheelOptions);

    return () => {
      window.removeEventListener("wheel", handleWheelCapture, wheelOptions);
      container.removeEventListener("wheel", handleWheel, wheelOptions);
      container.style.overscrollBehavior = "";
    };
  }, [applyZoom, inputMode]);

  useEffect(() => {
    const dataService = dataServiceRef.current;
    if (!dataService) return;
    dataService.load(treeData || { nodes: [], links: [] });
    requestAnimationFrame(() => updateViewport({ forceRender: true }));
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
      const scale = zoomRef.current || 1;
      const x = (event.clientX - rect.left + container.scrollLeft) / scale;
      const y = (event.clientY - rect.top + container.scrollTop) / scale;

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
    return Math.max(metrics.virtualWidth || 0, viewportSize.width || 0);
  }, [metrics.virtualWidth, viewportSize.width]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-auto bg-slate-950/40 ${className}`}
      onScroll={handleScroll}
      onPointerUp={handlePointerUp}
    >
      <div
        className="relative"
        style={{
          width: Math.max(1, Math.floor((virtualWidth || 0) * zoom)),
          height: Math.max(1, Math.floor((virtualHeight || 0) * zoom)),
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0"
        />
      </div>
    </div>
  );
};

export default WidgetTreeView;
