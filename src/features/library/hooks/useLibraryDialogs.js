import { useCallback, useMemo, useState } from 'react';

const DEFAULT_CREATE_TYPE = 'folder';

export const useLibraryDialogs = () => {
  const [showVoranBoxManager, setShowVoranBoxManager] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState(DEFAULT_CREATE_TYPE);

  const openVoranBox = useCallback(() => setShowVoranBoxManager(true), []);
  const closeVoranBox = useCallback(() => setShowVoranBoxManager(false), []);

  const openCreateDialog = useCallback((type = DEFAULT_CREATE_TYPE) => {
    setCreateType(type);
    setShowCreateDialog(true);
  }, []);

  const closeCreateDialog = useCallback(() => setShowCreateDialog(false), []);

  const dialogState = useMemo(() => ({
    showVoranBoxManager,
    showCreateDialog,
    createType,
  }), [showVoranBoxManager, showCreateDialog, createType]);

  const dialogActions = useMemo(() => ({
    openVoranBox,
    closeVoranBox,
    openCreateDialog,
    closeCreateDialog,
    setShowCreateDialog,
    setCreateType,
  }), [closeCreateDialog, closeVoranBox, openCreateDialog, openVoranBox]);

  return {
    dialogState,
    dialogActions,
  };
};

export default useLibraryDialogs;
