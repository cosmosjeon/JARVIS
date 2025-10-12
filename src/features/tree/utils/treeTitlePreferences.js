const STORAGE_KEY = 'jarvis.treeTitlePreferences';

const memoryCache = new Map();
let hydrated = false;

const safeTrim = (value) => (typeof value === 'string' ? value.trim() : '');

const sanitizePreference = (preference) => {
  if (!preference || typeof preference !== 'object') {
    return null;
  }

  const manual = preference.manual === true;
  const title = safeTrim(preference.title);

  return {
    manual,
    title: title || null,
  };
};

const readFromStorage = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.entries(parsed).reduce((acc, [key, value]) => {
      if (!key) {
        return acc;
      }
      const sanitized = sanitizePreference(value);
      if (sanitized) {
        acc[key] = sanitized;
      }
      return acc;
    }, {});
  } catch (error) {
    return {};
  }
};

const writeToStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload = Array.from(memoryCache.entries()).reduce((acc, [key, value]) => {
      if (!key) {
        return acc;
      }
      const sanitized = sanitizePreference(value);
      if (sanitized) {
        acc[key] = sanitized;
      }
      return acc;
    }, {});

    if (Object.keys(payload).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // 저장 실패는 치명적이지 않으므로 무시
  }
};

const ensureHydrated = () => {
  if (hydrated) {
    return;
  }

  const snapshot = readFromStorage();
  Object.entries(snapshot).forEach(([treeId, preference]) => {
    memoryCache.set(treeId, preference);
  });
  hydrated = true;
};

const setPreference = (treeId, preference) => {
  if (!treeId) {
    return;
  }

  ensureHydrated();

  if (!preference) {
    memoryCache.delete(treeId);
    writeToStorage();
    return;
  }

  const current = memoryCache.get(treeId);
  const sanitized = sanitizePreference(preference);

  if (!sanitized) {
    memoryCache.delete(treeId);
    writeToStorage();
    return;
  }

  if (current && current.manual === sanitized.manual && current.title === sanitized.title) {
    return;
  }

  memoryCache.set(treeId, sanitized);
  writeToStorage();
};

const DEFAULT_PREFERENCE = Object.freeze({ manual: false, title: null });

export const getTreeTitlePreference = (treeId) => {
  if (!treeId) {
    return DEFAULT_PREFERENCE;
  }

  ensureHydrated();
  return memoryCache.get(treeId) || DEFAULT_PREFERENCE;
};

export const isTreeTitleManual = (treeId) => getTreeTitlePreference(treeId).manual === true;

export const markTreeTitleManual = (treeId, title) => {
  if (!treeId) {
    return;
  }

  const sanitizedTitle = safeTrim(title);
  setPreference(treeId, {
    manual: true,
    title: sanitizedTitle || null,
  });
};

export const markTreeTitleAuto = (treeId, title) => {
  if (!treeId) {
    return;
  }

  const sanitizedTitle = safeTrim(title);

  if (!sanitizedTitle) {
    setPreference(treeId, {
      manual: false,
      title: null,
    });
    return;
  }

  setPreference(treeId, {
    manual: false,
    title: sanitizedTitle,
  });
};

export const clearTreeTitlePreference = (treeId) => {
  if (!treeId) {
    return;
  }
  setPreference(treeId, null);
};

export default {
  getTreeTitlePreference,
  isTreeTitleManual,
  markTreeTitleManual,
  markTreeTitleAuto,
  clearTreeTitlePreference,
};
