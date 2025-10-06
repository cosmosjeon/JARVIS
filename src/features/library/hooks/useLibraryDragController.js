import { useCallback, useMemo } from 'react';
import { readTreeIdsFromDataTransfer, writeTreeIdsToDataTransfer } from 'features/library/utils/dragPayload';

const resetDrag = (actions) => {
  actions.drag.setDraggedTreeIds([]);
  actions.drag.setDragOverFolderId(null);
  actions.drag.setDragOverVoranBox(false);
};

export const useLibraryDragController = ({ actions, state, dataApi }) => {
  const navDragStart = useCallback((event, treeId) => {
    if (!treeId) {
      return;
    }

    const selection = state.navSelectedIds.includes(treeId) && state.navSelectedIds.length > 0
      ? [...state.navSelectedIds]
      : [treeId];

    if (!state.navSelectedIds.includes(treeId)) {
      actions.selection.setNavSelectedIds(selection);
    }

    actions.drag.setDraggedTreeIds(selection);
    actions.drag.setDragOverFolderId(null);
    actions.drag.setDragOverVoranBox(false);

    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      writeTreeIdsToDataTransfer(event.dataTransfer, selection);
    }
  }, [actions.drag, actions.selection, state.navSelectedIds]);

  const navDragEnd = useCallback(() => {
    actions.drag.resetDragState();
  }, [actions.drag]);

  const navDropToFolder = useCallback(async (event, folderId) => {
    event.preventDefault();
    const treeIds = readTreeIdsFromDataTransfer(event?.dataTransfer);

    actions.drag.setDragOverFolderId(null);
    actions.drag.setDragOverVoranBox(false);

    if (treeIds.length === 0) {
      actions.drag.resetDragState();
      return;
    }

    const result = await dataApi.moveTreesToFolder({ treeIds, targetFolderId: folderId });
    if (result.moved.length > 0) {
      const [first] = result.moved;
      const navIds = result.moved.map((entry) => entry.id);
      actions.selection.selectTree(first.id, { folderId, navIds });
    }

    actions.drag.resetDragState();
  }, [actions.drag, actions.selection, dataApi]);

  const navDropToVoran = useCallback(async (event) => {
    event.preventDefault();
    const treeIds = readTreeIdsFromDataTransfer(event?.dataTransfer);

    actions.drag.setDragOverFolderId(null);
    actions.drag.setDragOverVoranBox(false);

    if (treeIds.length === 0) {
      actions.drag.resetDragState();
      return;
    }

    const result = await dataApi.moveTreesToFolder({ treeIds, targetFolderId: null });
    if (result.moved.length > 0) {
      const [first] = result.moved;
      const navIds = result.moved.map((entry) => entry.id);
      actions.selection.selectTree(first.id, { folderId: null, navIds });
    }

    actions.drag.resetDragState();
  }, [actions.drag, actions.selection, dataApi]);

  const folderDragOver = useCallback((folderId) => {
    actions.drag.setDragOverFolderId(folderId);
  }, [actions.drag]);

  const folderDragLeave = useCallback(() => {
    actions.drag.setDragOverFolderId(null);
  }, [actions.drag]);

  const voranDragOver = useCallback(() => {
    actions.drag.setDragOverVoranBox(true);
  }, [actions.drag]);

  const voranDragLeave = useCallback(() => {
    actions.drag.setDragOverVoranBox(false);
  }, [actions.drag]);

  return useMemo(() => ({
    navDragStart,
    navDragEnd,
    navDropToFolder,
    navDropToVoran,
    folderDragOver,
    folderDragLeave,
    voranDragOver,
    voranDragLeave,
  }), [
    folderDragLeave,
    folderDragOver,
    navDragEnd,
    navDragStart,
    navDropToFolder,
    navDropToVoran,
    voranDragLeave,
    voranDragOver,
  ]);
};

export default useLibraryDragController;
