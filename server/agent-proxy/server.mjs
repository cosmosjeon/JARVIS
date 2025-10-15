import http from 'node:http';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import {
  PROVIDERS,
  PROVIDER_LABELS,
  normalizeProvider,
  callProvider,
  extractKeywordWithProvider,
  buildRequestFailedError,
  toTrimmedString,
} from '../../src/infrastructure/ai/providerClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const candidateEnvFiles = [
  '.env.agent-proxy.local',
  '.env.agent-proxy',
  '.env.local',
  '.env',
];

candidateEnvFiles.forEach((relativePath) => {
  const fullPath = path.resolve(projectRoot, relativePath);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath, override: false });
  }
});

const PORT = Number.parseInt(process.env.AGENT_PROXY_PORT, 10) || 8787;
const HOST = process.env.AGENT_PROXY_HOST || '0.0.0.0';
const REQUIRED_TOKEN = toTrimmedString(process.env.AGENT_PROXY_TOKEN || '');
const AUTH_HEADER = (process.env.AGENT_PROXY_HEADER || 'Authorization').toLowerCase();
const CORS_ORIGIN = process.env.AGENT_PROXY_CORS_ORIGIN || '*';
const MAX_BODY_BYTES = Number.parseInt(process.env.AGENT_PROXY_MAX_BODY_BYTES, 10) || 1_048_576;

const allowedChannels = new Set(['askRoot', 'askChild', 'extractKeyword']);

const metrics = {
  totalRequests: 0,
  successCount: 0,
  failureCount: 0,
  latencyTotalMs: 0,
  perChannel: new Map(),
};

const recordMetrics = ({ channel, success, latencyMs }) => {
  if (typeof channel !== 'string') {
    return;
  }
  metrics.totalRequests += 1;
  if (success) {
    metrics.successCount += 1;
  } else {
    metrics.failureCount += 1;
  }
  if (Number.isFinite(latencyMs)) {
    metrics.latencyTotalMs += latencyMs;
  }
  if (!metrics.perChannel.has(channel)) {
    metrics.perChannel.set(channel, { total: 0, success: 0, failure: 0, latencyMsTotal: 0 });
  }
  const entry = metrics.perChannel.get(channel);
  entry.total += 1;
  if (success) {
    entry.success += 1;
  } else {
    entry.failure += 1;
  }
  if (Number.isFinite(latencyMs)) {
    entry.latencyMsTotal += latencyMs;
  }
};

const renderMetrics = () => {
  const avgLatency = metrics.totalRequests > 0
    ? metrics.latencyTotalMs / metrics.totalRequests
    : 0;
  let output = '';
  output += `agent_requests_total ${metrics.totalRequests}\n`;
  output += `agent_requests_success_total ${metrics.successCount}\n`;
  output += `agent_requests_failure_total ${metrics.failureCount}\n`;
  output += `agent_requests_latency_ms_average ${avgLatency.toFixed(2)}\n`;

  metrics.perChannel.forEach((entry, channel) => {
    const label = `channel="${channel}"`;
    const channelAvg = entry.total > 0 ? entry.latencyMsTotal / entry.total : 0;
    output += `agent_channel_requests_total{${label}} ${entry.total}\n`;
    output += `agent_channel_requests_success_total{${label}} ${entry.success}\n`;
    output += `agent_channel_requests_failure_total{${label}} ${entry.failure}\n`;
    output += `agent_channel_latency_ms_average{${label}} ${channelAvg.toFixed(2)}\n`;
  });

  return output;
};

const buildCorsHeaders = () => {
  const headers = new Set(['content-type', 'authorization']);
  headers.add(AUTH_HEADER);
  return Array.from(headers)
    .filter(Boolean)
    .map((name) => name.trim())
    .join(', ');
};

const CORS_HEADERS = buildCorsHeaders();

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': CORS_HEADERS,
  });
  res.end(body);
};

const sendEmpty = (res, statusCode) => {
  res.writeHead(statusCode, {
    'Content-Length': 0,
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': CORS_HEADERS,
  });
  res.end();
};

const readRequestBody = (req) => new Promise((resolve, reject) => {
  let received = 0;
  let buffer = '';

  req.setEncoding('utf8');

  req.on('data', (chunk) => {
    received += chunk.length;
    if (received > MAX_BODY_BYTES) {
      const error = new Error('Payload too large');
      error.code = 'payload_too_large';
      reject(error);
      req.destroy();
      return;
    }
    buffer += chunk;
  });

  req.on('end', () => {
    if (!buffer) {
      resolve({});
      return;
    }
    try {
      const parsed = JSON.parse(buffer);
      resolve(parsed && typeof parsed === 'object' ? parsed : {});
    } catch (_error) {
      const error = new Error('Invalid JSON payload');
      error.code = 'invalid_json';
      reject(error);
    }
  });

  req.on('error', (error) => {
    reject(error);
  });
});

