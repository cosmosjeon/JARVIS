import { useCallback } from 'react';

const useHierarchicalTreeMemoMutations = ({
  setData,
  dataRef,
  createClientGeneratedId,
}) => {
  const handleMemoCreate = useCallback((parentNodeId) => {
    const parentExists = dataRef.current?.nodes?.some((node) => node.id === parentNodeId);
    if (!parentExists) {
      return null;
    }

    const timestamp = Date.now();
    const memoId = createClientGeneratedId('memo');
    const parentNode = dataRef.current?.nodes?.find((node) => node.id === parentNodeId);
    const defaultTitle = parentNode?.keyword
      ? `${parentNode.keyword} 메모`
      : '새 메모';

    setData((prev) => ({
      ...prev,
      nodes: [
        ...prev.nodes,
        {
          id: memoId,
          nodeType: 'memo',
          memoParentId: parentNodeId,
          parentId: parentNodeId,
          keyword: defaultTitle,
          fullText: '',
          memo: {
            title: defaultTitle,
            content: '',
          },
          createdAt: timestamp,
          updatedAt: timestamp,
          conversation: [],
        },
      ],
      links: [
        ...prev.links,
        {
          source: parentNodeId,
          target: memoId,
          value: 0.6,
          relationship: 'memo',
        },
      ],
    }));

    return memoId;
  }, [createClientGeneratedId, dataRef, setData]);

  const handleMemoUpdate = useCallback((memoId, updates = {}) => {
    if (!memoId) {
      return;
    }

    setData((prev) => {
      let hasChanged = false;

      const nextNodes = prev.nodes.map((node) => {
        if (node.id !== memoId) {
          return node;
        }

        const currentMemo = node.memo || { title: '', content: '' };
        const nextTitle = typeof updates.title === 'string' ? updates.title : currentMemo.title;
        const nextContent = typeof updates.content === 'string' ? updates.content : currentMemo.content;

        if (nextTitle === currentMemo.title && nextContent === currentMemo.content) {
          return node;
        }

        hasChanged = true;

        return {
          ...node,
          memo: {
            title: nextTitle,
            content: nextContent,
          },
          keyword: node.nodeType === 'memo'
            ? (nextTitle || node.keyword || '').slice(0, 48)
            : node.keyword,
          fullText: node.nodeType === 'memo'
            ? (nextContent || '')
            : node.fullText,
          updatedAt: Date.now(),
        };
      });

      if (!hasChanged) {
        return prev;
      }

      return {
        ...prev,
        nodes: nextNodes,
      };
    });
  }, [setData]);

  return {
    handleMemoCreate,
    handleMemoUpdate,
  };
};

export default useHierarchicalTreeMemoMutations;
