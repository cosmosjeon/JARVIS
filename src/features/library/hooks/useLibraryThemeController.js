import { useCallback, useEffect, useMemo } from 'react';
import { useSettings } from 'shared/hooks/SettingsContext';
import { Sun, Moon } from 'lucide-react';

const THEME_OPTIONS = Object.freeze([
  { label: '라이트', value: 'light', icon: Sun },
  { label: '다크', value: 'dark', icon: Moon },
]);

const NORMALIZE_THEME = Object.freeze({ glass: 'light' });
const normalizeThemeValue = (value) => NORMALIZE_THEME[value] || value;

const resolveActiveTheme = (currentTheme) => {
  const normalized = normalizeThemeValue(currentTheme);
  return THEME_OPTIONS.find((option) => option.value === normalized) || THEME_OPTIONS[0];
};

export const useLibraryThemeController = ({ theme, setTheme }) => {
  const { libraryTheme: storedLibraryTheme, setLibraryThemePreference } = useSettings();

  useEffect(() => {
    const normalized = NORMALIZE_THEME[theme] || theme;
    if (normalized !== theme) {
      setTheme(normalized);
    }
  }, [theme, setTheme]);

  useEffect(() => {
    if (!storedLibraryTheme) {
      return;
    }
    const normalizedStored = normalizeThemeValue(storedLibraryTheme);
    const normalizedCurrent = normalizeThemeValue(theme);
    if (normalizedStored !== normalizedCurrent) {
      setTheme(normalizedStored);
    }
  }, [storedLibraryTheme, theme, setTheme]);

  useEffect(() => {
    const normalized = normalizeThemeValue(theme);
    if (storedLibraryTheme !== normalized) {
      setLibraryThemePreference?.(normalized);
    }
  }, [theme, storedLibraryTheme, setLibraryThemePreference]);

  const active = useMemo(() => resolveActiveTheme(theme), [theme]);

  const cycleTheme = useCallback(() => {
    const currentIndex = THEME_OPTIONS.findIndex((option) => option.value === active.value);
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    const nextTheme = THEME_OPTIONS[nextIndex].value;
    setTheme(nextTheme);
    setLibraryThemePreference?.(nextTheme);
  }, [active.value, setTheme, setLibraryThemePreference]);

  return useMemo(() => ({
    active,
    cycleTheme,
    options: THEME_OPTIONS,
  }), [active, cycleTheme]);
};

export default useLibraryThemeController;
