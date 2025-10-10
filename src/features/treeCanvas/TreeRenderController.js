import RenderPerformanceMonitor from "./RenderPerformanceMonitor";
import { FRAME_UPPER_BOUND_MS, NODE_HEIGHT, NODE_VERTICAL_GAP, NODE_WIDTH } from "./constants";

export default class TreeRenderController {
  constructor({ dataService, canvasRenderer, performanceMonitor }) {
    this.dataService = dataService;
    this.canvasRenderer = canvasRenderer;
    this.performanceMonitor = performanceMonitor || new RenderPerformanceMonitor();
    this.pendingViewport = null;
    this.currentViewport = { left: 0, top: 0, width: 0, height: 0 };
    this.highlightIds = new Set();
    this.renderToken = null;
    this.rafId = null;
    this.lastNodes = [];
    this.renderRegion = null;
    this.pendingForce = false;
    this.currentScale = 1;
  }

  setHighlightedNodes(ids) {
    this.highlightIds = new Set(ids || []);
    if (this.currentViewport) {
      this.requestRender(this.currentViewport, { force: true });
    }
  }

  handleViewportChange(viewport) {
    if (!viewport) return;
    this.currentViewport = viewport;
    this.currentScale = viewport.scale || 1;
    if (
      this.renderRegion &&
      this.renderRegion.scale === this.currentScale &&
      this._regionContainsViewport(this.renderRegion, viewport)
    ) {
      return;
    }
    this.requestRender(viewport);
  }

  requestRender(viewport, options = {}) {
    if (!viewport) return;
    this.pendingViewport = viewport;
    if (options.force) {
      this.pendingForce = true;
    }
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.pendingViewport) {
        const viewportToRender = this.pendingViewport;
        const forceRender = this.pendingForce;
        this.pendingViewport = null;
        this.pendingForce = false;
        this._renderViewport(viewportToRender, forceRender);
      }
    });
  }

  _renderViewport(viewport, forceRender = false) {
    this.currentViewport = viewport;
    this.currentScale = viewport.scale || 1;
    const renderRegion = this._computeRenderRegion(viewport);
    renderRegion.scale = this.currentScale;
    if (!forceRender && this.renderRegion && this._regionsEqual(this.renderRegion, renderRegion)) {
      this.renderRegion = renderRegion;
      return;
    }
    this.renderRegion = renderRegion;

    const payload = this.dataService.getRenderData(renderRegion);
    const nodes = payload.nodes || [];
    const links = payload.links || [];
    this.lastNodes = nodes;

    const nodePositions = new Map(nodes.map((node) => [node.id, node]));

    this.canvasRenderer.prepareRegion(renderRegion, this.currentScale);
    const beginOk = this.canvasRenderer.beginFrame(renderRegion, this.currentScale);
    if (!beginOk) {
      return;
    }

    this.canvasRenderer.drawLinks(links, nodePositions);

    const renderToken = Symbol("render");
    this.renderToken = renderToken;

    const drawChunk = (startIndex, placeholderMode) => {
      if (this.renderToken !== renderToken) {
        return;
      }

      const batchSize = this.performanceMonitor.getBatchSize();
      const nextIndex = Math.min(startIndex + batchSize, nodes.length);
      const slice = nodes.slice(startIndex, nextIndex);
      if (!slice.length) {
        this.canvasRenderer.endFrame();
        return;
      }

      const frameStart = performance.now();
      this.canvasRenderer.drawNodes(slice, {
        highlightIds: this.highlightIds,
        placeholder: placeholderMode,
      });
      const elapsed = performance.now() - frameStart;
      this.performanceMonitor.recordFrame(elapsed, slice.length);

      const shouldPlaceholder = placeholderMode || elapsed > FRAME_UPPER_BOUND_MS;

      if (this.renderToken !== renderToken) {
        return;
      }

      if (nextIndex < nodes.length) {
        requestAnimationFrame(() => drawChunk(nextIndex, shouldPlaceholder));
      } else {
        this.canvasRenderer.endFrame();
      }
    };

    drawChunk(0, false);
  }

  _computeRenderRegion(viewport) {
    const metrics = this.dataService.getMetrics ? this.dataService.getMetrics() : null;
    const rowStride = NODE_HEIGHT + NODE_VERTICAL_GAP;
    const horizontalPad = Math.max(viewport.width * 0.6 || 0, NODE_WIDTH * 4);
    const verticalPad = Math.max(viewport.height * 0.6 || 0, rowStride * 6);

    const maxWidth = Number.isFinite(metrics?.virtualWidth) && metrics.virtualWidth > 0
      ? metrics.virtualWidth
      : viewport.left + viewport.width + horizontalPad;
    const maxHeight = Number.isFinite(metrics?.virtualHeight) && metrics.virtualHeight > 0
      ? metrics.virtualHeight
      : viewport.top + viewport.height + verticalPad;

    const left = Math.max(0, viewport.left - horizontalPad);
    const top = Math.max(0, viewport.top - verticalPad);
    const right = Math.min(maxWidth, viewport.left + viewport.width + horizontalPad);
    const bottom = Math.min(maxHeight, viewport.top + viewport.height + verticalPad);

    const width = Math.max(1, Math.ceil(right - left));
    const height = Math.max(1, Math.ceil(bottom - top));

    return {
      left,
      top,
      right,
      bottom,
      width,
      height,
      scale: viewport.scale || 1,
    };
  }

  _regionContainsViewport(region, viewport) {
    if (!region || (viewport.scale || 1) !== region.scale) return false;
    const viewportRight = viewport.left + viewport.width;
    const viewportBottom = viewport.top + viewport.height;
    return (
      viewport.left >= region.left &&
      viewport.top >= region.top &&
      viewportRight <= region.right &&
      viewportBottom <= region.bottom
    );
  }

  _regionsEqual(a, b) {
    return (
      a &&
      b &&
      a.left === b.left &&
      a.top === b.top &&
      a.right === b.right &&
      a.bottom === b.bottom &&
      (a.scale || 1) === (b.scale || 1)
    );
  }

  getLastNodes() {
    return this.lastNodes;
  }

  dispose() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.renderToken = null;
    this.highlightIds.clear();
    this.lastNodes = [];
    this.renderRegion = null;
    this.pendingForce = false;
    this.currentScale = 1;
  }
}
