export const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseBase64FromDataUrl = (dataUrl, fallbackMime = '') => {
  const trimmed = toTrimmedString(dataUrl);
  const matches = trimmed.match(/^data:(.*?);base64,(.*)$/);
  if (!matches || matches.length < 3) {
    return {
      mimeType: fallbackMime,
      base64: '',
    };
  }
  return {
    mimeType: matches[1] || fallbackMime,
    base64: matches[2],
  };
};

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
    baseUrl: process.env.REACT_APP_OPENAI_API_URL || 'https://api.openai.com/v1/responses',
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const type = (item.type || 'image').toLowerCase();
      const mimeType = toTrimmedString(item.mimeType) || undefined;
      const label = toTrimmedString(item.label) || undefined;
      const base64 = toTrimmedString(item.base64);
      const dataUrl = toTrimmedString(item.dataUrl);
      const textContent = toTrimmedString(item.textContent);
      const pageCount = Number.isFinite(item.pageCount) ? item.pageCount : undefined;

      if (type === 'pdf') {
        if (!textContent && !base64 && !dataUrl) {
          return null;
        }
        const parsed = base64 || dataUrl
          ? parseBase64FromDataUrl(dataUrl, mimeType || 'application/pdf')
          : { mimeType, base64: '' };
        return {
          type: 'pdf',
          mimeType: parsed.mimeType || 'application/pdf',
          base64: base64 || parsed.base64,
          dataUrl: dataUrl || '',
          textContent,
          label,
          pageCount,
        };
      }

      if (type === 'image') {
        if (!dataUrl && !base64) {
          return null;
        }
        const parsed = base64 || dataUrl
          ? parseBase64FromDataUrl(dataUrl, mimeType)
          : { mimeType, base64: '' };
        return {
          type: 'image',
          mimeType: parsed.mimeType || mimeType || undefined,
          base64: base64 || parsed.base64,
          dataUrl,
          label,
        };
      }

      return null;
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

  const appendImage = (attachment) => {
    if (!attachment) {
      return;
    }
    const candidateUrl = toTrimmedString(attachment.dataUrl)
      || (attachment.base64 && attachment.mimeType
        ? `data:${attachment.mimeType};base64,${attachment.base64}`
        : '');
    if (candidateUrl) {
      parts.push({ type: imageType, image_url: candidateUrl });
    }
  };

  const appendPdf = (attachment) => {
    if (!attachment) {
      return;
    }
    const heading = [
      'PDF 첨부',
      attachment.label ? `(${attachment.label})` : '',
      attachment.pageCount ? `· ${attachment.pageCount}쪽` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const pdfText = toTrimmedString(attachment.textContent);
    appendText([heading || 'PDF 첨부', pdfText].filter(Boolean).join('\n\n'));
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
        appendImage({ dataUrl: imageValue || part.dataUrl || '', mimeType: part.mimeType });
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
  attachments.forEach((attachment) => {
    if (attachment.type === 'pdf') {
      appendPdf(attachment);
    } else {
      appendImage(attachment);
    }
  });

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
    if (attachment.type === 'pdf') {
      if (attachment.textContent) {
        const heading = [
          'PDF 첨부',
          attachment.label ? `(${attachment.label})` : '',
          attachment.pageCount ? `· ${attachment.pageCount}쪽` : '',
        ]
          .filter(Boolean)
          .join(' ');
        combined.push({
          type: 'text',
          text: [heading || 'PDF 첨부', attachment.textContent].filter(Boolean).join('\n\n'),
        });
      }
    } else {
      const imageUrl = toTrimmedString(attachment.dataUrl)
        || (attachment.base64 && attachment.mimeType
          ? `data:${attachment.mimeType};base64,${attachment.base64}`
          : '');
      if (imageUrl) {
        combined.push({ type: 'image_url', image_url: imageUrl });
      }
    }
  });

  return { role, content: combined };
};

const normalizeMessages = (messages) => (
  Array.isArray(messages)
    ? messages.map(normalizeMessage).filter(Boolean)
    : []
);

