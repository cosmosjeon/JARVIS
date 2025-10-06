import { act, renderHook } from '@testing-library/react';
import useLibraryDialogs from '../useLibraryDialogs';

describe('useLibraryDialogs', () => {
  it('should_toggle_voran_box_visibility_when_actions_invoked', () => {
    const { result } = renderHook(() => useLibraryDialogs());

    expect(result.current.dialogState.showVoranBoxManager).toBe(false);

    act(() => {
      result.current.dialogActions.openVoranBox();
    });
    expect(result.current.dialogState.showVoranBoxManager).toBe(true);

    act(() => {
      result.current.dialogActions.closeVoranBox();
    });
    expect(result.current.dialogState.showVoranBoxManager).toBe(false);
  });

  it('should_manage_create_dialog_type_when_requesting_dialog', () => {
    const { result } = renderHook(() => useLibraryDialogs());

    expect(result.current.dialogState.showCreateDialog).toBe(false);
    expect(result.current.dialogState.createType).toBe('folder');

    act(() => {
      result.current.dialogActions.openCreateDialog('tree');
    });

    expect(result.current.dialogState.showCreateDialog).toBe(true);
    expect(result.current.dialogState.createType).toBe('tree');

    act(() => {
      result.current.dialogActions.closeCreateDialog();
    });

    expect(result.current.dialogState.showCreateDialog).toBe(false);
  });
});
