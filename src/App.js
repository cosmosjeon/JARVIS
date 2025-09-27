import React, { useEffect, useMemo } from 'react';
import './App.css';
import './theme/glass.css';
import HierarchicalForceTree from './components/HierarchicalForceTree';
import LibraryApp from './components/library/LibraryApp';
import AdminWidgetPanel from './components/admin/AdminWidgetPanel';
import { ThemeProvider } from './components/library/ThemeProvider';
import { SettingsProvider } from './hooks/SettingsContext';
import { SupabaseProvider } from './hooks/useSupabaseAuth';
import SupabaseAuthGate from './components/auth/SupabaseAuthGate';
import OAuthCallbackPage from './views/OAuthCallbackPage';

function App() {
  const mode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') || 'widget';
  }, []);

  const pathname = useMemo(() => {
    if (typeof window === 'undefined') {
      return '/';
    }
    return window.location.pathname || '/';
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/auth/callback')) {
      document.body.classList.remove('widget-mode');
      document.body.classList.remove('admin-panel-mode');
      return;
    }
    document.body.classList.toggle('widget-mode', mode !== 'library' && mode !== 'admin-panel');
    document.body.classList.toggle('admin-panel-mode', mode === 'admin-panel');
  }, [mode, pathname]);

  if (pathname.startsWith('/auth/callback')) {
    return <OAuthCallbackPage />;
  }

  return (
    <SupabaseProvider>
      <SettingsProvider>
        <ThemeProvider>
          <SupabaseAuthGate mode={mode}>
            {mode === 'library' ? (
              <LibraryApp />
            ) : mode === 'admin-panel' ? (
              <AdminWidgetPanel />
            ) : (
              <div className="App">
                <div className="App-content">
                  <HierarchicalForceTree />
                </div>
              </div>
            )}
          </SupabaseAuthGate>
        </ThemeProvider>
      </SettingsProvider>
    </SupabaseProvider>
  );
}

export default App;
