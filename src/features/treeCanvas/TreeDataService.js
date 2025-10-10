import {
  CACHE_SIZE,
  NODE_HEIGHT,
  NODE_VERTICAL_GAP,
  NODE_WIDTH,
  NODE_HORIZONTAL_GAP,
} from "./constants";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default class TreeDataService {
  constructor(repository) {
    this.repository = repository;
    this.cache = new Map();
    this.cacheKeys = [];
    this.metrics = {
      nodeCount: 0,
      virtualHeight: 0,
      rootCount: 0,
      maxDepth: 0,
      virtualWidth: 0,
    };
    this.listeners = new Set();
  }

  load(treeData) {
    this.metrics = this.repository.load(treeData);
    this.metrics.virtualHeight = Math.max(
      0,
      this.metrics.nodeCount * (NODE_HEIGHT + NODE_VERTICAL_GAP)
    );
    this.metrics.virtualWidth = Math.max(
      0,
      (this.metrics.maxDepth + 1) * (NODE_WIDTH + NODE_HORIZONTAL_GAP) + NODE_HORIZONTAL_GAP
    );
    this.cache.clear();
    this.cacheKeys = [];
    this._emit();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit() {
    for (const listener of this.listeners) {
      listener(this.metrics);
    }
  }

  getMetrics() {
    return this.metrics;
  }

  getRenderData(viewport) {
    if (!viewport) {
      return { nodes: [], links: [] };
    }

    const orderedNodes = this.repository.getOrderedNodes();
    if (!orderedNodes.length) {
      return { nodes: [], links: [] };
    }

    const rowStride = NODE_HEIGHT + NODE_VERTICAL_GAP;
    const paddedTop = Math.max(0, viewport.top - rowStride * 2);
    const paddedBottom = Math.min(
      this.metrics.virtualHeight,
      viewport.top + viewport.height + rowStride * 2
    );

    const startIndex = clamp(Math.floor(paddedTop / rowStride), 0, orderedNodes.length - 1);
    const endIndex = clamp(
      Math.ceil(paddedBottom / rowStride),
      startIndex + 1,
      orderedNodes.length
    );

    const cacheKey = `${startIndex}:${endIndex}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const nodes = orderedNodes.slice(startIndex, endIndex);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const links = [];
    for (const node of nodes) {
      if (!node.parentId || !nodeIds.has(node.parentId)) {
        continue;
      }
      const link = this.repository.getLinkBetween(node.parentId, node.id);
      if (link) {
        links.push(link);
      }
    }

    const payload = { nodes, links, startIndex, endIndex };
    this.cache.set(cacheKey, payload);
    this.cacheKeys.push(cacheKey);
    if (this.cacheKeys.length > CACHE_SIZE) {
      const removedKey = this.cacheKeys.shift();
      if (removedKey) {
        this.cache.delete(removedKey);
      }
    }

    return payload;
  }
}
