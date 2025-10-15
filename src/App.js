import React, { lazy, Suspense, useEffect, useMemo } from 'react';
import './App.css';
import './theme/glass.css';
import LibraryApp from 'features/library/ui/LibraryApp';
import { ThemeProvider } from 'shared/components/library/ThemeProvider';
import { SettingsProvider } from 'shared/hooks/SettingsContext';
import { SupabaseProvider } from 'shared/hooks/useSupabaseAuth';
import { getRuntime, getRuntimeLabel, constants as runtimeConstants } from 'shared/utils/platform';
import SupabaseAuthGate from './components/auth/SupabaseAuthGate';
import OAuthCallbackPage from './views/OAuthCallbackPage';

const WidgetShell = lazy(() => import('features/tree/ui/WidgetShell'));

const MODES = Object.freeze({
  LIBRARY: 'library',
  WIDGET: 'widget',
});

const DEFAULT_MODE = MODES.LIBRARY;

const ALLOWED_MODES_BY_RUNTIME = Object.freeze({
  [runtimeConstants.RUNTIME_ELECTRON]: new Set([MODES.LIBRARY, MODES.WIDGET]),
  [runtimeConstants.RUNTIME_WEB]: new Set([MODES.LIBRARY]),
  [runtimeConstants.RUNTIME_UNKNOWN]: new Set([MODES.LIBRARY]),
});

const resolveRequestedMode = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_MODE;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') || null;
};

const sanitizeModeForRuntime = (mode, runtimeLabel) => {
  const allowedModes = ALLOWED_MODES_BY_RUNTIME[runtimeLabel] || ALLOWED_MODES_BY_RUNTIME[runtimeConstants.RUNTIME_UNKNOWN];
  if (mode && allowedModes.has(mode)) {
    return mode;
  }
  return DEFAULT_MODE;
};

const ensureModeInLocation = (targetMode) => {
  if (typeof window === 'undefined') {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const current = params.get('mode');
  if (current === targetMode) {
    return;
  }
  params.set('mode', targetMode);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}?${nextSearch}${window.location.hash ?? ''}`;
  window.history.replaceState({}, document.title, nextUrl);
};

function App() {
  const runtime = useMemo(() => getRuntimeLabel(), []);
  const requestedMode = useMemo(resolveRequestedMode, []);
  const mode = useMemo(() => sanitizeModeForRuntime(requestedMode, runtime), [requestedMode, runtime]);

  const pathname = useMemo(() => {
    if (typeof window === 'undefined') {
      return '/';
    }
    return window.location.pathname || '/';
  }, []);

  useEffect(() => {
    if (requestedMode !== mode) {
      ensureModeInLocation(mode);
    }
  }, [mode, requestedMode]);

  const isAuthCallbackPath = useMemo(
    () => pathname.startsWith('/auth/callback'),
    [pathname],
  );

  useEffect(() => {
    if (isAuthCallbackPath) {
      document.body.classList.remove('widget-mode');
      return;
    }
    document.body.classList.toggle('widget-mode', mode !== MODES.LIBRARY);
  }, [isAuthCallbackPath, mode]);

  const defaultTheme = mode === MODES.WIDGET ? 'glass' : 'light';

  return (
    <SupabaseProvider>
      {isAuthCallbackPath ? (
        <OAuthCallbackPage />
      ) : (
        <ThemeProvider defaultTheme={defaultTheme} mode={mode}>
          <SettingsProvider>
            <SupabaseAuthGate mode={mode}>
              {mode === MODES.LIBRARY ? (
                <LibraryApp runtime={runtime} />
              ) : (
                <Suspense fallback={null}>
                  <WidgetShell />
                </Suspense>
              )}
            </SupabaseAuthGate>
          </SettingsProvider>
        </ThemeProvider>
      )}
    </SupabaseProvider>
  );
}

export default App;
