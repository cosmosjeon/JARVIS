import { renderHook, act } from '@testing-library/react';
import { useLibraryThemeController } from '../useLibraryThemeController';

describe('useLibraryThemeController', () => {
  it('returns current theme metadata and cycles through options', () => {
    const setTheme = jest.fn();
    const { result, rerender } = renderHook(
      ({ theme }) => useLibraryThemeController({ theme, setTheme }),
      { initialProps: { theme: 'glass' } },
    );

    expect(result.current.active.value).toBe('light');

    act(() => {
      result.current.cycleTheme();
    });

    expect(setTheme).toHaveBeenCalledWith('dark');

    rerender({ theme: 'dark' });
    expect(result.current.active.value).toBe('dark');
  });
});
