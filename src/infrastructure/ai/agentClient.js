import { createAgentBridge } from '../electron/bridges';

const resolveAgentBridge = (bridgeOverride) => createAgentBridge(bridgeOverride);

export const PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  CLAUDE: 'claude',
};

const PROVIDER_LABELS = {
  [PROVIDERS.OPENAI]: 'OpenAI',
  [PROVIDERS.GEMINI]: 'Google Gemini',
  [PROVIDERS.CLAUDE]: 'Anthropic Claude',
};

const FALLBACK_CONFIG = {
  [PROVIDERS.OPENAI]: {
    baseUrl: process.env.REACT_APP_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
    defaultModel: process.env.REACT_APP_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5',
    apiKeyEnv: ['REACT_APP_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  },
  [PROVIDERS.GEMINI]: {
    baseUrl: process.env.REACT_APP_GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: process.env.REACT_APP_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    apiKeyEnv: ['REACT_APP_GEMINI_API_KEY', 'GEMINI_API_KEY'],
  },
  [PROVIDERS.CLAUDE]: {
    baseUrl: process.env.REACT_APP_ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages',
    defaultModel: process.env.REACT_APP_ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    apiKeyEnv: ['REACT_APP_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY'],
  },
};

const normalizeProvider = (value) => {
  const provider = typeof value === 'string' ? value.toLowerCase() : '';
  if (provider && FALLBACK_CONFIG[provider]) {
    return provider;
  }
  return PROVIDERS.OPENAI;
};

const getFallbackConfig = (provider) => FALLBACK_CONFIG[normalizeProvider(provider)];

const getFallbackApiKey = (provider) => {
  const providerConfig = getFallbackConfig(provider);
  if (!providerConfig) {
    return '';
  }
  const key = providerConfig.apiKeyEnv
    .map((envKey) => (typeof process.env[envKey] === 'string' ? process.env[envKey].trim() : ''))
    .find((candidate) => candidate);
  return typeof key === 'string' ? key.trim() : '';
};

const canUseFallback = (provider) => {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(getFallbackApiKey(provider));
};

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeContentPart = (part) => {
  if (!part || typeof part !== 'object') {
    return null;
  }

  const type = part.type;
  if (type === 'input_text' || type === 'text') {
    const text = toTrimmedString(part.text);
    return text ? { type: 'input_text', text } : null;
  }

  if (type === 'input_image' || type === 'image_url' || type === 'image') {
    const urlCandidate = typeof part.image_url?.url === 'string'
      ? part.image_url.url
      : typeof part.url === 'string'
        ? part.url
        : typeof part.dataUrl === 'string'
          ? part.dataUrl
          : '';
    const url = toTrimmedString(urlCandidate);
    return url ? { type: 'input_image', image_url: { url } } : null;
  }

  return null;
};

const extractTextFromMessage = (message) => {
  const candidate = typeof message.content === 'string'
    ? message.content
    : typeof message.text === 'string'
      ? message.text
      : '';
  return toTrimmedString(candidate);
};

const sanitizeAttachmentList = (attachments) => {
  if (!Array.isArray(attachments)) {
    return [];
  }
  return attachments
    .filter((item) => item && typeof item === 'object' && typeof item.dataUrl === 'string')
    .map((item) => {
      const dataUrl = toTrimmedString(item.dataUrl);
      return dataUrl ? { dataUrl } : null;
    })
    .filter(Boolean);
};

const splitSystemAndConversation = (messages = []) => {
  const systemParts = [];
  const conversation = [];

  messages.forEach((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }
    const role = message.role || message.author;
    if (role === 'system') {
      const text = extractTextFromMessage(message);
      if (text) {
        systemParts.push(text);
      }
      return;
    }
    conversation.push(message);
  });

  return {
    systemInstruction: systemParts.join('\n\n').trim(),
    conversation,
  };
};

const normalizeMessage = (message) => {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const role = message.role === 'assistant' ? 'assistant' : 'user';

  if (Array.isArray(message.content)) {
    const content = message.content.map(normalizeContentPart).filter(Boolean);
    if (content.length) {
      return { role, content };
    }
  }

  const text = extractTextFromMessage(message);
  const attachments = sanitizeAttachmentList(message.attachments);

  if (!text && attachments.length === 0) {
    return null;
  }

  if (attachments.length === 0) {
    return { role, content: text };
  }

  const combined = text ? [{ type: 'input_text', text }] : [];
  attachments.forEach((attachment) => {
    combined.push({ type: 'input_image', image_url: { url: attachment.dataUrl } });
  });

  return { role, content: combined };
};

const normalizeMessages = (messages) => (
  Array.isArray(messages)
    ? messages.map(normalizeMessage).filter(Boolean)
    : []
);

const mapToGeminiContents = (messages = []) => {
  const { systemInstruction, conversation } = splitSystemAndConversation(messages);
  const contents = conversation.map((message) => {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const text = extractTextFromMessage(message);
    if (!text) {
      return null;
    }
    return {
      role,
      parts: [{ text }],
    };
  }).filter(Boolean);

  return {
    contents,
    systemInstruction: systemInstruction
      ? { role: 'user', parts: [{ text: systemInstruction }] }
      : null,
  };
};

const mapToClaudeMessages = (messages = []) => {
  const { systemInstruction, conversation } = splitSystemAndConversation(messages);
  const claudeMessages = conversation.map((message) => {
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const text = extractTextFromMessage(message);
    if (!text) {
      return null;
    }
    return {
      role,
      content: [{ type: 'text', text }],
    };
  }).filter(Boolean);

  return {
    systemInstruction,
    claudeMessages,
  };
};

const callOpenAIChat = async ({ messages, model, temperature, maxTokens }) => {
  const config = getFallbackConfig(PROVIDERS.OPENAI);
  const apiKey = getFallbackApiKey(PROVIDERS.OPENAI);
  if (!apiKey) {
    throw buildMissingProviderConfigError(PROVIDERS.OPENAI);
  }

  const normalizedMessages = normalizeMessages(messages);
  if (!normalizedMessages.length) {
    throw buildRequestFailedError({ error: { message: '메시지가 비어 있습니다.' } });
  }

  const body = {
    model: model || config.defaultModel,
    messages: normalizedMessages,
  };

  if (typeof temperature === 'number' && Number.isFinite(temperature)) {
    body.temperature = temperature;
  }

  if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
    body.max_tokens = maxTokens;
  }

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw buildRequestFailedError({
      error: {
        message: errorPayload?.error?.message || response.statusText || 'OpenAI 요청에 실패했습니다.',
        code: errorPayload?.error?.type || `http_${response.status}`,
      },
    });
  }

  const data = await response.json();
  const choice = data.choices?.[0] || {};
  const rawContent = choice.message?.content;
  let extracted = '';
  if (typeof rawContent === 'string') {
    extracted = rawContent.trim();
  } else if (Array.isArray(rawContent)) {
    extracted = rawContent
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return '';
        }
        if (typeof item.text === 'string') {
          return item.text;
        }
        if (typeof item.value === 'string') {
          return item.value;
        }
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (!extracted) {
    throw buildRequestFailedError({ error: { message: 'OpenAI 응답이 비어 있습니다.' } });
  }

  return {
    success: true,
    answer: extracted,
    usage: data.usage || null,
    finishReason: choice.finish_reason || null,
    model: data.model || body.model,
  };
};

