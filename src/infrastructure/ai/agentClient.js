import { createAgentBridge } from '../electron/bridges';
import {
  PROVIDERS,
  PROVIDER_LABELS,
  FALLBACK_CONFIG,
  normalizeProvider,
  getFallbackConfig,
  getFallbackApiKey,
  canUseFallback,
  callProvider,
  extractKeywordWithProvider,
  buildRequestFailedError,
  toTrimmedString,
} from './providerClient';

export { PROVIDERS } from './providerClient';

const resolveAgentBridge = (bridgeOverride) => createAgentBridge(bridgeOverride);

const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.REACT_APP_AGENT_REQUEST_TIMEOUT_MS,
  10,
) || 45000;

const buildRequestTimeoutError = ({ channel, provider }) => {
  const timeoutSeconds = Math.round(REQUEST_TIMEOUT_MS / 1000);
  const readableChannel = channel || 'agent request';
  const readableProvider = provider ? PROVIDER_LABELS[normalizeProvider(provider)] || provider : 'AI';
  const error = new Error(
    `${readableProvider} ${readableChannel}가 ${timeoutSeconds}초 내에 완료되지 않았습니다. 잠시 후 다시 시도해주세요.`,
  );
  error.code = 'AGENT_REQUEST_TIMEOUT';
  error.channel = readableChannel;
  error.provider = provider || null;
  return error;
};

const executeWithTimeout = async (executor, context) => {
  const timeoutMs = REQUEST_TIMEOUT_MS;
  if (!timeoutMs || timeoutMs <= 0 || typeof executor !== 'function') {
    return executor?.();
  }

  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(buildRequestTimeoutError(context || {}));
    }, timeoutMs);
  });

  try {
    const taskPromise = Promise.resolve().then(executor);
    return await Promise.race([taskPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const HTTP_AGENT_ENDPOINT = toTrimmedString(
  process.env.REACT_APP_AGENT_HTTP_ENDPOINT || process.env.AGENT_HTTP_ENDPOINT || '',
);

const HTTP_AGENT_AUTH_TOKEN = toTrimmedString(
  process.env.REACT_APP_AGENT_HTTP_TOKEN || process.env.AGENT_HTTP_TOKEN || '',
);

const HTTP_AGENT_AUTH_HEADER = (() => {
  const candidate = toTrimmedString(
    process.env.REACT_APP_AGENT_HTTP_HEADER || process.env.AGENT_HTTP_HEADER || '',
  );
  return candidate || 'Authorization';
})();

export const isAgentHttpBridgeAvailable = () => Boolean(HTTP_AGENT_ENDPOINT);

const resolveHttpEndpointForChannel = (channel) => {
  if (!isAgentHttpBridgeAvailable() || typeof channel !== 'string') {
    return '';
  }

  const targetChannel = channel.trim();
  if (!targetChannel) {
    return '';
  }

  if (HTTP_AGENT_ENDPOINT.includes('{channel}')) {
    return HTTP_AGENT_ENDPOINT.replace('{channel}', targetChannel);
  }

  if (HTTP_AGENT_ENDPOINT.includes(':channel')) {
    return HTTP_AGENT_ENDPOINT.replace(':channel', targetChannel);
  }

  const normalizedEndpoint = HTTP_AGENT_ENDPOINT.replace(/\/+$/, '');
  return `${normalizedEndpoint}/${targetChannel}`;
};

const buildHttpBridgeHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (HTTP_AGENT_AUTH_TOKEN) {
    const headerName = HTTP_AGENT_AUTH_HEADER || 'Authorization';
    const tokenValue = HTTP_AGENT_AUTH_TOKEN.startsWith('Bearer ')
      ? HTTP_AGENT_AUTH_TOKEN
      : `Bearer ${HTTP_AGENT_AUTH_TOKEN}`;
    headers[headerName] = tokenValue;
  }
  return headers;
};

const callHttpAgentBridge = async (channel, payload = {}, options = {}) => {
  if (!isAgentHttpBridgeAvailable()) {
    return null;
  }

  const endpoint = resolveHttpEndpointForChannel(channel);
  if (!endpoint) {
    return null;
  }

  const { signal } = options || {};
  const { abortSignal, onStreamChunk, ...bridgePayload } = payload || {};

  const requestPayload = {
    channel,
    payload: bridgePayload,
    ...bridgePayload,
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHttpBridgeHeaders(),
      body: JSON.stringify(requestPayload),
      signal,
    });
  } catch (networkError) {
    throw buildRequestFailedError({
      error: {
        code: 'http_agent_network_error',
        message: networkError?.message || 'HTTP 에이전트 브리지 요청에 실패했습니다.',
      },
    });
  }

  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (_error) {
      throw buildRequestFailedError({
        error: {
          code: 'http_agent_invalid_json',
          message: 'HTTP 에이전트 브리지 응답을 해석할 수 없습니다.',
        },
      });
    }
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || response.statusText || 'HTTP 에이전트 브리지 요청에 실패했습니다.';
    const code = data?.error?.code || data?.code || `http_${response.status}`;
    throw buildRequestFailedError({ error: { code, message } });
  }

  if (!data || typeof data !== 'object') {
    throw buildRequestFailedError({
      error: {
        code: 'http_agent_empty_response',
        message: 'HTTP 에이전트 브리지 응답이 비어 있습니다.',
      },
    });
  }

  const normalized = { ...data };
  if (normalized.success === undefined) {
    normalized.success = true;
  }

  if (!normalized.success) {
    const errorPayload = {
      code: normalized?.error?.code || normalized.code || 'http_agent_failed',
      message: normalized?.error?.message || normalized.message || 'HTTP 에이전트 브리지 요청에 실패했습니다.',
    };
    throw buildRequestFailedError({ error: errorPayload });
  }

  return normalized;
};

