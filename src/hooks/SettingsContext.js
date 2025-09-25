import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const SettingsContext = createContext({
  doubleCtrlEnabled: true,
  autoPasteEnabled: true,
  trayEnabled: true,
  setDoubleCtrlEnabled: () => {},
  setAutoPasteEnabled: () => {},
  setTrayEnabled: () => {},
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
  const [autoPasteEnabled, setAutoPasteEnabledState] = useState(true);
  const [trayEnabled, setTrayEnabledState] = useState(true);
  const [accessibilityGranted, setAccessibilityGranted] = useState(null);

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
      setAutoPasteEnabledState(normalizeBoolean(next.autoPasteEnabled, true));
      setTrayEnabledState(normalizeBoolean(next.trayEnabled, true));
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

  const setAutoPasteEnabled = useCallback((next) => {
    setAutoPasteEnabledState(next);
    updateSettings({ autoPasteEnabled: next });
    window.jarvisAPI?.log?.('info', 'settings_auto_paste_changed', { enabled: next });
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

  const value = useMemo(() => ({
    doubleCtrlEnabled,
    autoPasteEnabled,
    trayEnabled,
    accessibilityGranted,
    setDoubleCtrlEnabled,
    setAutoPasteEnabled,
    setTrayEnabled,
    refreshAccessibilityStatus,
    requestAccessibility,
  }), [doubleCtrlEnabled, autoPasteEnabled, trayEnabled, accessibilityGranted, setDoubleCtrlEnabled, setAutoPasteEnabled, setTrayEnabled, refreshAccessibilityStatus, requestAccessibility]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