const verifyAuth = (req) => {
  if (!REQUIRED_TOKEN) {
    return true;
  }
  const headerValue = req.headers[AUTH_HEADER];
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

const resolveChannelFromPath = (pathname) => {
  const trimmed = pathname.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  if (!trimmed) {
    return null;
  }
  const segments = trimmed.split('/');
  return segments[segments.length - 1];
};

const mergePayload = (body) => {
  const base = {
    ...(typeof body?.payload === 'object' && body.payload ? body.payload : {}),
    ...(body && typeof body === 'object' ? body : {}),
  };
  delete base.channel;
  delete base.payload;
  return base;
};

const normalizeErrorResponse = (error) => {
  const code = error?.code || 'internal_error';
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : '에이전트 프록시 요청 처리 중 오류가 발생했습니다.';
  return { code, message };
};

const statusFromErrorCode = (code) => {
  switch (code) {
    case 'invalid_json':
      return 400;
    case 'payload_too_large':
      return 413;
    case 'unauthorized':
      return 401;
    case 'AGENT_PROVIDER_INVALID':
      return 400;
    case 'AGENT_PROVIDER_MISSING_CONFIG':
      return 500;
    case 'AGENT_CHANNEL_INVALID':
      return 404;
    case 'AGENT_REQUEST_TIMEOUT':
      return 504;
    case 'http_agent_network_error':
    case 'http_agent_invalid_json':
    case 'http_agent_empty_response':
    case 'http_agent_failed':
    case 'AGENT_BRIDGE_MISSING':
      return 502;
    default:
      return 500;
  }
};

const handleAgentRequest = async (channel, payload) => {
  if (channel === 'askRoot' || channel === 'askChild') {
    return callProvider(payload);
  }
  if (channel === 'extractKeyword') {
    return extractKeywordWithProvider(payload);
  }
  throw buildRequestFailedError({
    error: {
      code: 'unsupported_channel',
      message: `지원하지 않는 채널입니다: ${channel}`,
    },
  });
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const { pathname } = requestUrl;

  if (req.method === 'GET' && pathname === '/metrics') {
    const metricsBody = renderMetrics();
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(metricsBody),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(metricsBody);
    return;
  }

  if (req.method === 'OPTIONS') {
    sendEmpty(res, 204);
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
    const error = new Error('유효한 인증 토큰이 필요합니다.');
    error.code = 'unauthorized';
    const status = statusFromErrorCode(error.code);
    sendJson(res, status, { success: false, error: normalizeErrorResponse(error) });
    return;
  }

  const channel = resolveChannelFromPath(pathname);

  if (!channel || !allowedChannels.has(channel)) {
    const error = new Error(`알 수 없는 채널입니다: ${channel || 'unknown'}`);
    error.code = 'AGENT_CHANNEL_INVALID';
    const status = statusFromErrorCode(error.code);
    sendJson(res, status, { success: false, error: normalizeErrorResponse(error) });
    return;
  }

  const startedAt = Date.now();

  try {
    const rawBody = await readRequestBody(req);
    const payload = mergePayload(rawBody);

    if (!payload.provider || payload.provider === PROVIDERS.AUTO) {
      payload.provider = PROVIDERS.OPENAI;
    } else {
      payload.provider = normalizeProvider(payload.provider);
    }

    if (!payload.messages && (channel === 'askRoot' || channel === 'askChild')) {
      payload.messages = Array.isArray(rawBody?.messages) ? rawBody.messages : [];
    }

    console.log(`[agent-proxy] ${channel} 요청:`, {
      provider: payload.provider,
      model: payload.model,
      messagesCount: payload.messages?.length
    });

    const result = await handleAgentRequest(channel, payload);

    console.log(`[agent-proxy] ${channel} 응답:`, {
      success: result.success,
      hasAnswer: !!result.answer,
      hasCitations: !!result.citations,
      citationsCount: result.citations?.length || 0,
      latencyMs: Date.now() - startedAt
    });

    if (!result || typeof result !== 'object') {
      throw buildRequestFailedError({
        error: {
          code: 'agent_empty_response',
          message: 'LLM 응답이 비어 있습니다.',
        },
      });
    }

    const responsePayload = {
      success: result.success !== false,
      ...result,
    };

    if (responsePayload.latencyMs === undefined) {
      responsePayload.latencyMs = Date.now() - startedAt;
    }

    if (!responsePayload.provider) {
      responsePayload.provider = payload.provider;
    }

    if (!responsePayload.model && payload.model) {
      responsePayload.model = payload.model;
    }

    recordMetrics({
      channel,
      success: responsePayload.success !== false,
      latencyMs: responsePayload.latencyMs,
    });

    sendJson(res, 200, responsePayload);
  } catch (error) {
    const normalizedError = normalizeErrorResponse(error);
    const status = statusFromErrorCode(normalizedError.code);
    recordMetrics({
      channel,
      success: false,
      latencyMs: Date.now() - startedAt,
    });
    sendJson(res, status, { success: false, error: normalizedError });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[agent-proxy] listening on http://${HOST}:${PORT}`);
});
