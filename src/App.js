import React, { useEffect, useMemo } from 'react';
import './App.css';
import './theme/glass.css';
import HierarchicalForceTree from './components/HierarchicalForceTree';
import LibraryApp from './components/library/LibraryApp';
import { ThemeProvider } from './components/library/ThemeProvider';
import { SettingsProvider } from './hooks/SettingsContext';

function App() {
  const mode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') || 'widget';
  }, []);

  useEffect(() => {
    document.body.classList.toggle('widget-mode', mode !== 'library');
  }, [mode]);

  return (
    <SettingsProvider>
      <ThemeProvider>
        {mode === 'library' ? (
          <LibraryApp />
        ) : (
          <div className="App">
            <div className="App-content">
              <HierarchicalForceTree />
            </div>
          </div>
        )}
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
