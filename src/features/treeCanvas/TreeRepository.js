import { NODE_HEIGHT, NODE_VERTICAL_GAP, NODE_HORIZONTAL_GAP, NODE_WIDTH } from "./constants";

const sanitizeLink = (link) => {
  if (!link) return null;
  const source = typeof link.source === "object" ? link.source?.id : link.source;
  const target = typeof link.target === "object" ? link.target?.id : link.target;
  if (!source || !target) {
    return null;
  }
  return {
    source: String(source),
    target: String(target),
    value: typeof link.value === "number" ? link.value : 1,
  };
};

const extractLabel = (node) =>
  node.label || node.keyword || node.title || node.question || node.name || String(node.id || "");

export default class TreeRepository {
  constructor() {
    this.nodesById = new Map();
    this.childrenByParent = new Map();
    this.links = [];
    this.orderedNodes = [];
    this.maxDepth = 0;
  }

  load(treeData) {
    const rawNodes = Array.isArray(treeData?.nodes) ? treeData.nodes : [];
    const rawLinks = Array.isArray(treeData?.links) ? treeData.links : [];

    this.nodesById.clear();
    this.childrenByParent.clear();
    this.links = [];
    this.orderedNodes = [];
    this.maxDepth = 0;

    const parentMap = new Map();
    for (const rawLink of rawLinks) {
      const sanitized = sanitizeLink(rawLink);
      if (!sanitized) continue;
      parentMap.set(sanitized.target, sanitized.source);
    }

    for (const rawNode of rawNodes) {
      if (!rawNode || rawNode.id == null) continue;
      const id = String(rawNode.id);
      const parentId = rawNode.parentId != null ? String(rawNode.parentId) : parentMap.get(id) || null;

      const normalized = {
        id,
        parentId,
        label: extractLabel(rawNode),
        raw: rawNode,
      };

      this.nodesById.set(id, normalized);
      if (!this.childrenByParent.has(parentId)) {
        this.childrenByParent.set(parentId, []);
      }
      this.childrenByParent.get(parentId).push(id);
    }

    // Make sure children arrays have a stable order for deterministic layout.
    for (const [, childIds] of this.childrenByParent) {
      childIds.sort();
    }

    const sanitizedLinks = [];
    for (const rawLink of rawLinks) {
      const link = sanitizeLink(rawLink);
      if (!link) continue;
      if (!this.nodesById.has(link.source) || !this.nodesById.has(link.target)) continue;
      sanitizedLinks.push(link);
    }
    this.links = sanitizedLinks;

    const roots = [];
    for (const node of this.nodesById.values()) {
      if (!node.parentId || !this.nodesById.has(node.parentId)) {
        roots.push(node.id);
      }
    }

    roots.sort();

    const ordered = [];
    const visit = (nodeId, depth) => {
      const node = this.nodesById.get(nodeId);
      if (!node) return;
      this.maxDepth = Math.max(this.maxDepth, depth);
      const index = ordered.length;
      const y = index * (NODE_HEIGHT + NODE_VERTICAL_GAP);
      const x = depth * (NODE_WIDTH + NODE_HORIZONTAL_GAP);
      ordered.push({
        id: node.id,
        parentId: node.parentId,
        label: node.label,
        depth,
        x,
        y,
        raw: node.raw,
        index,
        height: NODE_HEIGHT,
      });

      const children = this.childrenByParent.get(nodeId) || [];
      for (const childId of children) {
        visit(childId, depth + 1);
      }
    };

    for (const rootId of roots) {
      visit(rootId, 0);
    }

    this.orderedNodes = ordered;

    return {
      nodeCount: ordered.length,
      rootCount: roots.length,
      maxDepth: this.maxDepth,
    };
  }

  getOrderedNodes() {
    return this.orderedNodes;
  }

  getLinks() {
    return this.links;
  }

  getNodeById(nodeId) {
    return this.nodesById.get(nodeId) || null;
  }

  getChildrenIds(parentId) {
    return this.childrenByParent.get(parentId) || [];
  }
}