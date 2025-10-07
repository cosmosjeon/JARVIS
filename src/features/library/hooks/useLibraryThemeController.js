import { useCallback, useEffect, useMemo } from 'react';
import { Sun, Moon } from 'lucide-react';

const THEME_OPTIONS = Object.freeze([
  { label: '라이트', value: 'light', icon: Sun },
  { label: '다크', value: 'dark', icon: Moon },
]);

const NORMALIZE_THEME = Object.freeze({ glass: 'light' });

const resolveActiveTheme = (currentTheme) => {
  const normalized = NORMALIZE_THEME[currentTheme] || currentTheme;
  return THEME_OPTIONS.find((option) => option.value === normalized) || THEME_OPTIONS[0];
};

export const useLibraryThemeController = ({ theme, setTheme }) => {
  useEffect(() => {
    const normalized = NORMALIZE_THEME[theme] || theme;
    if (normalized !== theme) {
      setTheme(normalized);
    }
  }, [theme, setTheme]);

  const active = useMemo(() => resolveActiveTheme(theme), [theme]);

  const cycleTheme = useCallback(() => {
    const currentIndex = THEME_OPTIONS.findIndex((option) => option.value === active.value);
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    setTheme(THEME_OPTIONS[nextIndex].value);
  }, [active.value, setTheme]);

  return useMemo(() => ({
    active,
    cycleTheme,
    options: THEME_OPTIONS,
  }), [active, cycleTheme]);
};

export default useLibraryThemeController;
