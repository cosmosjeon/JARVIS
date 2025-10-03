import * as d3 from 'd3';

const DEFAULT_WIDTH = 928;
const DEFAULT_NODE_VERTICAL_SPACING = 18;
const VIRTUAL_ROOT_ID = '__virtual_root__';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const resolveNodeLabel = (node) => {
  if (!node || typeof node !== 'object') {
    return '';
  }

  const candidates = [
    node.keyword,
    node.question,
    node.title,
    node.name,
    node.label,
    node.summary,
    node.fullText,
    node.description,
    node.id,
  ];

  const match = candidates.find(isNonEmptyString);
  return match ? match.trim() : '';
};

const normalizeEndpoint = (endpoint) => (
  typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint
);

const toLinkTuples = (rawLinks, includeConnectionLinks) => {
  if (!Array.isArray(rawLinks)) {
    return [];
  }

  return rawLinks
    .filter((link) => {
      if (!includeConnectionLinks && link?.relationship === 'connection') {
        return false;
      }
      return true;
    })
    .map((link) => {
      const source = normalizeEndpoint(link?.source);
      const target = normalizeEndpoint(link?.target);
      return {
        source: typeof source === 'string' ? source : null,
        target: typeof target === 'string' ? target : null,
      };
    })
    .filter((link) => isNonEmptyString(link.source) && isNonEmptyString(link.target));
};

const buildChildMap = (links) => {
  const childMap = new Map();
  links.forEach((link) => {
    if (!childMap.has(link.source)) {
      childMap.set(link.source, new Set());
    }
    childMap.get(link.source).add(link.target);
  });
  return childMap;
};

const buildRootIds = (nodes, links) => {
  const nodeIds = nodes
    .map((node) => (typeof node?.id === 'string' ? node.id : null))
    .filter(isNonEmptyString);

  if (nodeIds.length === 0) {
    return [];
  }

  const childIds = new Set();
  links.forEach((link) => {
    childIds.add(link.target);
  });

  const roots = nodeIds.filter((id) => !childIds.has(id));
  if (roots.length > 0) {
    return roots;
  }

  // Fallback: if the graph is cyclic, fall back to the first node id to avoid rendering nothing.
  return [nodeIds[0]];
};

const createHierarchyBuilder = (nodeMap, childMap) => {
  const buildNode = (nodeId, ancestry) => {
    const nodeData = nodeMap.get(nodeId);
    if (!nodeData) {
      return null;
    }

    if (ancestry.has(nodeId)) {
      return {
        id: nodeData.id,
        name: resolveNodeLabel(nodeData) || nodeData.id,
      };
    }

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(nodeId);

    const children = [];
    const childIds = childMap.get(nodeId);
    if (childIds) {
      childIds.forEach((childId) => {
        const child = buildNode(childId, nextAncestry);
        if (child) {
          children.push(child);
        }
      });
    }

    return {
      id: nodeData.id,
      name: resolveNodeLabel(nodeData) || nodeData.id,
      children: children.length > 0 ? children : undefined,
    };
  };

  return buildNode;
};

export const buildTidyTreeLayout = (rawData, options = {}) => {
  if (!rawData) {
    return null;
  }

  const rawNodes = Array.isArray(rawData.nodes) ? rawData.nodes : [];
  if (rawNodes.length === 0) {
    return null;
  }

  const includeConnectionLinks = options.includeConnectionLinks === true;
  const links = toLinkTuples(rawData.links, includeConnectionLinks);

  const nodeMap = new Map();
  rawNodes.forEach((node) => {
    if (typeof node?.id !== 'string') {
      return;
    }
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, { ...node });
    }
  });

  if (nodeMap.size === 0) {
    return null;
  }

  const childMap = buildChildMap(links);
  const rootIds = buildRootIds(rawNodes, links);
  if (rootIds.length === 0) {
    return null;
  }

  const buildHierarchyNode = createHierarchyBuilder(nodeMap, childMap);
  const hierarchyRoots = rootIds
    .map((id) => buildHierarchyNode(id, new Set()))
    .filter(Boolean);

  if (hierarchyRoots.length === 0) {
    return null;
  }

  const hierarchyData = hierarchyRoots.length === 1
    ? hierarchyRoots[0]
    : {
      id: VIRTUAL_ROOT_ID,
      name: 'root',
      children: hierarchyRoots,
    };

  const root = d3.hierarchy(hierarchyData, (node) => node.children);

  const desiredWidth = Number.isFinite(options.width) && options.width > 0 ? options.width : DEFAULT_WIDTH;
  const dx = Number.isFinite(options.nodeVerticalSpacing) && options.nodeVerticalSpacing > 0
    ? options.nodeVerticalSpacing
    : DEFAULT_NODE_VERTICAL_SPACING;
  const dy = desiredWidth / Math.max(1, root.height + 1);

  d3.tree().nodeSize([dx, dy])(root);

  let x0 = Infinity;
  let x1 = -Infinity;
  root.each((node) => {
    if (node.x < x0) x0 = node.x;
    if (node.x > x1) x1 = node.x;
  });

  const height = x1 - x0 + dx * 2;
  const nodes = root.descendants().filter((node) => node.data?.id !== VIRTUAL_ROOT_ID);
  const linksWithAncestors = root.links().filter((link) => link.target?.data?.id !== VIRTUAL_ROOT_ID);

  return {
    width: desiredWidth,
    height,
    viewBox: [-dy / 3, x0 - dx, desiredWidth, height],
    nodes,
    links: linksWithAncestors,
    root,
    dx,
    dy,
  };
};

export default buildTidyTreeLayout;


