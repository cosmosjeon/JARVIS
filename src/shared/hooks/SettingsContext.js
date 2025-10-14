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
import { useTheme } from 'shared/components/library/ThemeProvider';
import {
  fetchUserSettings,
  upsertUserSettings,
} from 'infrastructure/supabase/services/settingsService';
import { getRuntimeLabel, constants as runtimeConstants } from 'shared/utils/platform';

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
  libraryTheme: 'light',
  setLibraryThemePreference: () => { },
  widgetTheme: 'glass',
  setWidgetThemePreference: () => { },
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

const LIBRARY_THEME_FALLBACK = 'light';
const isValidLibraryTheme = (value) => value === 'light' || value === 'dark';
const normalizeLibraryTheme = (value, fallback = LIBRARY_THEME_FALLBACK) => (
  isValidLibraryTheme(value) ? value : fallback
);

const WIDGET_THEME_FALLBACK = 'glass';
const isValidWidgetTheme = (value) => value === 'glass' || value === 'light' || value === 'dark';
const normalizeWidgetTheme = (value, fallback = WIDGET_THEME_FALLBACK) => (
  isValidWidgetTheme(value) ? value : fallback
);

const DEFAULT_SETTINGS = Object.freeze({
  trayEnabled: true,
  zoomOnClickEnabled: true,
  autoPasteEnabled: true,
  inputMode: INPUT_MODE_FALLBACK,
  libraryTheme: LIBRARY_THEME_FALLBACK,
  widgetTheme: WIDGET_THEME_FALLBACK,
  preferences: {},
});

const sanitizeSettings = (raw = {}) => ({
  trayEnabled: normalizeBoolean(raw.trayEnabled, DEFAULT_SETTINGS.trayEnabled),
  zoomOnClickEnabled: normalizeBoolean(raw.zoomOnClickEnabled, DEFAULT_SETTINGS.zoomOnClickEnabled),
  autoPasteEnabled: normalizeBoolean(raw.autoPasteEnabled, DEFAULT_SETTINGS.autoPasteEnabled),
  inputMode: normalizeInputMode(raw.inputMode, DEFAULT_SETTINGS.inputMode),
  libraryTheme: normalizeLibraryTheme(raw.libraryTheme, DEFAULT_SETTINGS.libraryTheme),
  widgetTheme: normalizeWidgetTheme(raw.widgetTheme, DEFAULT_SETTINGS.widgetTheme),
  preferences: sanitizePreferencesValue(raw.preferences ?? DEFAULT_SETTINGS.preferences),
});

