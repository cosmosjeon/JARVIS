import React, { createContext, useContext, useCallback, useMemo, useState, useRef } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children, defaultTheme = 'glass', mode = 'widget' }) => {
  const themeKey = `jarvis.theme.${mode}`;

  // 초기 테마 로드
  const loadInitialTheme = () => {
    try {
      const saved = localStorage.getItem(themeKey);
      return saved || defaultTheme;
    } catch {
      return defaultTheme;
    }
  };

  const [theme, setThemeState] = useState(loadInitialTheme);
  const isUpdatingRef = useRef(false); // 중복 호출 방지

  // 테마 변경 함수 - 완전히 동기적으로 처리
  const setTheme = useCallback((newTheme) => {
    // 중복 호출 방지
    if (isUpdatingRef.current) {
      return;
    }

    if (!newTheme || newTheme === theme) {
      return;
    }

    isUpdatingRef.current = true;

    try {
      const root = document.documentElement;

      // DOM 업데이트 - 한 번에 처리
      if (!root.classList.contains(newTheme)) {
        ['glass', 'light', 'dark'].forEach(t => root.classList.remove(t));
        root.classList.add(newTheme);
      }

      // 상태 업데이트
      setThemeState(newTheme);

      // localStorage 저장
      try {
        localStorage.setItem(themeKey, newTheme);
      } catch {
        // 무시
      }
    } finally {
      // 다음 프레임에서 플래그 해제
      requestAnimationFrame(() => {
        isUpdatingRef.current = false;
      });
    }
  }, [theme, themeKey]);

  // 초기 DOM 설정 (한 번만)
  React.useEffect(() => {
    const root = document.documentElement;
    const initial = loadInitialTheme();

    ['glass', 'light', 'dark'].forEach(t => root.classList.remove(t));
    root.classList.add(initial);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, mode }), [theme, setTheme, mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
