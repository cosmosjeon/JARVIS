import { useCallback } from 'react';

const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);

const useHierarchicalTreeRemoval = ({
  data,
  setData,
  conversationStoreRef,
  hierarchicalLinks,
}) => {
  const removeNodeAndDescendants = useCallback((nodeId) => {
    if (!nodeId) return new Set();

    const toRemove = new Set();
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (toRemove.has(current)) continue;
      toRemove.add(current);

      hierarchicalLinks.forEach((link) => {
        const sourceId = normalizeId(link.source);
        const targetId = normalizeId(link.target);
        if (sourceId === current) {
          stack.push(targetId);
        }
      });
    }

    const newNodes = data.nodes.filter((n) => !toRemove.has(n.id));
    const newLinks = data.links.filter((l) => {
      const sourceId = normalizeId(l.source);
      const targetId = normalizeId(l.target);
      return !toRemove.has(sourceId) && !toRemove.has(targetId);
    });

    setData({ ...data, nodes: newNodes, links: newLinks });
    toRemove.forEach((id) => conversationStoreRef.current.delete(id));

    return toRemove;
  }, [conversationStoreRef, data, hierarchicalLinks, setData]);

  return {
    removeNodeAndDescendants,
  };
};

export default useHierarchicalTreeRemoval;
