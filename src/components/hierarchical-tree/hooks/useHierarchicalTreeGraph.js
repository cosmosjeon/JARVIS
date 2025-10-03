import { useCallback, useMemo } from 'react';

const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);

const useHierarchicalTreeGraph = ({ data }) => {
  const hierarchicalLinks = useMemo(() => (
    Array.isArray(data?.links)
      ? data.links.filter((link) => link?.relationship !== 'connection')
      : []
  ), [data?.links]);

  const getRootNodeId = useCallback(() => {
    if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
      return null;
    }
    const targetIds = new Set(hierarchicalLinks.map((link) => normalizeId(link.target)));
    const rootNode = data.nodes.find((node) => !targetIds.has(node.id));
    return rootNode ? rootNode.id : null;
  }, [hierarchicalLinks, data.nodes]);

  const getNodeLevel = useCallback((nodeId) => {
    const node = data.nodes.find((candidate) => candidate.id === nodeId);
    return node ? node.level : 0;
  }, [data.nodes]);

  const willCreateCycle = useCallback((sourceId, targetId, additionalLinks = []) => {
    const normalizedSource = normalizeId(sourceId);
    const normalizedTarget = normalizeId(targetId);

    if (!normalizedSource || !normalizedTarget) {
      return false;
    }

    if (normalizedSource === normalizedTarget) {
      return true;
    }

    const adjacency = new Map();

    const appendEdge = (from, to) => {
      if (!from || !to) {
        return;
      }
      if (!adjacency.has(from)) {
        adjacency.set(from, new Set());
      }
      adjacency.get(from).add(to);
    };

    const baseLinks = Array.isArray(hierarchicalLinks) ? hierarchicalLinks : [];
    baseLinks.forEach((link) => {
      appendEdge(normalizeId(link.source), normalizeId(link.target));
    });

    additionalLinks.forEach((link) => {
      if (link?.relationship === 'connection') {
        return;
      }
      appendEdge(normalizeId(link.source), normalizeId(link.target));
    });

    appendEdge(normalizedSource, normalizedTarget);

    const stack = [normalizedTarget];
    const visited = new Set();

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === normalizedSource) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const neighbors = adjacency.get(current);
      if (!neighbors) {
        continue;
      }
      neighbors.forEach((next) => {
        if (!visited.has(next)) {
          stack.push(next);
        }
      });
    }

    return false;
  }, [hierarchicalLinks]);

  const childrenByParent = useMemo(() => {
    const map = new Map();
    hierarchicalLinks.forEach((link) => {
      const sourceId = normalizeId(link.source);
      const targetId = normalizeId(link.target);
      if (!map.has(sourceId)) map.set(sourceId, []);
      map.get(sourceId).push(targetId);
    });
    return map;
  }, [hierarchicalLinks]);

  const parentByChild = useMemo(() => {
    const map = new Map();
    hierarchicalLinks.forEach((link) => {
      const sourceId = normalizeId(link.source);
      const targetId = normalizeId(link.target);
      map.set(targetId, sourceId);
    });
    return map;
  }, [hierarchicalLinks]);

  return {
    hierarchicalLinks,
    childrenByParent,
    parentByChild,
    getRootNodeId,
    getNodeLevel,
    willCreateCycle,
  };
};

export default useHierarchicalTreeGraph;