export const SettingsProvider = ({ children }) => {
  const { user } = useSupabaseAuth();
  const runtimeLabel = useMemo(() => getRuntimeLabel(), []);
  const isElectronRuntime = runtimeLabel === runtimeConstants.RUNTIME_ELECTRON;
  const [trayEnabled, setTrayEnabledState] = useState(true);
  const [accessibilityGranted, setAccessibilityGranted] = useState(null);
  const [zoomOnClickEnabled, setZoomOnClickEnabledState] = useState(true);
  const [autoPasteEnabled, setAutoPasteEnabledState] = useState(true);
  const [inputMode, setInputModeState] = useState(INPUT_MODE_FALLBACK);
  const [libraryTheme, setLibraryThemeState] = useState(LIBRARY_THEME_FALLBACK);
  const [widgetTheme, setWidgetThemeState] = useState(WIDGET_THEME_FALLBACK);
  const settingsSnapshotRef = useRef(sanitizeSettings(DEFAULT_SETTINGS));

  const settingsBridge = useMemo(
    () => (isElectronRuntime ? createSettingsBridge() : {}),
    [isElectronRuntime],
  );
  const loggerBridge = useMemo(() => {
    if (isElectronRuntime) {
      return createLoggerBridge();
    }
    return {
      log: (level, message, metadata) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console[level === 'warn' ? 'warn' : 'log']?.(
            `[settings] ${message}`,
            metadata,
          );
        }
      },
    };
  }, [isElectronRuntime]);
  const systemBridge = useMemo(
    () => (isElectronRuntime ? createSystemBridge() : {}),
    [isElectronRuntime],
  );
  const trayBridge = useMemo(
    () => (isElectronRuntime ? createTrayBridge() : {}),
    [isElectronRuntime],
  );
  const themeBridge = useTheme();

  const applySettingsState = useCallback((incoming = {}) => {
    const preservedPreferences = settingsSnapshotRef.current?.preferences;
    const preservedLibraryTheme = settingsSnapshotRef.current?.libraryTheme;
    const preservedWidgetTheme = settingsSnapshotRef.current?.widgetTheme;
    const mergedSource = {
      ...incoming,
    };
    if (typeof mergedSource.preferences === 'undefined' && preservedPreferences) {
      mergedSource.preferences = preservedPreferences;
    }
    if (typeof mergedSource.libraryTheme === 'undefined' && preservedLibraryTheme) {
      mergedSource.libraryTheme = preservedLibraryTheme;
    }
    if (typeof mergedSource.widgetTheme === 'undefined' && preservedWidgetTheme) {
      mergedSource.widgetTheme = preservedWidgetTheme;
    }
    const sanitized = sanitizeSettings(mergedSource);
    setTrayEnabledState(sanitized.trayEnabled);
    setZoomOnClickEnabledState(sanitized.zoomOnClickEnabled);
    setAutoPasteEnabledState(sanitized.autoPasteEnabled);
    setInputModeState(sanitized.inputMode);
    setLibraryThemeState(sanitized.libraryTheme);
    setWidgetThemeState(sanitized.widgetTheme);
    const mode = themeBridge?.mode;
    if (mode === 'library') {
      themeBridge?.setTheme?.(sanitized.libraryTheme);
    } else if (mode === 'widget') {
      themeBridge?.setTheme?.(sanitized.widgetTheme);
    }
    settingsSnapshotRef.current = sanitized;
    return sanitized;
  }, [themeBridge]);

  const refreshAccessibilityStatus = useCallback(async () => {
    if (!isElectronRuntime) {
      setAccessibilityGranted(null);
      return;
    }
    try {
      const result = await systemBridge.checkAccessibilityPermission?.();
      if (result && typeof result.granted === 'boolean') {
        setAccessibilityGranted(result.granted);
      }
    } catch (error) {
      loggerBridge.log?.('warn', 'accessibility_status_failed', { message: error?.message });
    }
  }, [isElectronRuntime, loggerBridge, systemBridge]);

  useEffect(() => {
    let mounted = true;

    const applyFromPayload = (next = {}) => {
      if (!mounted) {
        return;
      }
      applySettingsState(next);
    };

    const loadElectronSettings = async () => {
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

    const loadWebSettings = async () => {
      if (!user?.id) {
        applyFromPayload(DEFAULT_SETTINGS);
        return;
      }
      try {
        const remoteSettings = await fetchUserSettings({ userId: user.id });
        if (remoteSettings) {
          applyFromPayload(remoteSettings);
        } else {
          applyFromPayload(DEFAULT_SETTINGS);
        }
      } catch (error) {
        loggerBridge.log?.('warn', 'settings_remote_load_failed', { message: error?.message });
        applyFromPayload(DEFAULT_SETTINGS);
      }
    };

    if (isElectronRuntime) {
      loadElectronSettings();
      const unsubscribe = settingsBridge.onSettings?.((payload) => applyFromPayload(payload));

      return () => {
        mounted = false;
        unsubscribe?.();
      };
    }

    loadWebSettings();

    return () => {
      mounted = false;
    };
  }, [
    applySettingsState,
    isElectronRuntime,
    loggerBridge,
    refreshAccessibilityStatus,
    settingsBridge,
    user?.id,
  ]);

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

  const setLibraryThemePreference = useCallback((next) => {
    const normalized = normalizeLibraryTheme(next, LIBRARY_THEME_FALLBACK);
    setLibraryThemeState(normalized);
    if (themeBridge?.mode === 'library') {
      themeBridge?.setTheme?.(normalized);
    }
    persistSettingsChange({ libraryTheme: normalized });
    loggerBridge.log?.('info', 'settings_library_theme_changed', { theme: normalized });
  }, [loggerBridge, persistSettingsChange, themeBridge]);

  const setWidgetThemePreference = useCallback((next) => {
    const normalized = normalizeWidgetTheme(next, WIDGET_THEME_FALLBACK);
    setWidgetThemeState(normalized);
    if (themeBridge?.mode === 'widget') {
      themeBridge?.setTheme?.(normalized);
    }
    persistSettingsChange({ widgetTheme: normalized });
    loggerBridge.log?.('info', 'settings_widget_theme_changed', { theme: normalized });
  }, [loggerBridge, persistSettingsChange, themeBridge]);

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
    if (!isElectronRuntime) {
      return { granted: null };
    }
    const result = await systemBridge.requestAccessibilityPermission?.();
    refreshAccessibilityStatus();
    return result;
  }, [isElectronRuntime, refreshAccessibilityStatus, systemBridge]);

  useEffect(() => {
    if (!isElectronRuntime || !trayBridge.onTrayCommand) {
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
  }, [isElectronRuntime, refreshAccessibilityStatus, requestAccessibility, trayBridge]);

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
    libraryTheme,
    setLibraryThemePreference,
    widgetTheme,
    setWidgetThemePreference,
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
    libraryTheme,
    setLibraryThemePreference,
    widgetTheme,
    setWidgetThemePreference,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
