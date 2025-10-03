import { useCallback, useMemo } from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme } from '../../library/ThemeProvider';

const themeDefinitions = [
  { label: '반투명', value: 'glass', icon: Sparkles },
  { label: '라이트', value: 'light', icon: Sun },
  { label: '다크', value: 'dark', icon: Moon },
];

const themeColors = {
  glass: {
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.12), rgba(30, 41, 59, 0.18))',
    text: 'rgba(226, 232, 240, 0.9)',
    border: 'rgba(51, 65, 85, 0.1)',
  },
  light: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 240, 240, 0.95))',
    text: '#000000',
    border: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95))',
    text: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.1)',
  },
};

const useHierarchicalTreeTheme = () => {
  const { theme, setTheme, mode } = useTheme();

  const options = useMemo(() => themeDefinitions, []);
  const activeTheme = useMemo(
    () => options.find((option) => option.value === theme) || options[0],
    [options, theme],
  );

  const cycleTheme = useCallback(() => {
    const currentIndex = options.findIndex(({ value }) => value === theme);
    const nextIndex = (currentIndex + 1) % options.length;
    setTheme(options[nextIndex].value);
  }, [options, setTheme, theme]);

  const currentTheme = useMemo(
    () => themeColors[theme] || themeColors.glass,
    [theme],
  );

  return {
    theme,
    setTheme,
    mode,
    themeOptions: options,
    activeTheme,
    ActiveThemeIcon: activeTheme.icon,
    cycleTheme,
    currentTheme,
  };
};

export default useHierarchicalTreeTheme;
