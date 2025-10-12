import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createLoggerBridge,
  createSettingsBridge,
  createSystemBridge,
  createTrayBridge,
} from 'infrastructure/electron/bridges';
import { useSupabaseAuth } from 'shared/hooks/useSupabaseAuth';
import {
  fetchUserSettings,
  upsertUserSettings,
} from 'infrastructure/supabase/services/settingsService';

const SettingsContext = createContext({
  trayEnabled: true,
  setTrayEnabled: () => { },
  accessibilityGranted: null,
  refreshAccessibilityStatus: () => { },
  requestAccessibility: () => Promise.resolve(),
  zoomOnClickEnabled: true,
  setZoomOnClickEnabled: () => { },
  autoPasteEnabled: true,
  setAutoPasteEnabled: () => { },
  inputMode: 'mouse',
  setInputMode: () => { },
});

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
};
const INPUT_MODE_FALLBACK = 'mouse';
const isValidInputMode = (value) => value === 'mouse' || value === 'trackpad';
const normalizeInputMode = (value, fallback = INPUT_MODE_FALLBACK) => (
  isValidInputMode(value) ? value : fallback
);

const sanitizePreferencesValue = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
};

const DEFAULT_SETTINGS = Object.freeze({
  trayEnabled: true,
  zoomOnClickEnabled: true,
  autoPasteEnabled: true,
  inputMode: INPUT_MODE_FALLBACK,
  preferences: {},
});

const sanitizeSettings = (raw = {}) => ({
  trayEnabled: normalizeBoolean(raw.trayEnabled, DEFAULT_SETTINGS.trayEnabled),
  zoomOnClickEnabled: normalizeBoolean(raw.zoomOnClickEnabled, DEFAULT_SETTINGS.zoomOnClickEnabled),
  autoPasteEnabled: normalizeBoolean(raw.autoPasteEnabled, DEFAULT_SETTINGS.autoPasteEnabled),
  inputMode: normalizeInputMode(raw.inputMode, DEFAULT_SETTINGS.inputMode),
  preferences: sanitizePreferencesValue(raw.preferences ?? DEFAULT_SETTINGS.preferences),
});

