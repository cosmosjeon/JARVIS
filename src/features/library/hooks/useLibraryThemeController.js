import { useCallback, useMemo } from 'react';
import { useSettings } from 'shared/hooks/SettingsContext';
import { Sun, Moon } from 'lucide-react';

const THEME_OPTIONS = Object.freeze([
  { label: '라이트', value: 'light', icon: Sun },
  { label: '다크', value: 'dark', icon: Moon },
]);

export const useLibraryThemeController = ({ theme }) => {
  const { setLibraryThemePreference } = useSettings();

  // 현재 활성 테마 결정
  const active = useMemo(() => {
    const normalizedTheme = theme === 'glass' ? 'light' : theme;
    return THEME_OPTIONS.find((option) => option.value === normalizedTheme) || THEME_OPTIONS[0];
  }, [theme]);

  // 테마 전환 함수
  const cycleTheme = useCallback(() => {
    const currentIndex = THEME_OPTIONS.findIndex((option) => option.value === active.value);
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    const nextTheme = THEME_OPTIONS[nextIndex].value;

    // 설정 업데이트 (내부적으로 ThemeProvider의 setTheme 호출)
    setLibraryThemePreference(nextTheme);
  }, [active.value, setLibraryThemePreference]);

  return useMemo(() => ({
    active,
    cycleTheme,
    options: THEME_OPTIONS,
  }), [active, cycleTheme]);
};

export default useLibraryThemeController;
