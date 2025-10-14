import React, { useMemo, useState } from 'react';
import HierarchicalForceTree from './HierarchicalForceTree';

const WidgetShell = () => {
  const isFreshTree = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.location.search.includes('fresh=1');
  }, []);

  const [isBootstrapCompact, setIsBootstrapCompact] = useState(isFreshTree);

  return (
    <div className={`App ${isBootstrapCompact ? 'bootstrap-compact' : ''}`}>
      <div className="App-content">
        <HierarchicalForceTree onBootstrapCompactChange={setIsBootstrapCompact} />
      </div>
    </div>
  );
};

export default WidgetShell;
