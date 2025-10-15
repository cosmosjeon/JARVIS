export const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

export const PROVIDERS = {
  AUTO: 'auto',
  OPENAI: 'openai',
  GEMINI: 'gemini',
  CLAUDE: 'claude',
};

export const PROVIDER_LABELS = {
  [PROVIDERS.AUTO]: 'Smart Auto',
  [PROVIDERS.OPENAI]: 'OpenAI',
  [PROVIDERS.GEMINI]: 'Google Gemini',
  [PROVIDERS.CLAUDE]: 'Anthropic Claude',
};

export const FALLBACK_CONFIG = {
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

export const normalizeProvider = (value) => {
  const provider = typeof value === 'string' ? value.toLowerCase() : '';
  if (provider === PROVIDERS.AUTO) {
    return PROVIDERS.AUTO;
  }
  if (provider && FALLBACK_CONFIG[provider]) {
    return provider;
  }
  return PROVIDERS.OPENAI;
};

export const getFallbackConfig = (provider) => FALLBACK_CONFIG[normalizeProvider(provider)];

export const getFallbackApiKey = (provider) => {
  const providerConfig = getFallbackConfig(provider);
  if (!providerConfig) {
    return '';
  }
  const key = providerConfig.apiKeyEnv
    .map((envKey) => (typeof process.env[envKey] === 'string' ? process.env[envKey].trim() : ''))
    .find((candidate) => candidate);
  return typeof key === 'string' ? key.trim() : '';
};

export const canUseFallback = (provider) => {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(getFallbackApiKey(provider));
};

const toLimitedNumber = (value, { min, max, fallback }) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const constrained = Math.round(value);
  if (typeof min === 'number' && constrained < min) {
    return min;
  }
  if (typeof max === 'number' && constrained > max) {
    return max;
  }
  return constrained;
};

