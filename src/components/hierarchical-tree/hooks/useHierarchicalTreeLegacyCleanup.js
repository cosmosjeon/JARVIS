import { useEffect, useRef } from 'react';

const normalizeId = (value) => (typeof value === 'object' && value !== null ? value.id : value);

const useHierarchicalTreeLegacyCleanup = ({
  data,
  setData,
  conversationStoreRef,
  hierarchicalLinks,
}) => {
  const hasCleanedQ2Ref = useRef(false);

  useEffect(() => {
    if (hasCleanedQ2Ref.current) return;

    const isQ2Node = (node) => {
      const hasQ2Keyword = typeof node.keyword === 'string' && /^\s*Q2\s*:/.test(node.keyword);
      const hasQ2Flag = node.questionData && Number(node.questionData.questionNumber) === 2;
      return hasQ2Keyword || hasQ2Flag;
    };

    const q2Roots = data.nodes.filter(isQ2Node);
    if (q2Roots.length === 0) {
      hasCleanedQ2Ref.current = true;
      return;
    }

    const toRemove = new Set(q2Roots.map((n) => n.id));
    const stack = q2Roots.map((n) => n.id);

    while (stack.length > 0) {
      const current = stack.pop();
      hierarchicalLinks.forEach((link) => {
        const sourceId = normalizeId(link.source);
        const targetId = normalizeId(link.target);
        if (sourceId === current && !toRemove.has(targetId)) {
          toRemove.add(targetId);
          stack.push(targetId);
        }
      });
    }

    if (toRemove.size === 0) {
      hasCleanedQ2Ref.current = true;
      return;
    }

    const newNodes = data.nodes.filter((n) => !toRemove.has(n.id));
    const newLinks = data.links.filter((l) => {
      const sourceId = normalizeId(l.source);
      const targetId = normalizeId(l.target);
      return !toRemove.has(sourceId) && !toRemove.has(targetId);
    });

    setData({ ...data, nodes: newNodes, links: newLinks });
    toRemove.forEach((id) => conversationStoreRef.current.delete(id));

    hasCleanedQ2Ref.current = true;
  }, [conversationStoreRef, data, hierarchicalLinks, setData]);
};

export default useHierarchicalTreeLegacyCleanup;
