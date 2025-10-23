import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const AVAILABLE_THEMES = ['glass', 'light', 'dark'];
const useIsomorphicLayoutEffect = typeof window !== 'undefined'
  ? React.useLayoutEffect
  : React.useEffect;
const normalizeTheme = (value, fallback) => (
  AVAILABLE_THEMES.includes(value) ? value : fallback
);

export const ThemeProvider = ({ children, defaultTheme = 'glass', mode = 'widget' }) => {
  const themeKey = `jarvis.theme.${mode}`;

  // 초기 테마 로드
  const loadInitialTheme = () => {
    try {
      const saved = localStorage.getItem(themeKey);
      return normalizeTheme(saved, defaultTheme);
    } catch {
      return normalizeTheme(null, defaultTheme);
    }
  };

  const [theme, setThemeState] = useState(loadInitialTheme);
  const appliedThemeRef = useRef(null);

  const applyThemeToRoot = useCallback((nextTheme) => {
    if (typeof document === 'undefined') {
      appliedThemeRef.current = nextTheme;
      return;
    }

    const root = document.documentElement;
    if (appliedThemeRef.current === nextTheme && root.classList.contains(nextTheme)) {
      return;
    }

    AVAILABLE_THEMES.forEach((className) => {
      if (className !== nextTheme) {
        root.classList.remove(className);
      }
    });
    root.classList.add(nextTheme);
    appliedThemeRef.current = nextTheme;
  }, []);

  // 테마 변경 함수 - 완전히 동기적으로 처리
  const setTheme = useCallback((newTheme) => {
    const normalized = normalizeTheme(newTheme, defaultTheme);
    if (!normalized || normalized === theme) {
      return;
    }

    setThemeState(normalized);
  }, [defaultTheme, theme]);

  // DOM 및 저장소 동기화
  useIsomorphicLayoutEffect(() => {
    const normalized = normalizeTheme(theme, defaultTheme);
    applyThemeToRoot(normalized);
    try {
      localStorage.setItem(themeKey, normalized);
    } catch {
      // 저장 실패는 무시
    }
  }, [applyThemeToRoot, defaultTheme, theme, themeKey]);

  const value = useMemo(() => ({ theme, setTheme, mode }), [theme, setTheme, mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