const normalizeContentPart = (part) => {
  if (!part || typeof part !== 'object') {
    return null;
  }

  const type = part.type;
  if (type === 'input_text' || type === 'text') {
    const text = toTrimmedString(part.text);
    return text ? { type: 'text', text } : null;
  }

  if (type === 'input_image' || type === 'image_url' || type === 'image') {
    const urlCandidate = typeof part.image_url === 'string'
      ? part.image_url
      : typeof part.image_url?.url === 'string'
        ? part.image_url.url
        : typeof part.url === 'string'
          ? part.url
          : typeof part.dataUrl === 'string'
            ? part.dataUrl
            : '';
    const url = toTrimmedString(urlCandidate);
    return url ? { type: 'image_url', image_url: url } : null;
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

const mapEffortToGeminiBudget = (effort) => {
  switch (effort) {
    case 'high':
      return 2048;
    case 'low':
      return 256;
    case 'medium':
    default:
      return 1024;
  }
};

const mapEffortToClaudeBudget = (effort) => {
  switch (effort) {
    case 'high':
      return 10000;
    case 'low':
      return 2000;
    case 'medium':
    default:
      return 6000;
  }
};

const mapToOpenAIContentParts = (message) => {
  const role = message.role === 'assistant' ? 'assistant' : 'user';
  const textType = 'text';
  const imageType = 'image_url';

  const parts = [];

  const appendText = (value) => {
    const text = toTrimmedString(value);
    if (text) {
      parts.push({ type: textType, text });
    }
  };

  const appendImage = (value) => {
    const url = toTrimmedString(value);
    if (url) {
      parts.push({ type: imageType, image_url: url });
    }
  };

  if (Array.isArray(message.content)) {
    message.content.forEach((part) => {
      if (!part) {
        return;
      }
      if (typeof part === 'string') {
        appendText(part);
        return;
      }

      const type = part.type;
      if (type === 'text' || type === 'input_text' || type === 'output_text') {
        appendText(part.text || part.value || '');
        return;
      }
      if (type === 'image_url' || type === 'input_image' || type === 'image') {
        const imageValue = typeof part.image_url === 'string'
          ? part.image_url
          : typeof part.image_url?.url === 'string'
            ? part.image_url.url
            : part.url;
        appendImage(imageValue || part.dataUrl || '');
      }
    });
  } else {
    appendText(
      typeof message.content === 'string'
        ? message.content
        : message.text,
    );
  }

  const attachments = sanitizeAttachmentList(message.attachments);
  attachments.forEach((attachment) => appendImage(attachment.dataUrl));

  if (!parts.length) {
    parts.push({ type: textType, text: '' });
  }

  return parts;
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

  const combined = text ? [{ type: 'text', text }] : [];
  attachments.forEach((attachment) => {
    combined.push({ type: 'image_url', image_url: attachment.dataUrl });
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
  const claudeMessages = conversation
    .map((message) => {
      const text = extractTextFromMessage(message);
      if (!text) {
        return null;
      }
      return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: [{ type: 'text', text }],
      };
    })
    .filter(Boolean);

  return {
    systemInstruction,
    claudeMessages,
  };
};

const mapToOpenAIRequest = (messages = []) => {
  const normalizedMessages = normalizeMessages(messages);
  return normalizedMessages.map((message) => ({
    ...message,
    content: mapToOpenAIContentParts(message),
  }));
};

const buildInvalidProviderError = (provider) => {
  const error = new Error(`지원하지 않는 AI 제공자: ${provider || 'unknown'}`);
  error.code = 'AGENT_PROVIDER_INVALID';
  return error;
};

export const buildRequestFailedError = (result) => {
  const message = result?.error?.message || '에이전트 요청에 실패했습니다.';
  const error = new Error(message);
  error.code = result?.error?.code || 'AGENT_REQUEST_FAILED';
  return error;
};

const callOpenAIChat = async ({
  messages,
  model,
  temperature,
  maxTokens,
  reasoning,
  webSearchEnabled,
}) => {
  const config = getFallbackConfig(PROVIDERS.OPENAI);
  const apiKey = getFallbackApiKey(PROVIDERS.OPENAI);
  if (!apiKey) {
    throw buildRequestFailedError({
      error: {
        code: 'openai_missing_api_key',
        message: 'OpenAI API 키가 설정되지 않았습니다.',
      },
    });
  }

  const normalizedMessages = Array.isArray(messages) ? messages : [];
  if (!normalizedMessages.length) {
    throw buildRequestFailedError({ error: { message: '메시지가 비어 있습니다.' } });
  }

  const openaiMessages = mapToOpenAIRequest(normalizedMessages);
  const effectiveModel = model || config.defaultModel;

  const body = {
    model: effectiveModel,
    messages: openaiMessages,
    temperature,
  };

  if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
    body.max_tokens = maxTokens;
  }

  if (reasoning && typeof reasoning === 'object') {
    const effort = typeof reasoning.effort === 'string' ? reasoning.effort.toLowerCase() : 'medium';
    const budgetTokens = toLimitedNumber(reasoning.budgetTokens, { min: 1, max: 32000, fallback: null });
    const includeThoughts = Boolean(reasoning.includeThoughts);

    body.reasoning = {
      effort,
      ...(budgetTokens ? { budget_tokens: budgetTokens } : {}),
      ...(includeThoughts ? { include_thoughts: true } : {}),
    };
  }

  if (webSearchEnabled) {
    body.tools = [
      {
        type: 'web_search',
        web_search: { enable: true },
      },
    ];
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
  const answer = Array.isArray(data.choices)
    ? data.choices
        .map((choice) => {
          if (!choice || typeof choice !== 'object' || !choice.message) {
            return '';
          }
          const content = choice.message?.content;
          if (Array.isArray(content)) {
            return content
              .map((part) => (typeof part?.text === 'string' ? part.text : ''))
              .filter(Boolean)
              .join('\n')
              .trim();
          }
          if (typeof content === 'string') {
            return content.trim();
          }
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim()
    : '';

  if (!answer) {
    throw buildRequestFailedError({ error: { message: 'OpenAI 응답이 비어 있습니다.' } });
  }

  const reasoningPayload = (() => {
    const reasoningMetadata = data.choices?.[0]?.message?.reasoning;
    if (reasoningMetadata) {
      return {
        config: reasoning || null,
        thinking: typeof reasoningMetadata?.content === 'string' ? reasoningMetadata.content : null,
      };
    }
    if (reasoning) {
      return { config: reasoning };
    }
    return null;
  })();

  return {
    success: true,
    answer,
    usage: data.usage || null,
    finishReason: data.choices?.[0]?.finish_reason || null,
    provider: PROVIDERS.OPENAI,
    model: data.model || effectiveModel,
    reasoning: reasoningPayload,
  };
};

const callGeminiChat = async ({
  messages,
  model,
  temperature,
  maxTokens,
  reasoning,
  webSearchEnabled,
}) => {
  const config = getFallbackConfig(PROVIDERS.GEMINI);
  const apiKey = getFallbackApiKey(PROVIDERS.GEMINI);
  if (!apiKey) {
    throw buildRequestFailedError({
      error: {
        code: 'gemini_missing_api_key',
        message: 'Gemini API 키가 설정되지 않았습니다.',
      },
    });
  }

  const normalizedMessages = Array.isArray(messages) ? messages : [];
  if (!normalizedMessages.length) {
    throw buildRequestFailedError({ error: { message: '메시지가 비어 있습니다.' } });
  }

  const payload = mapToGeminiContents(normalizedMessages);
  const body = {
    contents: payload.contents,
  };

  if (payload.systemInstruction) {
    body.systemInstruction = payload.systemInstruction;
  }

  if (typeof temperature === 'number' && Number.isFinite(temperature)) {
    body.generationConfig = {
      ...body.generationConfig,
      temperature,
    };
  }

  if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
    body.generationConfig = {
      ...body.generationConfig,
      maxOutputTokens: maxTokens,
    };
  }

  if (reasoning && typeof reasoning === 'object') {
    const budgetTokens = toLimitedNumber(reasoning.budgetTokens, { min: 1, max: 32000, fallback: null });
    const effort = typeof reasoning.effort === 'string' ? reasoning.effort.toLowerCase() : 'medium';
    const includeThoughts = Boolean(reasoning.includeThoughts);

    body.generationConfig = {
      ...body.generationConfig,
      reasoningConfig: {
        effort,
        ...(budgetTokens ? { budgetTokens } : {}),
        ...(includeThoughts ? { outputThoughts: true } : {}),
      },
    };
  }

  if (webSearchEnabled) {
    body.tools = [
      {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: 'dynamic',
            dynamicThreshold: 0.3,
          },
        },
      },
    ];
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/models/${encodeURIComponent(model || config.defaultModel)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
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
  const answer = Array.isArray(data.candidates)
    ? data.candidates
        .map((candidate) => {
          const text = Array.isArray(candidate?.content?.parts)
            ? candidate.content.parts
                .map((part) => (typeof part?.text === 'string' ? part.text : ''))
                .filter(Boolean)
                .join('\n')
                .trim()
            : '';
          return text;
        })
        .filter(Boolean)
        .join('\n')
        .trim()
    : '';

  if (!answer) {
    throw buildRequestFailedError({ error: { message: 'Gemini 응답이 비어 있습니다.' } });
  }

  const reasoningPayload = (() => {
    const candidateReasoning = data.candidates?.[0]?.content?.parts?.find((part) => part && part.reasoning);
    if (candidateReasoning) {
      return {
        config: reasoning || null,
        thinking: candidateReasoning.reasoning,
      };
    }
    if (reasoning) {
      return { config: reasoning };
    }
    return null;
  })();

  return {
    success: true,
    answer,
    usage: data.usageMetadata || null,
    finishReason: data.candidates?.[0]?.finishReason || null,
    provider: PROVIDERS.GEMINI,
    model: data.modelVersion || body.model,
    reasoning: reasoningPayload,
  };
};

const callClaudeChat = async ({
  messages,
  model,
  temperature,
  maxTokens,
  reasoning,
  webSearchEnabled,
}) => {
  const config = getFallbackConfig(PROVIDERS.CLAUDE);
  const apiKey = getFallbackApiKey(PROVIDERS.CLAUDE);
  if (!apiKey) {
    throw buildRequestFailedError({
      error: {
        code: 'anthropic_missing_api_key',
        message: 'Anthropic API 키가 설정되지 않았습니다.',
      },
    });
  }

  const normalizedMessages = Array.isArray(messages) ? messages : [];
  if (!normalizedMessages.length) {
    throw buildRequestFailedError({ error: { message: '메시지가 비어 있습니다.' } });
  }

  const normalized = mapToClaudeMessages(normalizedMessages);
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

  if (webSearchEnabled) {
    body.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
      },
    ];
  }

  if (reasoning && typeof reasoning === 'object') {
    const budget = Number.isFinite(reasoning.budgetTokens)
      ? Math.round(reasoning.budgetTokens)
      : mapEffortToClaudeBudget(
        typeof reasoning.effort === 'string' ? reasoning.effort.toLowerCase() : 'medium',
      );
    if (Number.isFinite(budget) && budget > 0) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: Math.max(1000, Math.min(12000, budget)),
      };
      if (typeof reasoning.includeThoughts === 'boolean') {
        body.thinking.include_thoughts = reasoning.includeThoughts;
      }
    }
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

  const thinkingBlocks = Array.isArray(data.content)
    ? data.content.filter((block) => block && block.type === 'thinking')
    : [];
  const combinedThinking = thinkingBlocks
    .map((block) => (typeof block.thinking === 'string' ? block.thinking.trim() : ''))
    .filter(Boolean)
    .join('\n')
    .trim();

  const reasoningPayload = (() => {
    if (combinedThinking) {
      return {
        config: reasoning || null,
        thinking: combinedThinking,
      };
    }
    if (reasoning) {
      return { config: reasoning };
    }
    return null;
  })();

  return {
    success: true,
    answer,
    usage: data.usage || null,
    finishReason: data.stop_reason || null,
    model: data.model || body.model,
    provider: PROVIDERS.CLAUDE,
    reasoning: reasoningPayload,
  };
};

export const callProvider = async ({ provider, ...payload }) => {
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

export const extractKeywordWithProvider = async (payload = {}) => {
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
    model: payload.model || FALLBACK_CONFIG[PROVIDERS.OPENAI].defaultModel,
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0,
    maxTokens: payload.maxTokens ?? 8,
    webSearchEnabled: false,
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

export default {
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
};
