import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import './theme/glass.css';
import HierarchicalForceTree from 'features/tree/ui/HierarchicalForceTree';
import LibraryApp from 'features/library/ui/LibraryApp';
import { ThemeProvider } from 'shared/components/library/ThemeProvider';
import { SettingsProvider } from 'shared/hooks/SettingsContext';
import { SupabaseProvider } from 'shared/hooks/useSupabaseAuth';
import SupabaseAuthGate from './components/auth/SupabaseAuthGate';
import OAuthCallbackPage from './views/OAuthCallbackPage';

function App() {
  // URL 파라미터에서 새 트리인지 확인하여 초기값 설정
  const isNewTree = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isFresh = window.location.search.includes('fresh=1');
    console.log('🔍 [App] isNewTree check:', { 
      url: window.location.search, 
      isFresh 
    });
    return isFresh;
  }, []);
  
  const [isBootstrapCompact, setIsBootstrapCompact] = useState(isNewTree);
  
  useEffect(() => {
    console.log('🔍 [App] isBootstrapCompact changed:', isBootstrapCompact);
  }, [isBootstrapCompact]);
  
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
      return;
    }
    document.body.classList.toggle('widget-mode', mode !== 'library');
  }, [mode, pathname]);

  if (pathname.startsWith('/auth/callback')) {
    return <OAuthCallbackPage />;
  }

  return (
    <SupabaseProvider>
      <SettingsProvider>
        <ThemeProvider defaultTheme="glass" mode={mode}>
          <SupabaseAuthGate mode={mode}>
            {mode === 'library' ? (
              <LibraryApp />
            ) : (
              <div className={`App ${isBootstrapCompact ? 'bootstrap-compact' : ''}`}>
                <div className="App-content">
                  <HierarchicalForceTree onBootstrapCompactChange={setIsBootstrapCompact} />
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
