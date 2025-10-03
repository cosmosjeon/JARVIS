import { useCallback } from 'react';
import { upsertTreeNodes } from '../../../services/supabaseTrees';

const useHierarchicalTreeAttributeMutations = ({
  dataRef,
  setData,
  activeTreeId,
  user,
}) => {
  const handleNodeUpdate = useCallback(async (nodeId, updates = {}) => {
    try {
      const latestData = dataRef.current;
      if (!latestData || !Array.isArray(latestData.nodes)) {
        return;
      }

      const nodeIndex = latestData.nodes.findIndex((node) => node.id === nodeId);
      if (nodeIndex === -1) {
        return;
      }

      const updatedNodes = [...latestData.nodes];
      updatedNodes[nodeIndex] = {
        ...updatedNodes[nodeIndex],
        ...updates,
      };

      setData((prev) => ({
        ...prev,
        nodes: updatedNodes,
      }));

      if (activeTreeId && user?.id) {
        await upsertTreeNodes({
          treeId: activeTreeId,
          nodes: updatedNodes,
          userId: user.id,
        });
      }
    } catch (error) {
      console.error('노드 업데이트 실패:', error);
    }
  }, [activeTreeId, dataRef, setData, user?.id]);

  return {
    handleNodeUpdate,
  };
};

export default useHierarchicalTreeAttributeMutations;
