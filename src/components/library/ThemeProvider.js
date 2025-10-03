import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children, defaultTheme = "glass", mode = "widget" }) => {
  // mode별 독립적인 localStorage 키 생성
  const themeKey = `jarvis.theme.${mode}`;
  
  // localStorage에서 테마 상태 복원
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem(themeKey);
      return savedTheme || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (value) => {
      // 기존 테마 클래스들 제거
      root.classList.remove("glass", "light", "dark");
      // 새로운 테마 클래스 추가
      root.classList.add(value);
    };

    applyTheme(theme);

    // localStorage에 테마 상태 저장 (mode별 키 사용)
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, [theme, themeKey]);

  // localStorage 변경 감지하여 다른 탭/창과 동기화 (mode별 키만 감지)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === themeKey && e.newValue && e.newValue !== theme) {
        setTheme(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [theme, themeKey]);

  const value = useMemo(() => ({ theme, setTheme, mode }), [theme, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
