import {
  PROVIDERS,
  normalizeProvider,
  callProvider,
  extractKeywordWithProvider,
  buildRequestFailedError,
} from '../../src/infrastructure/ai/providerClient.js';

const allowedChannels = new Set(['askRoot', 'askChild', 'extractKeyword']);

const REQUIRED_TOKEN = (process.env.AGENT_HTTP_TOKEN || '').trim();
const AUTH_HEADER = (process.env.AGENT_HTTP_HEADER || 'Authorization').toLowerCase();

const buildCorsHeaders = () => ({
  'Access-Control-Allow-Origin': process.env.AGENT_HTTP_CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': ['Content-Type', AUTH_HEADER || 'Authorization']
    .filter(Boolean)
    .map((header) => header.trim())
    .join(', '),
});

const sendJson = (res, statusCode, payload) => {
  const headers = {
    'Content-Type': 'application/json',
    ...buildCorsHeaders(),
  };
  res.status(statusCode).setHeader('Cache-Control', 'no-store');
  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      res.setHeader(key, value);
    }
  });
  res.json(payload);
};

const normalizeBody = (req) => {
  if (!req.body) {
    return {};
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return {};
    }
  }
  return req.body;
};

const mergePayload = (body) => {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const base = {
    ...(typeof body.payload === 'object' && body.payload ? body.payload : {}),
    ...body,
  };
  delete base.channel;
  delete base.payload;
  return base;
};

const verifyAuth = (req) => {
  if (!REQUIRED_TOKEN) {
    return true;
  }
  const headerValue = req.headers?.[AUTH_HEADER];
  if (!headerValue) {
    return false;
  }
  if (headerValue === REQUIRED_TOKEN) {
    return true;
  }
  if (headerValue === `Bearer ${REQUIRED_TOKEN}`) {
    return true;
  }
  return false;
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    const headers = buildCorsHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, {
      success: false,
      error: {
        code: 'method_not_allowed',
        message: '이 엔드포인트는 POST 요청만 허용합니다.',
      },
    });
    return;
  }

  if (!verifyAuth(req)) {
    sendJson(res, 401, {
      success: false,
      error: {
        code: 'unauthorized',
        message: '유효한 인증 토큰이 필요합니다.',
      },
    });
    return;
  }

  const { channel } = req.query || {};

  if (!allowedChannels.has(channel)) {
    sendJson(res, 404, {
      success: false,
      error: {
        code: 'AGENT_CHANNEL_INVALID',
        message: `알 수 없는 채널입니다: ${channel || 'unknown'}`,
      },
    });
    return;
  }

  const startedAt = Date.now();
  const body = normalizeBody(req);
  const payload = mergePayload(body);

  const normalizedProvider = normalizeProvider(payload.provider);
  payload.provider = normalizedProvider === PROVIDERS.AUTO ? PROVIDERS.OPENAI : normalizedProvider;

  if ((channel === 'askRoot' || channel === 'askChild') && !Array.isArray(payload.messages)) {
    payload.messages = Array.isArray(body?.messages) ? body.messages : [];
  }

  try {
    let result;
    if (channel === 'extractKeyword') {
      result = await extractKeywordWithProvider(payload);
    } else {
      result = await callProvider(payload);
    }

    const responsePayload = {
      success: result?.success !== false,
      ...result,
    };

    if (!responsePayload.provider) {
      responsePayload.provider = payload.provider;
    }
    if (!responsePayload.model && payload.model) {
      responsePayload.model = payload.model;
    }
    if (responsePayload.latencyMs === undefined) {
      responsePayload.latencyMs = Date.now() - startedAt;
    }

    sendJson(res, 200, responsePayload);
  } catch (error) {
    const normalizedError = error?.code
      ? error
      : buildRequestFailedError({ error: { code: 'agent_request_failed', message: error?.message } });

    sendJson(res, 502, {
      success: false,
      error: {
        code: normalizedError.code || 'agent_request_failed',
        message: normalizedError.message || '에이전트 요청에 실패했습니다.',
      },
    });
  }
}
