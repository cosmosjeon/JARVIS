import RenderPerformanceMonitor from "./RenderPerformanceMonitor";
import { FRAME_UPPER_BOUND_MS } from "./constants";

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
  }

  setHighlightedNodes(ids) {
    this.highlightIds = new Set(ids || []);
    if (this.currentViewport) {
      this.requestRender(this.currentViewport);
    }
  }

  requestRender(viewport) {
    if (!viewport) return;
    this.pendingViewport = viewport;
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.pendingViewport) {
        const viewportToRender = this.pendingViewport;
        this.pendingViewport = null;
        this._renderViewport(viewportToRender);
      }
    });
  }

  _renderViewport(viewport) {
    this.currentViewport = viewport;
    const payload = this.dataService.getRenderData(viewport);
    const nodes = payload.nodes || [];
    const links = payload.links || [];
    this.lastNodes = nodes;

    const nodePositions = new Map(nodes.map((node) => [node.id, node]));

    const beginOk = this.canvasRenderer.beginFrame(viewport);
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
  }
}