const mapToGeminiContents = (messages = []) => {
  console.log('[mapToGeminiContents] 입력 메시지:', {
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages
  });

  const { systemInstruction, conversation } = splitSystemAndConversation(messages);
  console.log('[mapToGeminiContents] 시스템/대화 분리 결과:', {
    hasSystemInstruction: !!systemInstruction,
    conversationCount: conversation.length
  });

  const contents = conversation.map((message, index) => {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts = [];

    const appendText = (value) => {
      const text = toTrimmedString(value);
      if (text) {
        parts.push({ text });
      }
    };

    const appendImage = (attachment) => {
      if (!attachment) {
        return;
      }
      const dataUrl = toTrimmedString(attachment.dataUrl)
        || (attachment.base64 && attachment.mimeType
          ? `data:${attachment.mimeType};base64,${attachment.base64}`
          : '');
      if (!dataUrl) {
        return;
      }
      const parsed = parseBase64FromDataUrl(dataUrl, attachment.mimeType || 'image/png');
      if (!parsed.base64) {
        return;
      }
      parts.push({
        inline_data: {
          mime_type: parsed.mimeType || 'image/png',
          data: parsed.base64,
        },
      });
    };

    const baseText = extractTextFromMessage(message);
    appendText(baseText);

    const attachments = sanitizeAttachmentList(message.attachments);
    attachments.forEach((attachment) => {
      if (attachment.type === 'pdf') {
        const heading = [
          'PDF 첨부',
          attachment.label ? `(${attachment.label})` : '',
          attachment.pageCount ? `· ${attachment.pageCount}쪽` : '',
        ]
          .filter(Boolean)
          .join(' ');
        appendText([heading || 'PDF 첨부', attachment.textContent].filter(Boolean).join('\n\n'));
      } else {
        appendImage(attachment);
      }
    });

    console.log(`[mapToGeminiContents] 메시지 ${index} 변환:`, {
      originalMessage: message,
      hasParts: parts.length > 0,
    });

    if (!parts.length) {
      return null;
    }

    return {
      role,
      parts,
    };
  }).filter(Boolean);

  console.log('[mapToGeminiContents] 최종 변환 결과:', {
    contentsCount: contents.length,
    contents
  });

  return {
    contents,
    systemInstruction: systemInstruction
      ? { role: 'user', parts: [{ text: systemInstruction }] }
      : null,
  };
};

const mapToClaudeMessages = (messages = []) => {
  console.log('[mapToClaudeMessages] 입력 메시지:', {
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages
  });

  const { systemInstruction, conversation } = splitSystemAndConversation(messages);
  console.log('[mapToClaudeMessages] 시스템/대화 분리 결과:', {
    hasSystemInstruction: !!systemInstruction,
    conversationCount: conversation.length
  });

  const claudeMessages = conversation
    .map((message, index) => {
      const content = [];

      const appendText = (value) => {
        const text = toTrimmedString(value);
        if (text) {
          content.push({ type: 'text', text });
        }
      };

      const appendImage = (attachment) => {
        if (!attachment) {
          return;
        }
        const dataUrl = toTrimmedString(attachment.dataUrl)
          || (attachment.base64 && attachment.mimeType
            ? `data:${attachment.mimeType};base64,${attachment.base64}`
            : '');
        if (!dataUrl) {
          return;
        }
        const parsed = parseBase64FromDataUrl(dataUrl, attachment.mimeType || 'image/png');
        if (!parsed.base64) {
          return;
        }
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: parsed.mimeType || 'image/png',
            data: parsed.base64,
          },
        });
      };

      const appendPdf = (attachment) => {
        if (!attachment) {
          return;
        }
        const heading = [
          'PDF 첨부',
          attachment.label ? `(${attachment.label})` : '',
          attachment.pageCount ? `· ${attachment.pageCount}쪽` : '',
        ]
          .filter(Boolean)
          .join(' ');

        appendText([heading || 'PDF 첨부', attachment.textContent].filter(Boolean).join('\n\n'));

        const dataUrl = toTrimmedString(attachment.dataUrl)
          || (attachment.base64 && attachment.mimeType
            ? `data:${attachment.mimeType};base64,${attachment.base64}`
            : '');
        if (!dataUrl) {
          return;
        }
        const parsed = parseBase64FromDataUrl(dataUrl, attachment.mimeType || 'application/pdf');
        if (!parsed.base64) {
          return;
        }
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: parsed.mimeType || 'application/pdf',
            data: parsed.base64,
          },
        });
      };

      appendText(extractTextFromMessage(message));

      const attachments = sanitizeAttachmentList(message.attachments);
      attachments.forEach((attachment) => {
        if (attachment.type === 'pdf') {
          appendPdf(attachment);
        } else {
          appendImage(attachment);
        }
      });

      console.log(`[mapToClaudeMessages] 메시지 ${index} 변환:`, {
        originalMessage: message,
        contentLength: content.length,
      });

      if (!content.length) {
        return null;
      }
      return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content,
      };
    })
    .filter(Boolean);

  console.log('[mapToClaudeMessages] 최종 변환 결과:', {
    claudeMessagesCount: claudeMessages.length,
    claudeMessages
  });

  return {
    systemInstruction,
    claudeMessages,
  };
};

