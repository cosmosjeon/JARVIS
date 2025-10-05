import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createLoggerBridge,
  createSettingsBridge,
  createSystemBridge,
  createTrayBridge,
} from 'infrastructure/electron/bridges';

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

  const setDoubleCtrlEnabled = useCallback((next) => {
    setDoubleCtrlEnabledState(next);
    updateSettings({ doubleCtrlEnabled: next });
    loggerBridge.log?.('info', 'settings_double_ctrl_changed', { enabled: next });
  }, [loggerBridge, updateSettings]);


  const setTrayEnabled = useCallback((next) => {
    setTrayEnabledState(next);
    updateSettings({ trayEnabled: next });
    loggerBridge.log?.('info', 'settings_tray_changed', { enabled: next });
  }, [loggerBridge, updateSettings]);

  const requestAccessibility = useCallback(async () => {
    const result = await systemBridge.requestAccessibilityPermission?.();
    refreshAccessibilityStatus();
    return result;
  }, [refreshAccessibilityStatus, systemBridge]);

  const setAccelerator = useCallback((next) => {
    if (typeof next === 'string' && next.trim()) {
      const normalized = next.trim();
      setAcceleratorState(normalized);
      updateSettings({ accelerator: normalized });
      loggerBridge.log?.('info', 'settings_accelerator_changed', { accelerator: normalized });
    }
  }, [loggerBridge, updateSettings]);

  const resetAccelerator = useCallback(() => {
    setAcceleratorState(defaultAccelerator);
    updateSettings({ accelerator: defaultAccelerator });
    loggerBridge.log?.('info', 'settings_accelerator_reset');
  }, [loggerBridge, updateSettings]);

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
