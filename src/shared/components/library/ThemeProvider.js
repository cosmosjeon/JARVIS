import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
      root.classList.remove('glass', 'light', 'dark');
      root.classList.add(value);
    };

    applyTheme(theme);

    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // localStorage 접근 실패는 무시
    }
  }, [theme, themeKey]);

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === themeKey && event.newValue && event.newValue !== theme) {
        setTheme(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [theme, themeKey]);

  const value = useMemo(() => ({ theme, setTheme, mode }), [theme, mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
