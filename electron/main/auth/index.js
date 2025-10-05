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

          const html = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>로그인이 완료되었습니다</title>
    <meta name="robots" content="noindex" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; }
      main { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
      .card { background: rgba(15,23,42,0.72); padding: 32px 28px; border-radius: 16px; max-width: 360px; text-align: center; box-shadow: 0 24px 60px rgba(15,23,42,0.35); border: 1px solid rgba(148,163,184,0.18); }
      h1 { font-size: 20px; font-weight: 600; margin: 0 0 12px; }
      p { font-size: 14px; line-height: 1.6; color: rgba(226,232,240,0.78); margin: 0 0 20px; }
      button { width: 100%; padding: 12px 16px; border-radius: 12px; border: none; font-weight: 600; font-size: 15px; cursor: pointer; background: linear-gradient(135deg, #38bdf8, #6366f1); color: #0f172a; }
      small { display: block; margin-top: 12px; font-size: 12px; color: rgba(148,163,184,0.75); }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>로그인이 완료되었습니다</h1>
        <p>JARVIS 앱으로 돌아가는 중입니다. 브라우저 창은 닫아도 됩니다.</p>
        <button onclick="finish()">앱으로 돌아가기</button>
        <small>창이 닫히지 않으면 버튼을 다시 눌러주세요.</small>
      </div>
    </main>
    <script>
      function finish() {
        window.close();
        setTimeout(function () { window.close(); }, 1500);
      }
      setTimeout(finish, 500);
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
