import { useCallback, useMemo } from 'react';
import { Sparkles, Sun, Moon } from 'lucide-react';

const THEME_OPTIONS = Object.freeze([
  { label: '반투명', value: 'glass', icon: Sparkles },
  { label: '라이트', value: 'light', icon: Sun },
  { label: '다크', value: 'dark', icon: Moon },
]);

const resolveActiveTheme = (currentTheme) => THEME_OPTIONS.find((option) => option.value === currentTheme)
  || THEME_OPTIONS[0];

export const useLibraryThemeController = ({ theme, setTheme }) => {
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
