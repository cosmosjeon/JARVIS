import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const defaultAccelerator = typeof process !== 'undefined' && process?.platform === 'darwin'
  ? 'Command+Shift+J'
  : 'Control+Shift+J';

const SettingsContext = createContext({
  doubleCtrlEnabled: true,
  trayEnabled: true,
  accelerator: defaultAccelerator,
  setDoubleCtrlEnabled: () => { },
  setTrayEnabled: () => { },
  setAccelerator: () => { },
  resetAccelerator: () => { },
});

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
};

export const SettingsProvider = ({ children }) => {
  const isWindows = typeof process !== 'undefined' && process?.platform === 'win32';
  const [doubleCtrlEnabled, setDoubleCtrlEnabledState] = useState(isWindows);
  const [trayEnabled, setTrayEnabledState] = useState(true);
  const [accessibilityGranted, setAccessibilityGranted] = useState(null);
  const [accelerator, setAcceleratorState] = useState(defaultAccelerator);

  const refreshAccessibilityStatus = useCallback(async () => {
    try {
      const result = await window.jarvisAPI?.checkAccessibilityPermission?.();
      if (result && typeof result.granted === 'boolean') {
        setAccessibilityGranted(result.granted);
      }
    } catch (error) {
      window.jarvisAPI?.log?.('warn', 'accessibility_status_failed', { message: error?.message });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const applySettings = (next = {}) => {
      if (!mounted) return;
      setDoubleCtrlEnabledState(normalizeBoolean(next.doubleCtrlEnabled, isWindows));
      setTrayEnabledState(normalizeBoolean(next.trayEnabled, true));
      if (typeof next.accelerator === 'string' && next.accelerator.trim()) {
        setAcceleratorState(next.accelerator.trim());
      } else {
        setAcceleratorState(defaultAccelerator);
      }
    };

    const load = async () => {
      try {
        const result = await window.jarvisAPI?.getSettings?.();
        const payload = result?.settings || result;
        if (payload) {
          applySettings(payload);
        }
      } catch (error) {
        window.jarvisAPI?.log?.('warn', 'settings_load_failed', { message: error?.message });
      }
      if (mounted) {
        refreshAccessibilityStatus();
      }
    };

    load();
    const unsubscribe = window.jarvisAPI?.onSettings?.((payload) => applySettings(payload));

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [refreshAccessibilityStatus]);

  const updateSettings = useCallback((partial) => {
    window.jarvisAPI?.updateSettings?.(partial);
  }, []);

  const setDoubleCtrlEnabled = useCallback((next) => {
    setDoubleCtrlEnabledState(next);
    updateSettings({ doubleCtrlEnabled: next });
    window.jarvisAPI?.log?.('info', 'settings_double_ctrl_changed', { enabled: next });
  }, [updateSettings]);


  const setTrayEnabled = useCallback((next) => {
    setTrayEnabledState(next);
    updateSettings({ trayEnabled: next });
    window.jarvisAPI?.log?.('info', 'settings_tray_changed', { enabled: next });
  }, [updateSettings]);

  const requestAccessibility = useCallback(async () => {
    const result = await window.jarvisAPI?.requestAccessibilityPermission?.();
    refreshAccessibilityStatus();
    return result;
  }, [refreshAccessibilityStatus]);

  const setAccelerator = useCallback((next) => {
    if (typeof next === 'string' && next.trim()) {
      const normalized = next.trim();
      setAcceleratorState(normalized);
      updateSettings({ accelerator: normalized });
      window.jarvisAPI?.log?.('info', 'settings_accelerator_changed', { accelerator: normalized });
    }
  }, [updateSettings]);

  const resetAccelerator = useCallback(() => {
    setAcceleratorState(defaultAccelerator);
    updateSettings({ accelerator: defaultAccelerator });
    window.jarvisAPI?.log?.('info', 'settings_accelerator_reset');
  }, [updateSettings]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.jarvisAPI?.onTrayCommand) {
      return undefined;
    }
    const unsubscribe = window.jarvisAPI.onTrayCommand(async (payload = {}) => {
      const { command } = payload;
      if (command === 'accessibility-check') {
        await requestAccessibility();
      }
      if (command === 'settings') {
        refreshAccessibilityStatus();
      }
    });
    return () => unsubscribe?.();
  }, [refreshAccessibilityStatus, requestAccessibility]);

  const value = useMemo(() => ({
    doubleCtrlEnabled,
    trayEnabled,
    accelerator,
    accessibilityGranted,
    setDoubleCtrlEnabled,
    setTrayEnabled,
    setAccelerator,
    resetAccelerator,
    refreshAccessibilityStatus,
    requestAccessibility,
  }), [doubleCtrlEnabled, trayEnabled, accelerator, accessibilityGranted, setDoubleCtrlEnabled, setTrayEnabled, setAccelerator, resetAccelerator, refreshAccessibilityStatus, requestAccessibility]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