export const SettingsProvider = ({ children }) => {
  const { user } = useSupabaseAuth();
  const [trayEnabled, setTrayEnabledState] = useState(true);
  const [accessibilityGranted, setAccessibilityGranted] = useState(null);
  const [zoomOnClickEnabled, setZoomOnClickEnabledState] = useState(true);
  const [autoPasteEnabled, setAutoPasteEnabledState] = useState(true);
  const [inputMode, setInputModeState] = useState(INPUT_MODE_FALLBACK);
  const settingsSnapshotRef = useRef(sanitizeSettings(DEFAULT_SETTINGS));

  const settingsBridge = useMemo(() => createSettingsBridge(), []);
  const loggerBridge = useMemo(() => createLoggerBridge(), []);
  const systemBridge = useMemo(() => createSystemBridge(), []);
  const trayBridge = useMemo(() => createTrayBridge(), []);

  const applySettingsState = useCallback((incoming = {}) => {
    const preservedPreferences = settingsSnapshotRef.current?.preferences;
    const mergedSource = {
      ...incoming,
    };
    if (typeof mergedSource.preferences === 'undefined' && preservedPreferences) {
      mergedSource.preferences = preservedPreferences;
    }
    const sanitized = sanitizeSettings(mergedSource);
    setTrayEnabledState(sanitized.trayEnabled);
    setZoomOnClickEnabledState(sanitized.zoomOnClickEnabled);
    setAutoPasteEnabledState(sanitized.autoPasteEnabled);
    setInputModeState(sanitized.inputMode);
    settingsSnapshotRef.current = sanitized;
    return sanitized;
  }, []);

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

    const applyFromPayload = (next = {}) => {
      if (!mounted) {
        return;
      }
      applySettingsState(next);
    };

    const load = async () => {
      try {
        const result = await settingsBridge.getSettings?.();
        const payload = result?.settings || result;
        if (payload) {
          applyFromPayload(payload);
        }
      } catch (error) {
        loggerBridge.log?.('warn', 'settings_load_failed', { message: error?.message });
      }
      if (mounted) {
        refreshAccessibilityStatus();
      }
    };

    load();
    const unsubscribe = settingsBridge.onSettings?.((payload) => applyFromPayload(payload));

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [applySettingsState, loggerBridge, refreshAccessibilityStatus, settingsBridge]);

  const syncSettingsRemote = useCallback(async (snapshot) => {
    if (!user) {
      return;
    }
    try {
      await upsertUserSettings({ userId: user.id, settings: snapshot });
    } catch (error) {
      loggerBridge.log?.('warn', 'settings_remote_sync_failed', { message: error?.message });
    }
  }, [loggerBridge, user]);

  const persistSettingsChange = useCallback((partial) => {
    const nextSnapshot = sanitizeSettings({
      ...settingsSnapshotRef.current,
      ...partial,
    });
    settingsSnapshotRef.current = nextSnapshot;

    settingsBridge.updateSettings?.(partial);
    syncSettingsRemote(nextSnapshot);
  }, [settingsBridge, syncSettingsRemote]);

  const setTrayEnabled = useCallback((next) => {
    const normalized = normalizeBoolean(next, true);
    setTrayEnabledState(normalized);
    persistSettingsChange({ trayEnabled: normalized });
    loggerBridge.log?.('info', 'settings_tray_changed', { enabled: normalized });
  }, [loggerBridge, persistSettingsChange]);

  const setZoomOnClickEnabled = useCallback((next) => {
    const normalized = normalizeBoolean(next, true);
    setZoomOnClickEnabledState(normalized);
    persistSettingsChange({ zoomOnClickEnabled: normalized });
    loggerBridge.log?.('info', 'settings_zoom_on_click_changed', { enabled: normalized });
  }, [loggerBridge, persistSettingsChange]);

  const setAutoPasteEnabled = useCallback((next) => {
    const normalized = normalizeBoolean(next, true);
    setAutoPasteEnabledState(normalized);
    persistSettingsChange({ autoPasteEnabled: normalized });
    loggerBridge.log?.('info', 'settings_autopaste_changed', { enabled: normalized });
  }, [loggerBridge, persistSettingsChange]);

  const setInputMode = useCallback((next) => {
    const normalized = normalizeInputMode(next, INPUT_MODE_FALLBACK);
    setInputModeState(normalized);
    persistSettingsChange({ inputMode: normalized });
    loggerBridge.log?.('info', 'settings_input_mode_changed', { mode: normalized });
  }, [loggerBridge, persistSettingsChange]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let cancelled = false;

    const loadRemoteSettings = async () => {
      try {
        const remote = await fetchUserSettings({ userId: user.id });
        if (cancelled) {
          return;
        }

        if (remote) {
          const sanitized = applySettingsState(remote);
          settingsBridge.updateSettings?.(sanitized);
        } else {
          await syncSettingsRemote(settingsSnapshotRef.current);
        }
      } catch (error) {
        loggerBridge.log?.('warn', 'settings_remote_load_failed', { message: error?.message });
      }
    };

    loadRemoteSettings();

    return () => {
      cancelled = true;
    };
  }, [applySettingsState, loggerBridge, settingsBridge, syncSettingsRemote, user]);

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
    autoPasteEnabled,
    setAutoPasteEnabled,
    inputMode,
    setInputMode,
  }), [
    trayEnabled,
    accessibilityGranted,
    setTrayEnabled,
    refreshAccessibilityStatus,
    requestAccessibility,
    zoomOnClickEnabled,
    setZoomOnClickEnabled,
    autoPasteEnabled,
    setAutoPasteEnabled,
    inputMode,
    setInputMode,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
