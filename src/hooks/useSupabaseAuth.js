import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase as rawClient, ensureSupabase } from '../lib/supabaseClient';

const isElectronRenderer = () => typeof window !== 'undefined' && typeof window.jarvisAPI !== 'undefined';

const buildRedirectUrl = (mode) => {
  if (isElectronRenderer()) {
    const params = new URLSearchParams();
    if (mode) {
      params.set('mode', mode);
    }
    params.set('from_oauth', '1');
    const query = params.toString();
    return `http://localhost:3000/auth/callback${query ? `?${query}` : ''}`;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  const url = new URL(window.location.href);
  if (mode) {
    url.searchParams.set('mode', mode);
  }
  url.searchParams.set('from_oauth', '1');
  url.hash = '';
  return url.toString();
};

const SupabaseContext = createContext({
  supabase: rawClient,
  session: null,
  user: null,
  loading: true,
  error: null,
  signInWithOAuth: async () => ({ data: null, error: new Error('supabase_not_ready') }),
  signOut: async () => {},
  refreshSession: async () => {},
});

export const SupabaseProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [supabaseClient, setSupabaseClient] = useState(rawClient);

  useEffect(() => {
    if (!rawClient) {
      setError(new Error('Supabase 환경변수가 설정되지 않았습니다. REACT_APP_SUPABASE_URL과 REACT_APP_SUPABASE_ANON_KEY를 확인하세요.'));
      setLoading(false);
      return;
    }

    setSupabaseClient(rawClient);

    let isMounted = true;

    const handleOAuthCallbackIfNeeded = async (incomingUrl) => {
      try {
        const urlToInspect = incomingUrl
          ? new URL(incomingUrl)
          : (typeof window !== 'undefined' ? new URL(window.location.href) : null);

        if (!urlToInspect) {
          return false;
        }

        const hasCode = urlToInspect.searchParams.has('code');
        const hasAccessToken = typeof urlToInspect.hash === 'string' && urlToInspect.hash.includes('access_token');
        if (!hasCode && !hasAccessToken) {
          return false;
        }

        let response;
        if (incomingUrl && hasCode) {
          response = await rawClient.auth.exchangeCodeForSession(urlToInspect.searchParams.get('code'));
        } else {
          response = await rawClient.auth.getSessionFromUrl({ storeSession: true });
        }

        if (!isMounted) {
          return true;
        }

        if (response.error) {
          setError(response.error);
          setLoading(false);
          return false;
        }

        setSession(response.data?.session ?? null);
        setError(null);

        if (!incomingUrl && typeof window !== 'undefined') {
          const cleanupUrl = new URL(window.location.href);
          const preserveMode = urlToInspect.searchParams.get('mode');
          ['code', 'state', 'from_oauth'].forEach((key) => cleanupUrl.searchParams.delete(key));
          if (preserveMode) {
            cleanupUrl.searchParams.set('mode', preserveMode);
          }
          cleanupUrl.hash = '';
          window.history.replaceState({}, document.title, `${cleanupUrl.pathname}${cleanupUrl.search}`);
        }

        setLoading(false);
        return true;
      } catch (err) {
        if (!isMounted) {
          return false;
        }
        setError(err);
        setLoading(false);
        return false;
      }
    };

    const init = async () => {
      if (await handleOAuthCallbackIfNeeded()) {
        return;
      }

      try {
        const { data, error: sessionError } = await rawClient.auth.getSession();
        if (!isMounted) {
          return;
        }
        if (sessionError) {
          setError(sessionError);
        }
        setSession(data?.session ?? null);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    init();

    const {
      data: subscription,
    } = rawClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError(null);
      setLoading(false);
    });

    const unsubscribeOAuth = typeof window !== 'undefined' && typeof window.jarvisAPI?.onOAuthCallback === 'function'
      ? window.jarvisAPI.onOAuthCallback((url) => {
          handleOAuthCallbackIfNeeded(url);
        })
      : undefined;

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
      if (typeof unsubscribeOAuth === 'function') {
        unsubscribeOAuth();
      }
    };
  }, []);

  const value = useMemo(() => ({
    supabase: supabaseClient,
    session,
    user: session?.user ?? null,
    loading,
    error,
    async signInWithOAuth(provider, options = {}) {
      const client = ensureSupabase();
      setLoading(true);
      setError(null);

      const useElectronFlow = isElectronRenderer();
      let redirectTo = buildRedirectUrl(options.mode);
      let electronRedirectUrl = null;

      if (useElectronFlow && typeof window !== 'undefined' && window.jarvisAPI?.getOAuthRedirect) {
        try {
          const response = await window.jarvisAPI.getOAuthRedirect({ mode: options.mode });
          if (response?.url) {
            redirectTo = response.url;
            electronRedirectUrl = response.url;
          }
        } catch (err) {
          console.warn('[supabase] Failed to prepare Electron OAuth callback URL', err);
        }
      }

      let queryParams;
      if (provider === 'google') {
        queryParams = { access_type: 'offline', prompt: 'select_account' };
      } else if (provider === 'kakao') {
        queryParams = { prompt: 'select_account' };
      }

      const { data, error: signInError } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams,
          skipBrowserRedirect: useElectronFlow,
        },
      });

      if (signInError) {
        setError(signInError);
        setLoading(false);
        return { data, error: signInError };
      }

      const targetUrl = data?.url || electronRedirectUrl;

      if (useElectronFlow) {
        if (targetUrl) {
          if (typeof window !== 'undefined' && window.jarvisAPI?.launchOAuth) {
            await window.jarvisAPI.launchOAuth(targetUrl);
          } else {
            window.open(targetUrl, '_blank', 'noopener');
          }
        }
        return { data, error: null };
      }

      if (targetUrl) {
        window.location.href = targetUrl;
      }

      return { data, error: signInError };
    },
    async signOut() {
      const client = ensureSupabase();
      setLoading(true);
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) {
        setError(signOutError);
      }
      setLoading(false);
    },
    async refreshSession() {
      const client = ensureSupabase();
      setLoading(true);
      const { data, error: refreshError } = await client.auth.refreshSession();
      if (refreshError) {
        setError(refreshError);
      }
      setSession(data?.session ?? null);
      setLoading(false);
      return { data, error: refreshError };
    },
  }), [supabaseClient, session, loading, error]);

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabaseAuth = () => useContext(SupabaseContext);
