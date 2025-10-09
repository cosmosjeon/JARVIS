import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createLoggerBridge,
  createSettingsBridge,
  createSystemBridge,
  createTrayBridge,
} from 'infrastructure/electron/bridges';

const SettingsContext = createContext({
  trayEnabled: true,
  setTrayEnabled: () => { },
  accessibilityGranted: null,
  refreshAccessibilityStatus: () => { },
  requestAccessibility: () => Promise.resolve(),
  zoomOnClickEnabled: true,
  setZoomOnClickEnabled: () => { },
});

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
};

export const SettingsProvider = ({ children }) => {
  const [trayEnabled, setTrayEnabledState] = useState(true);
  const [accessibilityGranted, setAccessibilityGranted] = useState(null);
  const [zoomOnClickEnabled, setZoomOnClickEnabledState] = useState(true);

  const settingsBridge = useMemo(() => createSettingsBridge(), []);
  const loggerBridge = useMemo(() => createLoggerBridge(), []);
  const systemBridge = useMemo(() => createSystemBridge(), []);
  const trayBridge = useMemo(() => createTrayBridge(), []);

  const refreshAccessibilityStatus = useCallback(async () => {
    try {
      const result = await systemBridge.checkAccessibilityPermission?.();
      if (result && typeof result.granted === 'boolean') {
        setAccessibilityGranted(result.granted);
      }
    } catch (error) {
      loggerBridge.log?.('warn', 'accessibility_status_failed', { message: error?.message });
    }
  }, [loggerBridge, systemBridge]);

  useEffect(() => {
    let mounted = true;

    const applySettings = (next = {}) => {
      if (!mounted) return;
      setTrayEnabledState(normalizeBoolean(next.trayEnabled, true));
      setZoomOnClickEnabledState(normalizeBoolean(next.zoomOnClickEnabled, true));
    };

    const load = async () => {
      try {
        const result = await settingsBridge.getSettings?.();
        const payload = result?.settings || result;
        if (payload) {
          applySettings(payload);
        }
      } catch (error) {
        loggerBridge.log?.('warn', 'settings_load_failed', { message: error?.message });
      }
      if (mounted) {
        refreshAccessibilityStatus();
      }
    };

    load();
    const unsubscribe = settingsBridge.onSettings?.((payload) => applySettings(payload));

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [loggerBridge, refreshAccessibilityStatus, settingsBridge]);

  const updateSettings = useCallback((partial) => {
    settingsBridge.updateSettings?.(partial);
  }, [settingsBridge]);

  const setTrayEnabled = useCallback((next) => {
    setTrayEnabledState(next);
    updateSettings({ trayEnabled: next });
    loggerBridge.log?.('info', 'settings_tray_changed', { enabled: next });
  }, [loggerBridge, updateSettings]);

  const setZoomOnClickEnabled = useCallback((next) => {
    setZoomOnClickEnabledState(next);
    updateSettings({ zoomOnClickEnabled: next });
    loggerBridge.log?.('info', 'settings_zoom_on_click_changed', { enabled: next });
  }, [loggerBridge, updateSettings]);

  const requestAccessibility = useCallback(async () => {
    const result = await systemBridge.requestAccessibilityPermission?.();
    refreshAccessibilityStatus();
    return result;
  }, [refreshAccessibilityStatus, systemBridge]);

  useEffect(() => {
    if (!trayBridge.onTrayCommand) {
      return undefined;
    }
    const unsubscribe = trayBridge.onTrayCommand(async (payload = {}) => {
      const { command } = payload;
      if (command === 'accessibility-check') {
        await requestAccessibility();
      }
      if (command === 'settings') {
        refreshAccessibilityStatus();
      }
    });
    return () => unsubscribe?.();
  }, [refreshAccessibilityStatus, requestAccessibility, trayBridge]);

  const value = useMemo(() => ({
    trayEnabled,
    accessibilityGranted,
    setTrayEnabled,
    refreshAccessibilityStatus,
    requestAccessibility,
    zoomOnClickEnabled,
    setZoomOnClickEnabled,
  }), [trayEnabled, accessibilityGranted, setTrayEnabled, refreshAccessibilityStatus, requestAccessibility, zoomOnClickEnabled, setZoomOnClickEnabled]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
