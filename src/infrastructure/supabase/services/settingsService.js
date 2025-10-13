import { ensureSupabase } from 'shared/lib/supabaseClient';

const DEFAULT_DB_SETTINGS = Object.freeze({
  trayEnabled: true,
  zoomOnClickEnabled: true,
  autoPasteEnabled: true,
  inputMode: 'mouse',
  libraryTheme: 'light',
  widgetTheme: 'glass',
  preferences: {},
});

const toBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return Boolean(value);
};

const sanitizePreferences = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
};

const normalizeLibraryTheme = (value, fallback = DEFAULT_DB_SETTINGS.libraryTheme) => {
  if (value === 'dark') {
    return 'dark';
  }
  return fallback;
};

const normalizeWidgetTheme = (value, fallback = DEFAULT_DB_SETTINGS.widgetTheme) => {
  if (value === 'light' || value === 'dark' || value === 'glass') {
    return value;
  }
  return fallback;
};

const mapRowToSettings = (row) => {
  if (!row) {
    return null;
  }

  return {
    trayEnabled: toBoolean(row.tray_enabled, DEFAULT_DB_SETTINGS.trayEnabled),
    zoomOnClickEnabled: toBoolean(row.zoom_on_click_enabled, DEFAULT_DB_SETTINGS.zoomOnClickEnabled),
    autoPasteEnabled: toBoolean(row.auto_paste_enabled, DEFAULT_DB_SETTINGS.autoPasteEnabled),
    inputMode: typeof row.input_mode === 'string' ? row.input_mode : DEFAULT_DB_SETTINGS.inputMode,
    libraryTheme: normalizeLibraryTheme(row.library_theme, DEFAULT_DB_SETTINGS.libraryTheme),
    widgetTheme: normalizeWidgetTheme(row.widget_theme, DEFAULT_DB_SETTINGS.widgetTheme),
    preferences: sanitizePreferences(row.preferences),
    updatedAt: typeof row.updated_at === 'number' ? row.updated_at : null,
    createdAt: typeof row.created_at === 'number' ? row.created_at : null,
  };
};

const buildUpsertPayload = ({ userId, settings }) => {
  if (!userId) {
    throw new Error('userId is required to upsert user settings');
  }

  const merged = {
    ...DEFAULT_DB_SETTINGS,
    ...(settings || {}),
  };

  return {
    user_id: userId,
    tray_enabled: toBoolean(merged.trayEnabled, DEFAULT_DB_SETTINGS.trayEnabled),
    zoom_on_click_enabled: toBoolean(merged.zoomOnClickEnabled, DEFAULT_DB_SETTINGS.zoomOnClickEnabled),
    auto_paste_enabled: toBoolean(merged.autoPasteEnabled, DEFAULT_DB_SETTINGS.autoPasteEnabled),
    input_mode: typeof merged.inputMode === 'string' ? merged.inputMode : DEFAULT_DB_SETTINGS.inputMode,
    library_theme: normalizeLibraryTheme(merged.libraryTheme, DEFAULT_DB_SETTINGS.libraryTheme),
    widget_theme: normalizeWidgetTheme(merged.widgetTheme, DEFAULT_DB_SETTINGS.widgetTheme),
    preferences: sanitizePreferences(merged.preferences),
  };
};

export const fetchUserSettings = async ({ userId }) => {
  if (!userId) {
    return null;
  }

  const supabase = ensureSupabase();
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapRowToSettings(data);
};

export const upsertUserSettings = async ({ userId, settings }) => {
  const supabase = ensureSupabase();
  const payload = buildUpsertPayload({ userId, settings });

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapRowToSettings(data) || mapRowToSettings(payload);
};

export default {
  fetchUserSettings,
  upsertUserSettings,
};
