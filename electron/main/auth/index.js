const http = require('http');
const { shell, BrowserWindow } = require('electron');

const DEFAULT_AUTH_CALLBACK_PORT = 54545;

const createOAuthServer = ({
  logger,
  settings,
  sendOAuthCallback,
  getFocusWindow,
}) => {
  let authServer;
  let authServerPort;
  let authServerReadyPromise;

  const ensureAuthCallbackServer = (desiredPort) => {
    if (authServerReadyPromise) {
      return authServerReadyPromise;
    }

    authServerReadyPromise = new Promise((resolve, reject) => {
      authServer = http.createServer((req, res) => {
        try {
          if (!req.url) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid request');
            return;
          }

          const effectivePort = authServerPort || desiredPort || DEFAULT_AUTH_CALLBACK_PORT;
          const requestUrl = new URL(req.url, `http://127.0.0.1:${effectivePort}`);

          if (requestUrl.pathname !== '/auth/callback') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
          }

          logger?.info('Auth callback received', { url: requestUrl.toString() });
          sendOAuthCallback(requestUrl.toString());

          // URL에서 mode 파라미터 확인
          const mode = requestUrl.searchParams.get('mode') || 'widget';
          const isLibraryMode = mode === 'library';
          
          // 테마별 CSS 변수 설정
          const themeVars = isLibraryMode ? {
            // 라이트 테마 (라이브러리 모드)
            background: '0 0% 100%',
            foreground: '220 15% 20%',
            card: '0 0% 100%',
            cardForeground: '220 15% 20%',
            primary: '213 74% 47%',
            primaryForeground: '210 40% 98%',
            secondary: '36 20% 90%',
            secondaryForeground: '30 20% 25%',
            muted: '45 12% 90%',
            mutedForeground: '30 9% 45%',
            border: '40 15% 80%',
            radius: '0.75rem'
          } : {
            // 다크 테마 (위젯 모드)
            background: '218 22% 12%',
            foreground: '48 22% 90%',
            card: '220 18% 16%',
            cardForeground: '48 22% 90%',
            primary: '213 70% 62%',
            primaryForeground: '220 18% 14%',
            secondary: '220 14% 20%',
            secondaryForeground: '48 20% 85%',
            muted: '220 14% 22%',
            mutedForeground: '45 15% 70%',
            border: '220 15% 26%',
            radius: '0.75rem'
          };

          const html = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>로그인이 완료되었습니다</title>
    <meta name="robots" content="noindex" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      :root {
        --background: ${themeVars.background};
        --foreground: ${themeVars.foreground};
        --card: ${themeVars.card};
        --card-foreground: ${themeVars.cardForeground};
        --primary: ${themeVars.primary};
        --primary-foreground: ${themeVars.primaryForeground};
        --secondary: ${themeVars.secondary};
        --secondary-foreground: ${themeVars.secondaryForeground};
        --muted: ${themeVars.muted};
        --muted-foreground: ${themeVars.mutedForeground};
        --border: ${themeVars.border};
        --radius: ${themeVars.radius};
      }
      
      body {
        background: hsl(var(--background));
        color: hsl(var(--foreground));
        font-family: "Spoqa Han Sans Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .glass-card {
        background: ${isLibraryMode ? 'hsl(var(--card))' : 'hsl(var(--card) / 0.95)'};
        ${isLibraryMode ? '' : 'backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);'}
        border: 1px solid hsl(var(--border));
        box-shadow: ${isLibraryMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : '0 22px 48px rgba(0, 0, 0, 0.45)'};
      }
    </style>
  </head>
  <body class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="glass-card rounded-lg p-6 shadow-xl">
        <div class="space-y-3 pb-6">
          <div class="flex items-center justify-center mb-2">
            <div class="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg class="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 class="text-2xl text-center font-bold">로그인이 완료되었습니다</h1>
          <p class="text-center leading-relaxed text-muted-foreground">
            JARVIS 앱으로 돌아가는 중입니다.<br />
            브라우저 창은 닫아도 됩니다.
          </p>
        </div>
        <div class="space-y-4 pt-2">
          <div class="mt-4 p-3 rounded-lg bg-muted/50">
            <p class="text-center text-xs text-muted-foreground">
              자동으로 앱으로 돌아갑니다...
            </p>
          </div>
        </div>
      </div>
      <p class="text-center text-xs text-muted-foreground mt-6">
        로그인하시면 <span class="text-foreground font-medium">서비스 이용약관</span> 및{' '}
        <span class="text-foreground font-medium">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
      </p>
    </div>
    <script>
      setTimeout(function () { window.close(); }, 1500);
    </script>
  </body>
</html>`;

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
          });
          res.end(html);
        } catch (error) {
          logger?.error('auth_callback_handler_error', { message: error?.message });
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal error');
        }
      });

      authServer.on('error', (error) => {
        logger?.error('auth_callback_server_error', { message: error?.message });
        reject(error);
      });

      const listenPort = Number.isInteger(desiredPort) && desiredPort > 0 ? desiredPort : DEFAULT_AUTH_CALLBACK_PORT;

      authServer.listen(listenPort, '127.0.0.1', () => {
        authServerPort = authServer.address().port;
        logger?.info('Auth callback server listening', { authServerPort });
        resolve(authServerPort);
      });
    });

    return authServerReadyPromise;
  };

  const sendOAuthCallbackToRenderers = (url) => {
    if (!url) {
      return;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const host = parsed.host;
        if (
          !host.includes('gkdiarpitajgbfpvkazc.supabase.co') &&
          !host.startsWith('localhost') &&
          !host.startsWith('127.0.0.1')
        ) {
          return;
        }
      }
    } catch (error) {
      // ignore malformed URLs
    }

    sendOAuthCallback(url);

    const focusTarget = getFocusWindow();
    if (focusTarget) {
      focusTarget.show();
      focusTarget.focus();
    }
  };

  const handleOAuthDeepLink = (url) => {
    if (!url || typeof url !== 'string') {
      return;
    }
    sendOAuthCallbackToRenderers(url);
  };

  return {
    ensureAuthCallbackServer,
    handleOAuthDeepLink,
    teardown: () => {
      if (authServer) {
        authServer.close();
        authServer = null;
      }
    },
  };
};

const createOAuthHandlers = ({
  ipcMain,
  logger,
  ensureAuthCallbackServer,
  handleOAuthDeepLink,
  pendingOAuthCallbacks,
  getFocusWindow,
}) => {
  ipcMain.handle('auth:launch-oauth', async (_event, payload = {}) => {
    const targetUrl = typeof payload?.url === 'string' ? payload.url : null;
    if (!targetUrl) {
      return { success: false, error: { code: 'invalid_url', message: 'OAuth URL required' } };
    }

    try {
      await shell.openExternal(targetUrl);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'open_external_failed',
          message: error?.message || 'Failed to open OAuth URL in browser',
        },
      };
    }
  });

  ipcMain.handle('auth:get-callback-url', async (_event, payload = {}) => {
    try {
      const desiredPort = parseInt(process.env.SUPABASE_CALLBACK_PORT || '', 10);
      const port = await ensureAuthCallbackServer(desiredPort);
      const params = new URLSearchParams();
      if (payload?.mode) {
        params.set('mode', payload.mode);
      }
      const query = params.toString();
      return {
        success: true,
        url: `http://127.0.0.1:${port}/auth/callback${query ? `?${query}` : ''}`,
      };
    } catch (error) {
      logger?.error('auth_callback_url_failed', { message: error?.message });
      return {
        success: false,
        error: {
          code: 'callback_not_ready',
          message: error?.message || 'Failed to prepare auth callback server',
        },
      };
    }
  });

  const flushPendingCallbacks = () => {
    if (!pendingOAuthCallbacks.length) {
      return;
    }

    pendingOAuthCallbacks.splice(0).forEach((url) => {
      sendOAuthCallback(url);
      const focusTarget = getFocusWindow();
      if (focusTarget) {
        focusTarget.show();
        focusTarget.focus();
      }
    });
  };

  return {
    flushPendingCallbacks,
    handleOAuthDeepLink,
  };
};

module.exports = {
  createOAuthServer,
  createOAuthHandlers,
};
