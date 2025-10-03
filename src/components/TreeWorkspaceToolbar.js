import React from "react";

const BUTTON_BASE = 'rounded-full px-3 py-1 transition';

const resolveButtonClass = (viewMode, target) => {
  if (viewMode === target) {
    switch (target) {
      case 'tree1':
        return `${BUTTON_BASE} bg-amber-300/90 text-black shadow-lg`;
      case 'tree2':
        return `${BUTTON_BASE} bg-purple-400/90 text-black shadow-lg`;
      case 'chart':
      default:
        return `${BUTTON_BASE} bg-emerald-400/90 text-black shadow-lg`;
    }
  }
  return `${BUTTON_BASE} hover:bg-white/10 hover:text-white`;
};

const TreeWorkspaceToolbar = ({ viewMode, onChange, showChart = true }) => {
  const handleChange = (mode) => {
    if (typeof onChange === 'function') {
      onChange(mode);
    }
  };

  return (
    <div className="pointer-events-auto flex gap-2 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-xs font-medium text-white/80 shadow-lg backdrop-blur-sm">
      <button
        type="button"
        onClick={() => handleChange('tree1')}
        className={resolveButtonClass(viewMode, 'tree1')}
        aria-pressed={viewMode === 'tree1'}
      >
        트리1
      </button>

      <button
        type="button"
        onClick={() => handleChange('tree2')}
        className={resolveButtonClass(viewMode, 'tree2')}
        aria-pressed={viewMode === 'tree2'}
      >
        트리2
      </button>

      {showChart ? (
        <button
          type="button"
          onClick={() => handleChange('chart')}
          className={resolveButtonClass(viewMode, 'chart')}
          aria-pressed={viewMode === 'chart'}
        >
          차트
        </button>
      ) : null}
    </div>
  );
};

export default TreeWorkspaceToolbar;
