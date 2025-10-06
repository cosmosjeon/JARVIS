import { useCallback, useMemo } from 'react';

const ensureLinks = (tree) => tree?.treeData?.links || [];
const ensureNodes = (tree) => tree?.treeData?.nodes || [];

const updateTreeNodes = (trees, treeId, transform) => trees.map((tree) => {
  if (tree.id !== treeId) {
    return tree;
  }

  const nodes = ensureNodes(tree);
  return {
    ...tree,
    treeData: {
      ...tree.treeData,
      nodes: nodes.map(transform),
    },
  };
});

export const useLibraryNodeController = ({ setTrees, getSelectedTree }) => {
  const updateNode = useCallback((updatedNode) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree || !updatedNode) {
      return;
    }

    setTrees((prevTrees) => updateTreeNodes(prevTrees, selectedTree.id, (node) => (
      node.id === updatedNode.id ? updatedNode : node
    )));
  }, [getSelectedTree, setTrees]);

  const addNode = useCallback((newNode, newLink) => {
    const selectedTree = getSelectedTree();
    if (!selectedTree || !newNode) {
      return;
    }

    setTrees((prevTrees) => prevTrees.map((tree) => {
      if (tree.id !== selectedTree.id) {
        return tree;
      }

      const nodes = ensureNodes(tree);
      const links = ensureLinks(tree);

      return {
        ...tree,
        treeData: {
          ...tree.treeData,
          nodes: [...nodes, newNode],
          links: [
            ...links,
            newLink || {
              source: newNode.parentId,
              target: newNode.id,
              value: 1,
            },
          ],
        },
      };
    }));
  }, [getSelectedTree, setTrees]);

  return useMemo(() => ({
    updateNode,
    addNode,
  }), [addNode, updateNode]);
};

export default useLibraryNodeController;
