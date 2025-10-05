import React, { useCallback, useMemo } from 'react';
import { createLoggerBridge, createWindowControlsBridge } from 'infrastructure/electron/bridges';

const TrayDebugButton = () => {
  const windowControls = useMemo(() => createWindowControlsBridge(), []);
  const loggerBridge = useMemo(() => createLoggerBridge(), []);

  const handleClick = useCallback(async () => {
    try {
      await windowControls.toggleWindow?.();
    } catch (error) {
      loggerBridge.log?.('error', 'tray_debug_toggle_failed', { message: error?.message });
    }
  }, [loggerBridge, windowControls]);

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
