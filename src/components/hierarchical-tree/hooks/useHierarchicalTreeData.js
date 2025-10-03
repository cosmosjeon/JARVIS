import useHierarchicalTreeBaseState from './useHierarchicalTreeBaseState';
import useHierarchicalTreeGraph from './useHierarchicalTreeGraph';
import useHierarchicalTreePersistence from './useHierarchicalTreePersistence';
import useHierarchicalTreeMutations from './useHierarchicalTreeMutations';

const useHierarchicalTreeData = ({ user, session }) => {
  const baseState = useHierarchicalTreeBaseState();
  const graphState = useHierarchicalTreeGraph({ data: baseState.data });
  const persistenceState = useHierarchicalTreePersistence({
    user,
    session,
    baseState,
    graphState,
  });
  const mutationState = useHierarchicalTreeMutations({
    baseState,
    graphState,
    persistenceState,
    user,
  });

  return {
    ...baseState,
    ...graphState,
    ...persistenceState,
    ...mutationState,
  };
};

export default useHierarchicalTreeData;
