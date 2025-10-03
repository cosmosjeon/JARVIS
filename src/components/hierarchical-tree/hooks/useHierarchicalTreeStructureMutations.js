import useHierarchicalTreeRemoval from './useHierarchicalTreeRemoval';
import useHierarchicalTreeCreation from './useHierarchicalTreeCreation';
import useHierarchicalTreeMemoMutations from './useHierarchicalTreeMemoMutations';
import useHierarchicalTreeAttributeMutations from './useHierarchicalTreeAttributeMutations';

const useHierarchicalTreeStructureMutations = ({
  baseState,
  graphState,
  persistenceState,
  user,
}) => {
  const removal = useHierarchicalTreeRemoval({
    data: baseState.data,
    setData: baseState.setData,
    conversationStoreRef: baseState.conversationStoreRef,
    hierarchicalLinks: graphState.hierarchicalLinks,
  });

  const creation = useHierarchicalTreeCreation({
    data: baseState.data,
    setData: baseState.setData,
    dataRef: baseState.dataRef,
    setConversationForNode: baseState.setConversationForNode,
    setShowBootstrapChat: baseState.setShowBootstrapChat,
    createClientGeneratedId: baseState.createClientGeneratedId,
    getRootNodeId: graphState.getRootNodeId,
    getNodeLevel: graphState.getNodeLevel,
    willCreateCycle: graphState.willCreateCycle,
    showLinkValidationMessage: persistenceState.showLinkValidationMessage,
  });

  const memoMutations = useHierarchicalTreeMemoMutations({
    setData: baseState.setData,
    dataRef: baseState.dataRef,
    createClientGeneratedId: baseState.createClientGeneratedId,
  });

  const attributeMutations = useHierarchicalTreeAttributeMutations({
    dataRef: baseState.dataRef,
    setData: baseState.setData,
    activeTreeId: persistenceState.activeTreeId,
    user,
  });

  return {
    ...removal,
    ...creation,
    ...memoMutations,
    ...attributeMutations,
  };
};

export default useHierarchicalTreeStructureMutations;
