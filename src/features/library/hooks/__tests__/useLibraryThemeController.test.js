import { renderHook, act } from '@testing-library/react';
import * as SettingsContext from 'shared/hooks/SettingsContext';
import { useLibraryThemeController } from '../useLibraryThemeController';

describe('useLibraryThemeController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns current theme metadata and cycles through options', () => {
    const setTheme = jest.fn();
    const setLibraryThemePreference = jest.fn();
    jest.spyOn(SettingsContext, 'useSettings').mockReturnValue({
      setLibraryThemePreference,
    });

    const { result, rerender } = renderHook(
      ({ theme }) => useLibraryThemeController({ theme, setTheme }),
      { initialProps: { theme: 'glass' } },
    );

    expect(result.current.active.value).toBe('light');

    act(() => {
      result.current.cycleTheme();
    });

    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(setLibraryThemePreference).toHaveBeenCalledWith('dark', { syncTheme: false });

    rerender({ theme: 'dark' });
    expect(result.current.active.value).toBe('dark');
  });
});
