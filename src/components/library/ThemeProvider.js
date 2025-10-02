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
  // localStorage에서 테마 상태 복원
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('jarvis.theme');
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

    // localStorage에 테마 상태 저장
    try {
      localStorage.setItem('jarvis.theme', theme);
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, [theme]);

  // localStorage 변경 감지하여 다른 탭/창과 동기화
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'jarvis.theme' && e.newValue && e.newValue !== theme) {
        setTheme(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, mode }), [theme, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
