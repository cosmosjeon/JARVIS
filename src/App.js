import React from 'react';
import './App.css';
import './theme/glass.css';
import HierarchicalForceTree from './components/HierarchicalForceTree';
import { SettingsProvider } from './hooks/SettingsContext';
import WindowChrome from './components/WindowChrome';

function App() {
  

  return (
    <SettingsProvider>
      <div className="App">
        <WindowChrome />
        <div className="App-content">
          <HierarchicalForceTree />
        </div>
      </div>
    </SettingsProvider>
  );
}

export default App;
