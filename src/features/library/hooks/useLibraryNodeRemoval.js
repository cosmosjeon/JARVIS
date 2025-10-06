import { useCallback } from 'react';

const collectChildren = (parentId, nodes) => {
  const direct = nodes.filter((node) => node.parentId === parentId);
  return direct.reduce((acc, node) => (
    [...acc, node.id, ...collectChildren(node.id, nodes)]
  ), []);
};

export const useLibraryNodeRemoval = ({ actions, dataApi, selectors }) => useCallback(async (nodeId) => {
  if (!nodeId || !selectors.selectedTree) {
    return;
  }

  const confirmed = window.confirm('이 노드를 삭제하시겠습니까? 하위 노드들도 함께 삭제됩니다.');
  if (!confirmed) {
    return;
  }

  const nodes = selectors.selectedTree?.treeData?.nodes || [];
  const nodeIds = [nodeId, ...collectChildren(nodeId, nodes)];
  const removed = await dataApi.handleNodesRemove({ nodeIds });
  if (!removed) {
    return;
  }

  actions.data.setTrees((prev) => prev.map((tree) => {
    if (tree.id !== selectors.selectedTree.id) {
      return tree;
    }
    const currentNodes = tree?.treeData?.nodes || [];
    const links = tree?.treeData?.links || [];
    return {
      ...tree,
      treeData: {
        ...tree.treeData,
        nodes: currentNodes.filter((node) => !nodeIds.includes(node.id)),
        links: links.filter((link) => !nodeIds.includes(link.source) && !nodeIds.includes(link.target)),
      },
    };
  }));
}, [actions.data, dataApi, selectors.selectedTree]);

export default useLibraryNodeRemoval;