const callGeminiChat = async ({ messages, model, temperature, maxTokens }) => {
  const config = getFallbackConfig(PROVIDERS.GEMINI);
  const apiKey = getFallbackApiKey(PROVIDERS.GEMINI);
  if (!apiKey) {
    throw buildMissingProviderConfigError(PROVIDERS.GEMINI);
  }

  const normalized = mapToGeminiContents(messages);
  if (!normalized.contents.length) {
    throw buildRequestFailedError({ error: { message: '메시지가 비어 있습니다.' } });
  }

  const body = {
    contents: normalized.contents,
  };

  if (normalized.systemInstruction) {
    body.systemInstruction = normalized.systemInstruction;
  }

  const generationConfig = {};
  if (typeof temperature === 'number' && Number.isFinite(temperature)) {
    generationConfig.temperature = temperature;
  }
  if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
    generationConfig.maxOutputTokens = maxTokens;
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  const endpoint = `${config.baseUrl}/models/${encodeURIComponent(model || config.defaultModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw buildRequestFailedError({
      error: {
        message: errorPayload?.error?.message || response.statusText || 'Gemini 요청에 실패했습니다.',
        code: errorPayload?.error?.status || `http_${response.status}`,
      },
    });
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const answer = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!answer) {
    throw buildRequestFailedError({ error: { message: 'Gemini 응답이 비어 있습니다.' } });
  }

  return {
    success: true,
    answer,
    usage: data.usageMetadata || null,
    finishReason: candidate?.finishReason || null,
    model: data.model || candidate?.model || model || config.defaultModel,
  };
};

const callClaudeChat = async ({ messages, model, temperature, maxTokens }) => {
  const config = getFallbackConfig(PROVIDERS.CLAUDE);
  const apiKey = getFallbackApiKey(PROVIDERS.CLAUDE);
  if (!apiKey) {
    throw buildMissingProviderConfigError(PROVIDERS.CLAUDE);
  }

  const normalized = mapToClaudeMessages(messages);
  if (!normalized.claudeMessages.length) {
    throw buildRequestFailedError({ error: { message: '메시지가 비어 있습니다.' } });
  }

  const body = {
    model: model || config.defaultModel,
    max_tokens: typeof maxTokens === 'number' && Number.isFinite(maxTokens) ? maxTokens : 1024,
    messages: normalized.claudeMessages,
  };

  if (normalized.systemInstruction) {
    body.system = normalized.systemInstruction;
  }

  if (typeof temperature === 'number' && Number.isFinite(temperature)) {
    body.temperature = temperature;
  }

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw buildRequestFailedError({
      error: {
        message: errorPayload?.error?.message || response.statusText || 'Claude 요청에 실패했습니다.',
        code: errorPayload?.error?.type || `http_${response.status}`,
      },
    });
  }

  const data = await response.json();
  const answer = (data.content || [])
    .map((block) => (typeof block?.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!answer) {
    throw buildRequestFailedError({ error: { message: 'Claude 응답이 비어 있습니다.' } });
  }

  return {
    success: true,
    answer,
    usage: data.usage || null,
    finishReason: data.stop_reason || null,
    model: data.model || body.model,
  };
};

const callProvider = async ({ provider, ...payload }) => {
  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider === PROVIDERS.OPENAI) {
    return callOpenAIChat(payload);
  }
  if (normalizedProvider === PROVIDERS.GEMINI) {
    return callGeminiChat(payload);
  }
  if (normalizedProvider === PROVIDERS.CLAUDE) {
    return callClaudeChat(payload);
  }

  throw buildInvalidProviderError(provider);
};

const fallbackAsk = (payload = {}) => callProvider(payload);

const fallbackExtractKeyword = async (payload = {}) => {
  const question = typeof payload?.question === 'string' ? payload.question.trim() : '';
  if (!question) {
    return {
      success: false,
      error: {
        code: 'invalid_question',
        message: '질문이 비어 있습니다.',
      },
    };
  }

  const promptMessages = [
    {
      role: 'system',
      content: 'Extract the single most important keyword from the user question. Respond with exactly one word, without any additional text.',
    },
    {
      role: 'user',
      content: question,
    },
  ];

  const response = await callOpenAIChat({
    messages: promptMessages,
    model: payload.model || FALLBACK_OPENAI_MODEL,
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0,
    maxTokens: payload.maxTokens ?? 8,
  });

  const keyword = response.answer.split(/\s+/).find(Boolean) || '';
  if (!keyword) {
    return {
      success: false,
      error: {
        code: 'empty_keyword',
        message: '키워드를 추출하지 못했습니다.',
      },
    };
  }

  return {
    success: true,
    keyword,
    usage: response.usage || null,
  };
};

const buildInvalidChannelError = (channel) => {
  const error = new Error(`알 수 없는 에이전트 채널: ${channel}`);
  error.code = 'AGENT_CHANNEL_INVALID';
  return error;
};

const buildInvalidProviderError = (provider) => {
  const error = new Error(`지원하지 않는 AI 제공자: ${provider || 'unknown'}`);
  error.code = 'AGENT_PROVIDER_INVALID';
  return error;
};

const buildMissingProviderConfigError = (provider) => {
  const normalizedProvider = normalizeProvider(provider);
  const providerConfig = getFallbackConfig(normalizedProvider);
  const label = PROVIDER_LABELS[normalizedProvider] || normalizedProvider;
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

const buildRequestFailedError = (result) => {
  const message = result?.error?.message || '에이전트 요청에 실패했습니다.';
  const error = new Error(message);
  error.code = result?.error?.code || 'AGENT_REQUEST_FAILED';
  return error;
};

export class AgentClient {
  static async request(channel, payload = {}, bridgeOverride) {
    const provider = normalizeProvider(payload?.provider);
    const requestPayload = { ...payload, provider };

    const bridge = resolveAgentBridge(bridgeOverride);
    const bridgeMethod = bridge ? bridge[channel] : null;
    const hasBridge = typeof bridgeMethod === 'function';
    const bridgeAvailable = Boolean(bridge);

    if (hasBridge) {
      const result = await bridgeMethod(requestPayload);
      if (result !== null && result !== undefined) {
        if (!result?.success) {
          throw buildRequestFailedError(result);
        }
        return result;
      }
    }

    if (channel === 'askRoot' || channel === 'askChild') {
      if (canUseFallback(provider)) {
        return fallbackAsk(requestPayload);
      }
    } else if (channel === 'extractKeyword' && canUseFallback(PROVIDERS.OPENAI)) {
      return fallbackExtractKeyword(requestPayload);
    }

    if (!hasBridge) {
      if (bridgeAvailable) {
        throw buildInvalidChannelError(channel);
      }
      const missingProvider = channel === 'extractKeyword' ? PROVIDERS.OPENAI : provider;
      throw buildMissingProviderConfigError(missingProvider);
    }

    throw buildMissingBridgeError(provider);
  }

  static async askRoot({ messages, model, temperature, maxTokens, provider } = {}) {
    return AgentClient.request('askRoot', { messages, model, temperature, maxTokens, provider });
  }

  static async askChild({ messages, model, temperature, maxTokens, provider } = {}) {
    return AgentClient.request('askChild', { messages, model, temperature, maxTokens, provider });
  }
}

export default AgentClient;