const buildInvalidChannelError = (channel) => {
  const error = new Error(`알 수 없는 에이전트 채널: ${channel}`);
  error.code = 'AGENT_CHANNEL_INVALID';
  return error;
};

const buildMissingProviderConfigError = (provider) => {
  const normalized = normalizeProvider(provider);
  const providerConfig = getFallbackConfig(normalized);
  const label = PROVIDER_LABELS[normalized] || normalized;
  const envHints = Array.isArray(providerConfig?.apiKeyEnv)
    ? providerConfig.apiKeyEnv.join(' / ')
    : '환경 변수';

  const error = new Error(
    `${label} API 설정이 누락되어 요청을 실행할 수 없습니다.\n\n` +
    `다음 값을 확인해주세요:\n` +
    `- 데스크톱(Electron): ${envHints.replace(/REACT_APP_/g, '')}\n` +
    `- 브라우저 개발 서버: ${envHints}\n\n` +
    '.env 파일 또는 사용자 데이터 설정 파일에 올바른 값을 입력한 뒤 다시 시도하세요.',
  );
  error.code = 'AGENT_PROVIDER_MISSING_CONFIG';
  return error;
};

const buildMissingBridgeError = (provider) => {
  const label = PROVIDER_LABELS[normalizeProvider(provider)] || 'AI';
  const error = new Error(
    `${label} 요청을 처리할 수 있는 브리지를 찾을 수 없습니다.\n` +
    'Electron 앱으로 실행 중인지, 그리고 최신 버전의 위젯을 사용 중인지 확인해주세요.',
  );
  error.code = 'AGENT_BRIDGE_MISSING';
  return error;
};

export class AgentClient {
  static async request(channel, payload = {}, bridgeOverride) {
    const normalizedProvider = normalizeProvider(payload?.provider);
    const basePayload = { ...payload, provider: normalizedProvider };
    const {
      abortSignal,
      onStreamChunk,
      ...forwardPayload
    } = basePayload;

    const effectiveProvider = forwardPayload.provider;
    const startedAt = Date.now();

    const bridge = resolveAgentBridge(bridgeOverride);
    const bridgeMethod = bridge ? bridge[channel] : null;
    const hasBridge = typeof bridgeMethod === 'function';
    const bridgeAvailable = Boolean(bridge);

    const timeoutContext = { channel, provider: effectiveProvider };

    const tasks = [];

    const registerTask = (label, executor) => {
      tasks.push(async () => {
        const result = await executor();
        if (result === null || result === undefined) {
          throw buildRequestFailedError({
            error: {
              code: 'AGENT_BRIDGE_EMPTY',
              message: `${label} 응답이 비어 있습니다.`,
            },
          });
        }
        if (result?.success === false) {
          throw buildRequestFailedError(result);
        }
        return { label, result };
      });
    };

    if (hasBridge) {
      registerTask('rendererBridge', () =>
        executeWithTimeout(() => bridgeMethod(forwardPayload), timeoutContext),
      );
    }

    if (isAgentHttpBridgeAvailable()) {
      registerTask('httpBridge', () =>
        executeWithTimeout(() => callHttpAgentBridge(channel, forwardPayload, { signal: abortSignal }), timeoutContext),
      );
    }

    const canDirectAgentCall = (channel === 'askRoot' || channel === 'askChild') && canUseFallback(effectiveProvider);
    if (canDirectAgentCall) {
      registerTask('directProvider', () =>
        executeWithTimeout(
          () => callProvider({
            ...forwardPayload,
            signal: abortSignal,
            onStreamChunk,
          }),
          timeoutContext,
        ),
      );
    } else if (channel === 'extractKeyword' && canUseFallback(PROVIDERS.OPENAI)) {
      registerTask('directKeyword', () =>
        executeWithTimeout(
          () => extractKeywordWithProvider({
            ...forwardPayload,
            signal: abortSignal,
          }),
          { channel, provider: PROVIDERS.OPENAI },
        ),
      );
    }

    let response = null;

    if (tasks.length) {
      try {
        const { result } = await Promise.any(tasks.map((task) => task()));
        response = result;
      } catch (aggregateError) {
        if (aggregateError instanceof AggregateError && Array.isArray(aggregateError.errors) && aggregateError.errors.length) {
          throw aggregateError.errors[aggregateError.errors.length - 1];
        }
        throw aggregateError;
      }
    }

    if (!response) {
      if (!hasBridge) {
        if (bridgeAvailable) {
          throw buildInvalidChannelError(channel);
        }
        const missingProvider = channel === 'extractKeyword' ? PROVIDERS.OPENAI : effectiveProvider;
        throw buildMissingProviderConfigError(missingProvider);
      }
      throw buildMissingBridgeError(effectiveProvider);
    }

    if (!response.provider) {
      response.provider = effectiveProvider;
    }
    if (!response.model && forwardPayload.model) {
      response.model = forwardPayload.model;
    }
    if (response.latencyMs === undefined) {
      response.latencyMs = Date.now() - startedAt;
    }

    return response;
  }

  static async askRoot({ messages, model, temperature, maxTokens, provider, abortSignal, onStreamChunk } = {}) {
    return AgentClient.request('askRoot', { messages, model, temperature, maxTokens, provider, abortSignal, onStreamChunk });
  }

  static async askChild({ messages, model, temperature, maxTokens, provider, abortSignal, onStreamChunk } = {}) {
    return AgentClient.request('askChild', { messages, model, temperature, maxTokens, provider, abortSignal, onStreamChunk });
  }

  static isHttpBridgeAvailable() {
    return isAgentHttpBridgeAvailable();
  }
}

export default AgentClient;
