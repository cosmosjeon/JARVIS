import { useCallback, useMemo, useRef, useState } from 'react';

const createDragState = () => ({
  treeIds: [],
  startIndex: 0,
  folderId: null,
});

export const useLibraryDrag = () => {
  const dragStateRef = useRef(createDragState());
  const [draggedTreeIds, setDraggedTreeIds] = useState([]);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [dragOverVoranBox, setDragOverVoranBox] = useState(false);

  const resetDragState = useCallback(() => {
    dragStateRef.current = createDragState();
    setDraggedTreeIds([]);
    setDragOverFolderId(null);
    setDragOverVoranBox(false);
  }, []);

  const beginDrag = useCallback(({ treeIds, folderId, startIndex }) => {
    dragStateRef.current = {
      treeIds: Array.isArray(treeIds) ? treeIds : [],
      startIndex: Number.isFinite(startIndex) ? startIndex : 0,
      folderId: folderId ?? null,
    };
    setDraggedTreeIds(dragStateRef.current.treeIds);
  }, []);

  const updateDragOverFolder = useCallback((folderId) => {
    setDragOverFolderId(folderId);
  }, []);

  const updateDragOverVoran = useCallback((isOver) => {
    setDragOverVoranBox(Boolean(isOver));
  }, []);

  const dragActions = useMemo(() => ({
    resetDragState,
    beginDrag,
    updateDragOverFolder,
    updateDragOverVoran,
  }), [beginDrag, resetDragState, updateDragOverFolder, updateDragOverVoran]);

  const dragState = useMemo(() => ({
    draggedTreeIds,
    dragOverFolderId,
    dragOverVoranBox,
    internal: dragStateRef.current,
  }), [dragOverFolderId, dragOverVoranBox, draggedTreeIds]);

  return {
    dragState,
    dragActions,
  };
};

export default useLibraryDrag;
