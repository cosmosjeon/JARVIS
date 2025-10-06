import { act, renderHook } from '@testing-library/react';
import useLibraryDrag from '../useLibraryDrag';

describe('useLibraryDrag', () => {
  it('should_initialize_drag_state_when_drag_begins', () => {
    const { result } = renderHook(() => useLibraryDrag());

    act(() => {
      result.current.dragActions.beginDrag({
        treeIds: ['t-1', 't-2'],
        folderId: 'f-1',
        startIndex: 3,
      });
    });

    expect(result.current.dragState.draggedTreeIds).toEqual(['t-1', 't-2']);
    expect(result.current.dragState.dragOverFolderId).toBeNull();
    expect(result.current.dragState.dragOverVoranBox).toBe(false);
    expect(result.current.dragState.internal).toEqual({
      treeIds: ['t-1', 't-2'],
      folderId: 'f-1',
      startIndex: 3,
    });
  });

  it('should_update_drag_targets_when_hover_state_changes', () => {
    const { result } = renderHook(() => useLibraryDrag());

    act(() => {
      result.current.dragActions.updateDragOverFolder('folder-123');
      result.current.dragActions.updateDragOverVoran(true);
    });

    expect(result.current.dragState.dragOverFolderId).toBe('folder-123');
    expect(result.current.dragState.dragOverVoranBox).toBe(true);
  });

  it('should_reset_drag_state_when_reset_invoked', () => {
    const { result } = renderHook(() => useLibraryDrag());

    act(() => {
      result.current.dragActions.beginDrag({ treeIds: ['tree-1'], folderId: 'folder-1', startIndex: 0 });
      result.current.dragActions.updateDragOverFolder('folder-2');
      result.current.dragActions.updateDragOverVoran(true);
    });

    act(() => {
      result.current.dragActions.resetDragState();
    });

    expect(result.current.dragState.draggedTreeIds).toEqual([]);
    expect(result.current.dragState.dragOverFolderId).toBeNull();
    expect(result.current.dragState.dragOverVoranBox).toBe(false);
    expect(result.current.dragState.internal).toEqual({
      treeIds: [],
      startIndex: 0,
      folderId: null,
    });
  });
});
