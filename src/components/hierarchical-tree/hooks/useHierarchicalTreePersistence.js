import useHierarchicalTreeLoader from './useHierarchicalTreeLoader';
import useHierarchicalTreeSync from './useHierarchicalTreeSync';

const useHierarchicalTreePersistence = ({
  user,
  session,
  baseState,
  graphState,
}) => {
  const loaderState = useHierarchicalTreeLoader({
    user,
    session,
    hydrateConversationStore: baseState.hydrateConversationStore,
    setData: baseState.setData,
    createClientGeneratedId: baseState.createClientGeneratedId,
  });

  const syncState = useHierarchicalTreeSync({
    user,
    session,
    baseState,
    graphState,
    loaderState: {
      ...loaderState,
      treeLibrarySyncRef: loaderState.treeLibrarySyncRef,
    },
  });

  return {
    activeTreeId: loaderState.activeTreeId,
    setActiveTreeId: loaderState.setActiveTreeId,
    initializingTree: loaderState.initializingTree,
    setInitializingTree: loaderState.setInitializingTree,
    treeSyncError: loaderState.treeSyncError,
    setTreeSyncError: loaderState.setTreeSyncError,
    loadActiveTree: loaderState.loadActiveTree,
    isTreeSyncing: syncState.isTreeSyncing,
    setIsTreeSyncing: syncState.setIsTreeSyncing,
    linkValidationError: syncState.linkValidationError,
    setLinkValidationError: syncState.setLinkValidationError,
    showLinkValidationMessage: syncState.showLinkValidationMessage,
    persistTreeData: syncState.persistTreeData,
  };
};

export default useHierarchicalTreePersistence;
