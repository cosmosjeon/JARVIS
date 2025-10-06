import { useCallback, useMemo } from 'react';

const createMemo = () => ({
  id: `memo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  title: '새 메모',
  content: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const mapUpdatedMemo = (memo, data) => ({
  ...memo,
  ...data,
  updatedAt: new Date().toISOString(),
});

const updateTreeNodes = (trees, treeId, updater) => trees.map((tree) => {
  if (tree.id !== treeId) {
    return tree;
  }
  const nodes = tree?.treeData?.nodes || [];
  return {
    ...tree,
    treeData: {
      ...tree.treeData,
      nodes: nodes.map(updater),
    },
  };
});

export const useLibraryMemoController = ({ setTrees, getSelectedTree }) => {
  const create = useCallback((nodeId) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree || !nodeId) {
      return null;
    }

    const memo = createMemo();
    setTrees((prevTrees) => updateTreeNodes(prevTrees, selectedTree.id, (node) => (
      node.id === nodeId ? { ...node, memo } : node
    )));
    return memo.id;
  }, [getSelectedTree, setTrees]);

  const update = useCallback((nodeId, memoData) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree || !nodeId) {
      return;
    }

    setTrees((prevTrees) => updateTreeNodes(prevTrees, selectedTree.id, (node) => {
      if (node.id !== nodeId || !node.memo) {
        return node;
      }
      return {
        ...node,
        memo: mapUpdatedMemo(node.memo, memoData),
      };
    }));
  }, [getSelectedTree, setTrees]);

  const remove = useCallback((memoId) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree || !memoId) {
      return;
    }

    setTrees((prevTrees) => updateTreeNodes(prevTrees, selectedTree.id, (node) => (
      node.memo?.id === memoId ? { ...node, memo: null } : node
    )));
  }, [getSelectedTree, setTrees]);

  return useMemo(() => ({
    create,
    update,
    remove,
  }), [create, remove, update]);
};

export default useLibraryMemoController;
