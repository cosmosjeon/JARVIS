import React from 'react';
import './App.css';
import './theme/glass.css';
import HierarchicalForceTree from './components/HierarchicalForceTree';
import SettingsPanel from './components/SettingsPanel';
import { SettingsProvider } from './hooks/SettingsContext';

function App() {
  const overlayEnabled = process.env.NODE_ENV !== 'production';

  return (
    <SettingsProvider>
      <div className="App">
        <HierarchicalForceTree />
        {overlayEnabled && (
          <div className="App-overlay">
            <SettingsPanel />
          </div>
        )}
      </div>
    </SettingsProvider>
  );
}

export default App;
