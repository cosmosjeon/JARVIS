import React from 'react';
import './App.css';
import './theme/glass.css';
import HierarchicalForceTree from './components/HierarchicalForceTree';
import { SettingsProvider } from './hooks/SettingsContext';

function App() {


  return (
    <SettingsProvider>
      <div className="App">
        <div className="App-content">
          <HierarchicalForceTree />
        </div>
      </div>
    </SettingsProvider>
  );
}

export default App;
