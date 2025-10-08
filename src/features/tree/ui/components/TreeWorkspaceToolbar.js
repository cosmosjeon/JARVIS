import React from "react";

const BUTTON_BASE_WIDGET = 'rounded-full px-3 py-1 transition';
const BUTTON_BASE_LIBRARY = 'rounded-md px-2.5 py-1 transition text-xs';

const resolveButtonClass = (viewMode, target, variant) => {
  if (variant === 'library') {
    const base = BUTTON_BASE_LIBRARY;
    if (viewMode === target) {
      return `${base} bg-muted text-foreground shadow-sm`;
    }
    return `${base} hover:bg-muted/60 text-foreground/80`;
  }

  const base = BUTTON_BASE_WIDGET;
  if (viewMode === target) {
    if (target === 'tree1') {
      return `${base} bg-amber-300/90 text-black shadow-lg`;
    }
    return `${base} bg-purple-400/90 text-black shadow-lg`;
  }
  return `${base} hover:bg-white/10 hover:text-white`;
};

const TreeWorkspaceToolbar = ({ viewMode, onChange, variant = 'widget', className = '' }) => {
  const handleChange = (mode) => {
    if (typeof onChange === 'function') {
      onChange(mode);
    }
  };

  return (
    <div
      className={
        variant === 'library'
          ? `pointer-events-auto flex gap-1 rounded-md border border-border bg-card/90 px-1.5 py-1 text-xs font-medium text-foreground/80 shadow-sm ${className}`
          : `pointer-events-auto flex gap-2 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-xs font-medium text-white/80 shadow-lg backdrop-blur-sm ${className}`
      }
    >
      <button
        type="button"
        onClick={() => handleChange('tree1')}
        className={resolveButtonClass(viewMode, 'tree1', variant)}
        aria-pressed={viewMode === 'tree1'}
      >
        트리1
      </button>

      <button
        type="button"
        onClick={() => handleChange('tree2')}
        className={resolveButtonClass(viewMode, 'tree2', variant)}
        aria-pressed={viewMode === 'tree2'}
      >
        트리2
      </button>
    </div>
  );
};

export default TreeWorkspaceToolbar;
