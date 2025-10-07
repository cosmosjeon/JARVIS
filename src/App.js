import React, { useEffect, useMemo } from 'react';
import './App.css';
import './theme/glass.css';
import HierarchicalForceTree from 'features/tree/ui/HierarchicalForceTree';
import LibraryApp from 'features/library/ui/LibraryApp';
import { AdminWidgetPanel } from 'features/admin/ui';
import { ThemeProvider } from 'shared/components/library/ThemeProvider';
import { SettingsProvider } from 'shared/hooks/SettingsContext';
import { SupabaseProvider } from 'shared/hooks/useSupabaseAuth';
import SupabaseAuthGate from './components/auth/SupabaseAuthGate';
import OAuthCallbackPage from './views/OAuthCallbackPage';
import CaptureOverlay from 'features/capture/ui/CaptureOverlay';

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
        <ThemeProvider defaultTheme="glass" mode={mode}>
          <SupabaseAuthGate mode={mode}>
            {mode === 'capture-overlay' ? (
              <CaptureOverlay />
            ) : mode === 'library' ? (
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
