/**
 * DataTransformService
 * 
 * Business Logic: 트리 데이터 구조 변환
 * nodes/links 배열을 D3 hierarchy 형태로 변환
 */

const VIRTUAL_ROOT_ID = '__virtual_root__';
const AUTO_SCALE_AMPLIFIER = 1.6;

const clampScale = (value, min = 1, max = 1 + AUTO_SCALE_AMPLIFIER) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const computeDescendantScale = (count, maxCount) => {
  if (!maxCount || count <= 0) {
    return 1;
  }

  const normalized = Math.log1p(count) / Math.log1p(maxCount);
  const scaled = 1 + normalized * AUTO_SCALE_AMPLIFIER;
  return clampScale(scaled);
};

const annotateHierarchyMetrics = (root, nodeMap) => {
  if (!root) {
    return;
  }

  const roots = Array.isArray(root) ? root : [root];
  const visited = [];

  const computeCounts = (node) => {
    if (!node || typeof node !== 'object') {
      return 0;
    }

    const children = Array.isArray(node.children) ? node.children : [];
    let descendantTotal = 0;

    children.forEach((child) => {
      descendantTotal += 1 + computeCounts(child);
    });

    if (node.data && typeof node.data === 'object') {
      node.data.childCount = children.length;
      node.data.descendantCount = descendantTotal;
      visited.push(node);

      const nodeId = node.data.id;
      if (nodeId && nodeMap?.has(nodeId)) {
        const sourceNode = nodeMap.get(nodeId);
        if (sourceNode) {
          sourceNode.childCount = node.data.childCount;
          sourceNode.descendantCount = descendantTotal;
        }
      }
    }

    return descendantTotal;
  };

  roots.forEach((rootNode) => {
    computeCounts(rootNode);
  });

  const relevantNodes = visited.filter((node) => {
    const nodeId = node?.id || node?.data?.id;
    return nodeId && nodeId !== VIRTUAL_ROOT_ID;
  });

  const maxDescendantCount = relevantNodes.reduce((max, node) => {
    const descendantCount = node?.data?.descendantCount || 0;
    return descendantCount > max ? descendantCount : max;
  }, 0);

  relevantNodes.forEach((node) => {
    const data = node.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    const descendantCount = data.descendantCount || 0;
    const scale = computeDescendantScale(descendantCount, maxDescendantCount);
    data.descendantSizeScale = scale;

    const nodeId = data.id;
    if (nodeId && nodeMap?.has(nodeId)) {
      const sourceNode = nodeMap.get(nodeId);
      if (sourceNode) {
        sourceNode.descendantSizeScale = scale;
      }
    }
  });
};

const nodeToHierarchy = (node) => ({
  name: node?.keyword || node?.id || 'Node',
  id: node?.id,
  data: { ...node },
});

const transformToHierarchy = (nodes, links) => {
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return null;
    }

    const safeLinks = Array.isArray(links) ? links : [];

    const targetIds = new Set(
        safeLinks.map(link =>
            typeof link.target === 'object' ? link.target.id : link.target
        )
    );

    let rootCandidates = nodes
        .filter(node => !targetIds.has(node.id))
        .map(node => node.id);

    if (rootCandidates.length === 0) {
        rootCandidates = [nodes[0].id];
    }

    const childrenMap = new Map();
    safeLinks.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        if (!childrenMap.has(sourceId)) {
            childrenMap.set(sourceId, []);
        }
        childrenMap.get(sourceId).push(targetId);
    });

    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    const buildHierarchy = (nodeId) => {
        const node = nodeMap.get(nodeId);
        if (!node) return null;

        const hierarchyNode = nodeToHierarchy(node);

        const childIds = childrenMap.get(nodeId) || [];
        if (childIds.length > 0) {
            hierarchyNode.children = childIds
                .map(childId => buildHierarchy(childId))
                .filter(Boolean);
        }

        return hierarchyNode;
    };

    const roots = rootCandidates
        .map(candidateId => buildHierarchy(candidateId))
        .filter(Boolean);

    if (roots.length === 0) {
        return null;
    }

    const hierarchyRoot = roots.length === 1
        ? roots[0]
        : {
            name: VIRTUAL_ROOT_ID,
            id: VIRTUAL_ROOT_ID,
            data: { id: VIRTUAL_ROOT_ID, name: VIRTUAL_ROOT_ID },
            children: roots,
        };

    annotateHierarchyMetrics(hierarchyRoot, nodeMap);

    return hierarchyRoot;
};

const isValidHierarchy = (hierarchy) => {
    if (!hierarchy || typeof hierarchy !== 'object') {
        return false;
    }

    if (!hierarchy.name || !hierarchy.id) {
        return false;
    }

    if (hierarchy.children && !Array.isArray(hierarchy.children)) {
        return false;
    }

    return true;
};

const DataTransformService = {
    transformToHierarchy,
    nodeToHierarchy,
    isValidHierarchy,
};

export default DataTransformService;
