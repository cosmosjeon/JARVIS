import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';

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
  const getInitialTheme = () => {
    try {
      const savedTheme = localStorage.getItem(themeKey);
      return savedTheme || defaultTheme;
    } catch {
      return defaultTheme;
    }
  };

  const [theme, setThemeState] = useState(getInitialTheme);

  // 테마 변경 함수: 상태와 DOM을 동시에 업데이트
  const setTheme = useCallback((newTheme) => {
    if (!newTheme) {
      return;
    }

    // 현재 DOM의 테마와 비교
    const root = window.document.documentElement;
    const allThemes = ['glass', 'light', 'dark'];
    const currentTheme = allThemes.find(t => root.classList.contains(t));

    if (currentTheme === newTheme) {
      return; // 이미 적용된 테마면 아무것도 하지 않음
    }

    // DOM 업데이트: 기존 테마 제거 후 새 테마 추가 (한 번에 처리)
    allThemes.forEach(t => {
      if (t === newTheme) {
        root.classList.add(t);
      } else {
        root.classList.remove(t);
      }
    });

    // 상태 업데이트
    setThemeState(newTheme);

    // localStorage 저장
    try {
      localStorage.setItem(themeKey, newTheme);
    } catch {
      // localStorage 접근 실패는 무시
    }
  }, [themeKey]);

  // 초기 테마 적용 (마운트 시 한 번만)
  React.useEffect(() => {
    const root = window.document.documentElement;
    const initialTheme = getInitialTheme();

    // 초기 테마 클래스 적용
    const allThemes = ['glass', 'light', 'dark'];
    allThemes.forEach(t => {
      if (t === initialTheme) {
        root.classList.add(t);
      } else {
        root.classList.remove(t);
      }
    });
  }, []); // 빈 배열: 마운트 시 한 번만 실행

  const value = useMemo(() => ({ theme, setTheme, mode }), [theme, setTheme, mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