const mapToOpenAIRequest = (messages = []) => {
  console.log('[mapToOpenAIRequest] 입력 메시지:', {
    messageCount: Array.isArray(messages) ? messages.length : 0,
    messages
  });

  const normalizedMessages = normalizeMessages(messages);
  console.log('[mapToOpenAIRequest] 정규화된 메시지:', {
    normalizedCount: normalizedMessages.length,
    normalizedMessages
  });

  const result = normalizedMessages.map((message) => ({
    ...message,
    content: mapToOpenAIContentParts(message),
  }));

  console.log('[mapToOpenAIRequest] 최종 변환 결과:', {
    resultCount: result.length,
    result
  });

  return result;
};

const buildOpenAIResponseParts = (message) => {
  const isAssistant = message.role === 'assistant';
  const textType = isAssistant ? 'output_text' : 'input_text';
  const imageType = isAssistant ? 'output_image' : 'input_image';

  const parts = [];

  const appendText = (value) => {
    if (!value) {
      return;
    }
    const text = typeof value === 'string' ? value.trim() : String(value || '').trim();
    if (text) {
      parts.push({ type: textType, text });
    }
  };

  const appendImage = (attachment) => {
    if (!attachment) {
      return;
    }
    const candidateUrl = toTrimmedString(attachment?.dataUrl)
      || (attachment?.base64 && attachment?.mimeType
        ? `data:${attachment.mimeType};base64,${attachment.base64}`
        : '');
    if (candidateUrl) {
      parts.push({ type: imageType, image_url: candidateUrl });
    }
  };

  const appendPdf = (attachment) => {
    if (!attachment) {
      return;
    }
    const pdfLabel = [
      'PDF 첨부',
      attachment.label ? `(${attachment.label})` : '',
      attachment.pageCount ? `· ${attachment.pageCount}쪽` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const pdfText = toTrimmedString(attachment.textContent);
    const combined = [pdfLabel || 'PDF 첨부', pdfText].filter(Boolean).join('\n\n');
    appendText(combined);
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
        appendImage({ dataUrl: imageValue || part.dataUrl || '', mimeType: part.mimeType });
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
  attachments.forEach((attachment) => {
    if (attachment.type === 'pdf') {
      appendPdf(attachment);
    } else {
      appendImage(attachment);
    }
  });

  if (!parts.length) {
    parts.push({ type: textType, text: '' });
  }

  return parts;
};

const mapToOpenAIResponseInput = (messages = []) => (
  Array.isArray(messages)
    ? messages
        .map((message) => ({
          role: message.role || 'user',
          content: buildOpenAIResponseParts(message),
        }))
        .filter((entry) => Array.isArray(entry.content) && entry.content.length > 0)
    : []
);

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
  signal,
  onStreamChunk,
}) => {
  const invocationStartedAt = Date.now();
  console.log('[callOpenAIChat] 함수 시작:', {
    messagesCount: messages?.length,
    model,
  });

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

  const effectiveModel = model || config.defaultModel;
  const rawBaseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '';
  const normalizedBaseUrl = rawBaseUrl || 'https://api.openai.com/v1';
  let trimmedBaseUrl = normalizedBaseUrl.replace(/\/+$/, '');
  const isChatCompletionsUrl = /\/chat\/completions$/i.test(trimmedBaseUrl);
  const isResponsesUrl = /\/responses$/i.test(trimmedBaseUrl);
  const preferResponsesApi = isResponsesUrl || !isChatCompletionsUrl;

  if (preferResponsesApi) {
    if (isResponsesUrl) {
      // keep as-is
    } else if (isChatCompletionsUrl) {
      trimmedBaseUrl = trimmedBaseUrl.replace(/\/chat\/completions$/i, '/responses');
    } else {
      trimmedBaseUrl = `${trimmedBaseUrl}/responses`;
    }
  } else if (!isChatCompletionsUrl) {
    trimmedBaseUrl = `${trimmedBaseUrl}/chat/completions`;
  }

  let baseUrl;
  try {
    baseUrl = new URL(trimmedBaseUrl).toString().replace(/\/+$/, '');
  } catch (error) {
    baseUrl = preferResponsesApi
      ? 'https://api.openai.com/v1/responses'
      : 'https://api.openai.com/v1/chat/completions';
  }

  const useResponsesApi = /\/responses$/i.test(baseUrl);
  const includeTemperature = typeof temperature === 'number' && Number.isFinite(temperature);

  let body;
  if (useResponsesApi) {
    const openaiInput = mapToOpenAIResponseInput(normalizedMessages);
    if (!openaiInput.length) {
      throw buildRequestFailedError({ error: { message: '전송할 메시지가 없습니다.' } });
    }
    body = {
      model: effectiveModel,
      input: openaiInput,
    };

    if (includeTemperature) {
      body.temperature = temperature;
    }

    if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
      body.max_output_tokens = maxTokens;
    }

    if (typeof onStreamChunk === 'function') {
      body.stream = true;
    }
  } else {
    const openaiMessages = mapToOpenAIRequest(normalizedMessages);
    body = {
      model: effectiveModel,
      messages: openaiMessages,
    };

    if (includeTemperature) {
      body.temperature = temperature;
    }

    if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
      body.max_tokens = maxTokens;
    }

    if (typeof onStreamChunk === 'function') {
      body.stream = true;
    }
  }

  const performRequest = async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    const errorPayload = response.ok ? null : await response.json().catch(() => ({}));
    return { response, errorPayload };
  };

  const emitStreamUpdate = (update) => {
    if (typeof onStreamChunk !== 'function' || !update) {
      return;
    }
    try {
      onStreamChunk(update);
    } catch (streamError) {
      console.warn('[callOpenAIChat] 스트리밍 업데이트 알림 실패', streamError);
    }
  };

  const extractCitations = (output = []) => {
    if (!Array.isArray(output)) {
      return [];
    }
    return output.flatMap((item) => {
      if (!item || typeof item !== 'object' || !Array.isArray(item.content)) {
        return [];
      }
      return item.content.filter((part) => part?.type === 'citation');
    }).filter(Boolean);
  };

  const processStreamingResponse = async (streamingResponse) => {
    if (!streamingResponse.body || typeof streamingResponse.body.getReader !== 'function') {
      const fallbackJson = await streamingResponse.json().catch(() => null);
      const fallbackAnswer = fallbackJson?.output_text ?? '';
      if (typeof fallbackAnswer === 'string' && fallbackAnswer.trim()) {
        const trimmed = fallbackAnswer.trim();
        emitStreamUpdate({
          text: trimmed,
          delta: trimmed,
          isFinal: true,
          provider: PROVIDERS.OPENAI,
          model: fallbackJson?.model || effectiveModel,
          usage: fallbackJson?.usage || null,
          latencyMs: Date.now() - invocationStartedAt,
        });
        return {
          success: true,
          answer: trimmed,
          usage: fallbackJson?.usage || null,
          finishReason: fallbackJson?.output?.[0]?.stop_reason || null,
          provider: PROVIDERS.OPENAI,
          model: fallbackJson?.model || effectiveModel,
        };
      }
      throw buildRequestFailedError({ error: { message: 'OpenAI 스트리밍 응답을 처리할 수 없습니다.' } });
    }

    const decoder = new TextDecoder('utf-8');
    const reader = streamingResponse.body.getReader();
    let buffer = '';
    let aggregatedText = '';
    let finalResponse = null;
    let reasoningText = '';

    const appendDelta = (deltaText) => {
      if (!deltaText) {
        return;
      }
      aggregatedText += deltaText;
      emitStreamUpdate({
        text: aggregatedText,
        delta: deltaText,
        isFinal: false,
        provider: PROVIDERS.OPENAI,
        model: effectiveModel,
      });
    };

    const handleParsedChunk = (payload) => {
      if (!payload || typeof payload !== 'object') {
        return;
      }
      switch (payload.type) {
        case 'response.delta':
          if (Array.isArray(payload.delta?.output)) {
            payload.delta.output.forEach((output) => {
              if (!Array.isArray(output?.content)) {
                return;
              }
              output.content.forEach((part) => {
                if (part?.type === 'output_text.delta' && typeof part.text === 'string') {
                  appendDelta(part.text);
                } else if (part?.type === 'reasoning_delta' && typeof part.text === 'string') {
                  reasoningText += part.text;
                }
              });
            });
          }
          if (payload.response) {
            finalResponse = payload.response;
          }
          break;
        case 'response.output_text.delta':
          if (typeof payload.delta?.text === 'string') {
            appendDelta(payload.delta.text);
          }
          break;
        case 'response.completed':
          if (payload.response) {
            finalResponse = payload.response;
          }
          break;
        case 'response.error':
          throw buildRequestFailedError({
            error: {
              message: payload.error?.message || 'OpenAI 스트리밍 중 오류가 발생했습니다.',
              code: payload.error?.code || 'openai_stream_error',
            },
          });
        default:
          break;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) {
          return;
        }
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          handleParsedChunk(parsed);
        } catch (parseError) {
          console.warn('[callOpenAIChat] 스트리밍 청크 파싱 실패', { payload: payload.slice(0, 120), parseError });
        }
      });
    }

    const finalAnswer = aggregatedText.trim();
    if (!finalAnswer) {
      throw buildRequestFailedError({ error: { message: 'OpenAI 응답이 비어 있습니다.' } });
    }

    const finalModel = finalResponse?.model || effectiveModel;
    const finalUsage = finalResponse?.usage || null;
    const finalFinishReason = finalResponse?.output?.[0]?.stop_reason
      || finalResponse?.output?.[0]?.finish_reason
      || null;
    const citationList = extractCitations(finalResponse?.output);
    const reasoning = reasoningText || finalResponse?.response_metadata?.reasoning || null;
    const latencyMs = Date.now() - invocationStartedAt;

    emitStreamUpdate({
      text: finalAnswer,
      delta: '',
      isFinal: true,
      provider: PROVIDERS.OPENAI,
      model: finalModel,
      usage: finalUsage,
      latencyMs,
      citations: citationList.length ? citationList : undefined,
      reasoning,
    });

    return {
      success: true,
      answer: finalAnswer,
      usage: finalUsage,
      finishReason: finalFinishReason,
      provider: PROVIDERS.OPENAI,
      model: finalModel,
      citations: citationList.length ? citationList : null,
      reasoning,
    };
  };

  const processChatCompletionsStream = async (streamingResponse) => {
    if (!streamingResponse.body || typeof streamingResponse.body.getReader !== 'function') {
      const fallbackJson = await streamingResponse.json().catch(() => null);
      const fallbackAnswer = fallbackJson?.choices?.[0]?.message?.content;
      if (typeof fallbackAnswer === 'string' && fallbackAnswer.trim()) {
        const trimmed = fallbackAnswer.trim();
        emitStreamUpdate({
          text: trimmed,
          delta: trimmed,
          isFinal: true,
          provider: PROVIDERS.OPENAI,
          model: fallbackJson?.model || effectiveModel,
          usage: fallbackJson?.usage || null,
          latencyMs: Date.now() - invocationStartedAt,
        });
        return {
          success: true,
          answer: trimmed,
          usage: fallbackJson?.usage || null,
          finishReason: fallbackJson?.choices?.[0]?.finish_reason || null,
          provider: PROVIDERS.OPENAI,
          model: fallbackJson?.model || effectiveModel,
        };
      }
      throw buildRequestFailedError({ error: { message: 'OpenAI 스트리밍 응답을 처리할 수 없습니다.' } });
    }

    const decoder = new TextDecoder('utf-8');
    const reader = streamingResponse.body.getReader();
    let buffer = '';
    let aggregatedText = '';
    let finalModel = effectiveModel;
    let finishReason = null;

    const appendDelta = (deltaText) => {
      if (!deltaText) {
        return;
      }
      aggregatedText += deltaText;
      emitStreamUpdate({
        text: aggregatedText,
        delta: deltaText,
        isFinal: false,
        provider: PROVIDERS.OPENAI,
        model: finalModel,
      });
    };

    const extractDeltaText = (delta) => {
      if (!delta) {
        return '';
      }
      if (typeof delta.content === 'string') {
        return delta.content;
      }
      if (Array.isArray(delta.content)) {
        return delta.content
          .map((part) => {
            if (typeof part === 'string') {
              return part;
            }
            if (typeof part?.text === 'string') {
              return part.text;
            }
            return '';
          })
          .filter(Boolean)
          .join('');
      }
      if (typeof delta.content?.text === 'string') {
        return delta.content.text;
      }
      if (typeof delta.content?.value === 'string') {
        return delta.content.value;
      }
      return '';
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) {
          return;
        }
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.model) {
            finalModel = parsed.model;
          }
          if (Array.isArray(parsed.choices)) {
            parsed.choices.forEach((choice) => {
              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }
              const delta = choice.delta || {};
              const deltaText = extractDeltaText(delta);
              appendDelta(deltaText);
            });
          }
        } catch (parseError) {
          console.warn('[callOpenAIChat] chat completions 스트리밍 파싱 실패', { payload: payload.slice(0, 120), parseError });
        }
      });
    }

    const finalAnswer = aggregatedText.trim();
    if (!finalAnswer) {
      throw buildRequestFailedError({ error: { message: 'OpenAI 응답이 비어 있습니다.' } });
    }

    const latencyMs = Date.now() - invocationStartedAt;
    emitStreamUpdate({
      text: finalAnswer,
      delta: '',
      isFinal: true,
      provider: PROVIDERS.OPENAI,
      model: finalModel,
      usage: null,
      latencyMs,
      citations: undefined,
      reasoning: undefined,
    });

    return {
      success: true,
      answer: finalAnswer,
      usage: null,
      finishReason,
      provider: PROVIDERS.OPENAI,
      model: finalModel,
    };
  };

  let { response, errorPayload } = await performRequest();

  const isTemperatureUnsupportedError = () => {
    if (!errorPayload || body.temperature === undefined) {
      return false;
    }
    const message = String(errorPayload?.error?.message || '').toLowerCase();
    return message.includes('temperature') && message.includes('does not support');
  };

  if (!response.ok && !useResponsesApi && isTemperatureUnsupportedError()) {
    delete body.temperature;
    ({ response, errorPayload } = await performRequest());
  }

  if (!response.ok) {
    const message = errorPayload?.error?.message || response.statusText || 'OpenAI 요청에 실패했습니다.';
    const code = errorPayload?.error?.type || `http_${response.status}`;
    throw buildRequestFailedError({ error: { message, code } });
  }

  if (useResponsesApi && typeof onStreamChunk === 'function') {
    return processStreamingResponse(response);
  }

  if (!useResponsesApi && body.stream === true && typeof onStreamChunk === 'function') {
    return processChatCompletionsStream(response);
  }

  const data = await response.json();

  if (useResponsesApi) {
    const collectAnswerText = () => {
      if (typeof data.output_text === 'string') {
        const trimmed = data.output_text.trim();
        if (trimmed) {
          return trimmed;
        }
      }
      if (Array.isArray(data.output)) {
        const segments = [];
        data.output.forEach((item) => {
          if (!item || typeof item !== 'object' || !Array.isArray(item.content)) {
            return;
          }
          item.content.forEach((part) => {
            if (typeof part?.text === 'string') {
              segments.push(part.text.trim());
            }
          });
        });
        return segments.filter(Boolean).join('\n').trim();
      }
      return '';
    };

    const answer = collectAnswerText();
    if (!answer) {
      throw buildRequestFailedError({ error: { message: 'OpenAI 응답이 비어 있습니다.' } });
    }

    const citations = extractCitations(data.output);
    const reasoning = data.response_metadata?.reasoning || null;

    return {
      success: true,
      answer,
      usage: data.usage || null,
      finishReason: data.output?.[0]?.stop_reason || null,
      provider: PROVIDERS.OPENAI,
      model: data.model || effectiveModel,
      citations: citations.length ? citations : null,
      reasoning,
    };
  }

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

  return {
    success: true,
    answer,
    usage: data.usage || null,
    finishReason: data.choices?.[0]?.finish_reason || null,
    provider: PROVIDERS.OPENAI,
    model: data.model || effectiveModel,
  };
};

