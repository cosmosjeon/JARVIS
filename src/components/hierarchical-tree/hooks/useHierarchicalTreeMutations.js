import useHierarchicalTreeStructureMutations from './useHierarchicalTreeStructureMutations';
import useHierarchicalTreeLegacyCleanup from './useHierarchicalTreeLegacyCleanup';

const useHierarchicalTreeMutations = ({
  baseState,
  graphState,
  persistenceState,
  user,
}) => {
  const structureMutations = useHierarchicalTreeStructureMutations({
    baseState,
    graphState,
    persistenceState,
    user,
  });

  useHierarchicalTreeLegacyCleanup({
    data: baseState.data,
    setData: baseState.setData,
    conversationStoreRef: baseState.conversationStoreRef,
    hierarchicalLinks: graphState.hierarchicalLinks,
  });

  return structureMutations;
};

export default useHierarchicalTreeMutations;
