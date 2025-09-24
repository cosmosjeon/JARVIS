import { treeData } from '../data/treeData';

const parentsByChild = new Map();
const nodesById = new Map();

if (Array.isArray(treeData?.links)) {
  treeData.links.forEach((link) => {
    if (link?.target && link?.source) {
      parentsByChild.set(link.target, link.source);
    }
  });
}

if (Array.isArray(treeData?.nodes)) {
  treeData.nodes.forEach((node) => {
    if (node?.id) {
      nodesById.set(node.id, node);
    }
  });
}

const buildChain = (nodeId) => {
  const chain = [];
  let current = nodeId;
  const guard = new Set();

  while (current) {
    if (guard.has(current)) break;
    guard.add(current);

    const match = nodesById.get(current);
    chain.unshift(match ? match.keyword || match.id : current);

    const parent = parentsByChild.get(current);
    if (!parent) break;
    current = parent;
  }

  return chain;
};

const getDirectReports = (nodeId) => {
  if (!Array.isArray(treeData?.links)) {
    return [];
  }

  return treeData.links
    .filter((link) => link.source === nodeId)
    .map((link) => nodesById.get(link.target))
    .filter(Boolean)
    .map((node) => node.keyword || node.id);
};

const getPeers = (nodeId) => {
  const parent = parentsByChild.get(nodeId);
  if (!parent) return [];

  if (!Array.isArray(treeData?.links)) {
    return [];
  }

  return treeData.links
    .filter((link) => link.source === parent && link.target !== nodeId)
    .map((link) => nodesById.get(link.target))
    .filter(Boolean)
    .map((node) => node.keyword || node.id);
};

export const createTreeNodeSummary = (node) => {
  if (!node) {
    return {
      label: '',
      intro: '',
      bullets: [],
    };
  }

  const label = node.keyword || node.id;
  const chain = buildChain(node.id);
  const reports = getDirectReports(node.id);
  const peers = getPeers(node.id);

  const bullets = [
    chain.length > 1 ? `보고 체계: ${chain.join(' → ')}` : null,
    reports.length ? `리드 팀: ${reports.join(', ')}` : null,
    peers.length ? `협업 파트너: ${peers.join(', ')}` : null,
  ].filter(Boolean);

  return {
    label,
    intro: node.fullText ? `${label}은(는) ${node.fullText}` : `${label} 개요입니다.`,
    bullets,
  };
};

export const isTreeRootNode = (node) => {
  if (!node) return false;
  if (typeof node.depth === 'number') {
    return node.depth === 0;
  }
  return !parentsByChild.has(node.id);
};
