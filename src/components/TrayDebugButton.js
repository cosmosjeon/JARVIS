import React from 'react';

const TrayDebugButton = () => {
  const handleClick = async () => {
    try {
      await window.jarvisAPI?.toggleWindow?.();
    } catch (error) {
      window.jarvisAPI?.log?.('error', 'tray_debug_toggle_failed', { message: error?.message });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="glass-chip rounded-full bg-white/15 px-3 py-1 text-xs text-slate-50 hover:bg-white/25"
    >
      Toggle Widget (Debug)
    </button>
  );
};

export default TrayDebugButton;