const callGeminiChat = async ({
  messages,
  model,
  temperature,
  maxTokens,
  signal,
  onStreamChunk,
}) => {
  const invocationStartedAt = Date.now();
  console.log('[callGeminiChat] 함수 시작:', {
    messagesCount: messages?.length,
    model,
  });

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

  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  const performGeminiRequest = async () => {
    const response = await fetch(`${baseUrl}/models/${encodeURIComponent(model || config.defaultModel)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    const errorPayload = response.ok ? null : await response.json().catch(() => ({}));
    return { response, errorPayload };
  };

  const isOverloadedError = (response, errorPayload) => {
    const status = response?.status;
    const message = String(errorPayload?.error?.message || '').toLowerCase();
    return status === 503 || message.includes('overloaded');
  };

  let attempt = 0;
  const maxAttempts = 3;
  let meta = await performGeminiRequest();

  while (!meta.response.ok && attempt < maxAttempts - 1 && isOverloadedError(meta.response, meta.errorPayload)) {
    attempt += 1;
    await delay(500 * attempt);
    meta = await performGeminiRequest();
  }

  if (!meta.response.ok && isOverloadedError(meta.response, meta.errorPayload) && getFallbackApiKey(PROVIDERS.OPENAI)) {
    const fallback = await callOpenAIChat({
      messages,
      model: undefined,
      temperature,
      maxTokens,
      signal,
      onStreamChunk,
    });
    fallback.provider = PROVIDERS.OPENAI;
    fallback.fallbackFrom = PROVIDERS.GEMINI;
    return fallback;
  }

  if (!meta.response.ok) {
    const message = meta.errorPayload?.error?.message || meta.response.statusText || 'Gemini 요청에 실패했습니다.';
    const code = meta.errorPayload?.error?.status || `http_${meta.response.status}`;
    throw buildRequestFailedError({ error: { message, code } });
  }

  const data = await meta.response.json();
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

  if (typeof onStreamChunk === 'function') {
    try {
      onStreamChunk({
        text: answer,
        delta: answer,
        isFinal: true,
        provider: PROVIDERS.GEMINI,
        model: data.modelVersion || body.model,
        usage: data.usageMetadata || null,
        latencyMs: Date.now() - invocationStartedAt,
      });
    } catch (streamError) {
      console.warn('[callGeminiChat] 스트리밍 콜백 처리 중 오류', streamError);
    }
  }

  return {
    success: true,
    answer,
    usage: data.usageMetadata || null,
    finishReason: data.candidates?.[0]?.finishReason || null,
    provider: PROVIDERS.GEMINI,
    model: data.modelVersion || body.model,
  };
};

const callClaudeChat = async ({
  messages,
  model,
  temperature,
  maxTokens,
  signal,
  onStreamChunk,
}) => {
  const invocationStartedAt = Date.now();
  console.log('[callClaudeChat] 함수 시작:', {
    messagesCount: messages?.length,
    model,
  });

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

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal,
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
  const answer = Array.isArray(data.content)
    ? data.content
        .map((block) => {
          if (!block || typeof block !== 'object') {
            return '';
          }
          if (block.type === 'text' && typeof block.text === 'string') {
            return block.text.trim();
          }
          if (block.type === 'message' && Array.isArray(block.content)) {
            return block.content
              .map((part) => (typeof part?.text === 'string' ? part.text : ''))
              .filter(Boolean)
              .join('\n')
              .trim();
          }
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim()
    : '';

  if (!answer) {
    throw buildRequestFailedError({ error: { message: 'Claude 응답이 비어 있습니다.' } });
  }

  if (typeof onStreamChunk === 'function') {
    try {
      onStreamChunk({
        text: answer,
        delta: answer,
        isFinal: true,
        provider: PROVIDERS.CLAUDE,
        model: data.model || body.model,
        usage: data.usage || null,
        latencyMs: Date.now() - invocationStartedAt,
      });
    } catch (streamError) {
      console.warn('[callClaudeChat] 스트리밍 콜백 처리 중 오류', streamError);
    }
  }

  return {
    success: true,
    answer,
    usage: data.usage || null,
    finishReason: data.stop_reason || null,
    model: data.model || body.model,
    provider: PROVIDERS.CLAUDE,
  };
};;

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
    signal: payload.signal || payload.abortSignal,
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
