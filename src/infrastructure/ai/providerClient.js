export const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseBase64FromDataUrl = (dataUrl, fallbackMime = '') => {
  const trimmed = toTrimmedString(dataUrl);
  console.log('[parseBase64FromDataUrl] 입력:', {
    dataUrlLength: dataUrl?.length,
    trimmedLength: trimmed?.length,
    dataUrlPreview: dataUrl?.substring(0, 100),
  });
  const matches = trimmed.match(/^data:(.*?);base64,(.*)$/);
  if (!matches || matches.length < 3) {
    console.log('[parseBase64FromDataUrl] 매칭 실패:', { hasMatches: !!matches, matchesLength: matches?.length });
    return {
      mimeType: fallbackMime,
      base64: '',
    };
  }
  const result = {
    mimeType: matches[1] || fallbackMime,
    base64: matches[2],
  };
  console.log('[parseBase64FromDataUrl] 파싱 성공:', {
    mimeType: result.mimeType,
    base64Length: result.base64?.length,
    base64Preview: result.base64?.substring(0, 50),
  });
  return result;
};

export const PROVIDERS = {
  AUTO: 'auto',
  OPENAI: 'openai',
};

export const PROVIDER_LABELS = {
  [PROVIDERS.AUTO]: 'Smart Auto',
  [PROVIDERS.OPENAI]: 'OpenAI',
};

export const FALLBACK_CONFIG = {
  [PROVIDERS.OPENAI]: {
    baseUrl: process.env.REACT_APP_OPENAI_API_URL || 'https://api.openai.com/v1/responses',
    defaultModel: process.env.REACT_APP_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5',
    apiKeyEnv: ['REACT_APP_OPENAI_API_KEY', 'OPENAI_API_KEY'],
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
  console.log('[sanitizeAttachmentList] 입력:', {
    isArray: Array.isArray(attachments),
    length: attachments?.length,
    attachments,
  });

  if (!Array.isArray(attachments)) {
    console.log('[sanitizeAttachmentList] 배열이 아니어서 빈 배열 반환');
    return [];
  }

  const result = attachments
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      console.log(`[sanitizeAttachmentList] 항목 ${index} 처리 시작:`, {
        type: item.type,
        mimeType: item.mimeType,
        hasBase64: !!item.base64,
        hasDataUrl: !!item.dataUrl,
        hasTextContent: !!item.textContent,
      });

      const type = (item.type || 'image').toLowerCase();
      const mimeType = toTrimmedString(item.mimeType) || undefined;
      const label = toTrimmedString(item.label) || undefined;
      const base64 = toTrimmedString(item.base64);
      const dataUrl = toTrimmedString(item.dataUrl);
      const textContent = toTrimmedString(item.textContent);
      const pageCount = Number.isFinite(item.pageCount) ? item.pageCount : undefined;

      if (type === 'pdf') {
        console.log(`[sanitizeAttachmentList] PDF 처리 (항목 ${index}):`, {
          hasTextContent: !!textContent,
          hasBase64: !!base64,
          hasDataUrl: !!dataUrl,
        });

        if (!textContent && !base64 && !dataUrl) {
          console.log(`[sanitizeAttachmentList] PDF 항목 ${index}: 데이터가 없어서 null 반환`);
          return null;
        }
        const parsed = base64 || dataUrl
          ? parseBase64FromDataUrl(dataUrl, mimeType || 'application/pdf')
          : { mimeType, base64: '' };

        const pdfResult = {
          type: 'pdf',
          mimeType: parsed.mimeType || 'application/pdf',
          base64: base64 || parsed.base64,
          dataUrl: dataUrl || '',
          textContent,
          label,
          pageCount,
        };
        console.log(`[sanitizeAttachmentList] PDF 항목 ${index} 정규화 완료:`, {
          hasBase64: !!pdfResult.base64,
          hasDataUrl: !!pdfResult.dataUrl,
          hasTextContent: !!pdfResult.textContent,
          base64Length: pdfResult.base64?.length,
          dataUrlLength: pdfResult.dataUrl?.length,
        });
        return pdfResult;
      }

      if (type === 'image') {
        console.log(`[sanitizeAttachmentList] 이미지 처리 (항목 ${index}):`, {
          hasDataUrl: !!dataUrl,
          hasBase64: !!base64,
          mimeType,
          dataUrlPreview: dataUrl?.substring(0, 50),
          base64Preview: base64?.substring(0, 50),
        });

        if (!dataUrl && !base64) {
          console.log(`[sanitizeAttachmentList] 이미지 항목 ${index}: 데이터가 없어서 null 반환`);
          return null;
        }

        // Base64 우선, 없으면 dataUrl에서 추출
        let finalBase64 = base64;
        let finalMimeType = mimeType;

        if (!finalBase64 && dataUrl) {
          const parsed = parseBase64FromDataUrl(dataUrl, mimeType);
          finalBase64 = parsed.base64 || '';
          finalMimeType = parsed.mimeType || mimeType;
          console.log(`[sanitizeAttachmentList] 이미지 항목 ${index} dataUrl 파싱:`, {
            parsedBase64Length: finalBase64?.length,
            parsedMimeType: finalMimeType,
          });
        }

        if (!finalBase64) {
          console.log(`[sanitizeAttachmentList] 이미지 항목 ${index}: base64 추출 실패, null 반환`);
          return null;
        }

        const imageResult = {
          type: 'image',
          mimeType: finalMimeType || 'image/png',
          base64: finalBase64,
          dataUrl,
          label,
        };
        console.log(`[sanitizeAttachmentList] 이미지 항목 ${index} 정규화 완료:`, {
          hasBase64: !!imageResult.base64,
          hasDataUrl: !!imageResult.dataUrl,
          mimeType: imageResult.mimeType,
          base64Length: imageResult.base64?.length,
          dataUrlLength: imageResult.dataUrl?.length,
        });
        return imageResult;
      }

      console.log(`[sanitizeAttachmentList] 항목 ${index}: 지원하지 않는 타입 '${type}', null 반환`);
      return null;
    })
    .filter(Boolean);

  console.log('[sanitizeAttachmentList] 최종 결과:', {
    inputLength: attachments.length,
    outputLength: result.length,
    result,
  });

  return result;
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
      console.log('[mapToOpenAIContentParts] appendImage: attachment가 없음');
      return;
    }
    console.log('[mapToOpenAIContentParts] appendImage 시작:', {
      type: attachment.type,
      mimeType: attachment.mimeType,
      hasBase64: !!attachment.base64,
      hasDataUrl: !!attachment.dataUrl,
    });

    const fallbackMime = attachment.mimeType || 'image/png';
    const base64Raw = toTrimmedString(attachment.base64);
    let dataUrl = toTrimmedString(attachment.dataUrl);

    if (!dataUrl && base64Raw) {
      dataUrl = `data:${fallbackMime};base64,${base64Raw}`;
      console.log('[mapToOpenAIContentParts] base64에서 dataUrl 생성:', { dataUrlLength: dataUrl.length });
    }

    if (!dataUrl && fallbackMime.startsWith('image/')) {
      const parsed = parseBase64FromDataUrl(attachment.dataUrl || '', fallbackMime);
      if (parsed.base64) {
        dataUrl = `data:${parsed.mimeType || fallbackMime};base64,${parsed.base64}`;
        console.log('[mapToOpenAIContentParts] fallback dataUrl 생성:', { dataUrlLength: dataUrl.length });
      }
    }

    if (!dataUrl) {
      console.log('[mapToOpenAIContentParts] appendImage: dataUrl이 없어서 중단');
      return;
    }

    const parsed = parseBase64FromDataUrl(dataUrl, fallbackMime);
    console.log('[mapToOpenAIContentParts] parseBase64 결과:', {
      hasBase64: !!parsed.base64,
      mimeType: parsed.mimeType,
      base64Length: parsed.base64?.length,
    });
    if (!parsed.base64) {
      console.log('[mapToOpenAIContentParts] appendImage: parsed.base64가 없어서 중단');
      return;
    }

    const imagePart = {
      type: imageType,
      image_url: `data:${parsed.mimeType || fallbackMime};base64,${parsed.base64}`,
    };
    console.log('[mapToOpenAIContentParts] 이미지 파트 추가:', {
      type: imagePart.type,
      imageUrlLength: imagePart.image_url.length,
    });
    parts.push(imagePart);
  };

  const appendPdf = (attachment) => {
    if (!attachment) {
      console.log('[mapToOpenAIContentParts] appendPdf: attachment가 없음');
      return;
    }
    console.log('[mapToOpenAIContentParts] appendPdf 시작:', {
      type: attachment.type,
      mimeType: attachment.mimeType,
      hasBase64: !!attachment.base64,
      hasDataUrl: !!attachment.dataUrl,
      hasTextContent: !!attachment.textContent,
      textContentLength: attachment.textContent?.length,
    });

    const fallbackMime = attachment.mimeType || 'application/pdf';
    const base64Raw = toTrimmedString(attachment.base64);
    let pdfDataUrl = toTrimmedString(attachment.dataUrl);

    // dataUrl 없으면 base64에서 생성
    if (!pdfDataUrl && base64Raw) {
      pdfDataUrl = `data:${fallbackMime};base64,${base64Raw}`;
      console.log('[mapToOpenAIContentParts] base64에서 PDF dataUrl 생성:', { dataUrlLength: pdfDataUrl.length });
    }

    // PDF Base64를 image_url 형식으로 전송 (GPT-5/4o는 PDF 직접 처리 가능)
    if (pdfDataUrl) {
      const pdfPart = {
        type: imageType,
        image_url: pdfDataUrl,
      };
      console.log('[mapToOpenAIContentParts] PDF 파트 추가 (image_url 형식):', {
        type: pdfPart.type,
        imageUrlLength: pdfPart.image_url.length,
        imageUrlPreview: pdfPart.image_url.substring(0, 50) + '...',
      });
      parts.push(pdfPart);
    }

    // 추가로 텍스트 설명도 포함 (컨텍스트 제공 및 fallback)
    const heading = [
      'PDF 첨부',
      attachment.label ? `(${attachment.label})` : '',
      attachment.pageCount ? `· ${attachment.pageCount}쪽` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const pdfText = toTrimmedString(attachment.textContent);
    if (pdfText) {
      const combinedText = [heading || 'PDF 첨부', pdfText].filter(Boolean).join('\n\n');
      console.log('[mapToOpenAIContentParts] PDF 텍스트 추가:', {
        heading,
        pdfTextLength: pdfText.length,
        combinedTextLength: combinedText.length,
      });
      appendText(combinedText);
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
    const type = (attachment.type || '').toLowerCase();
    const mime = (attachment.mimeType || '').toLowerCase();
    const isPdf =
      type === 'pdf'
      || mime.startsWith('application/pdf');

    if (isPdf) {
      appendPdf({
        ...attachment,
        mimeType: attachment.mimeType || 'application/pdf',
      });
      return;
    }

    const isImage =
      type === 'image'
      || mime.startsWith('image/');

    if (isImage) {
      appendImage(attachment);
      return;
    }

    // Unsupported type -> ignore
    if (attachment.type === 'pdf') {
      appendPdf(attachment);
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
    const fallbackMime = attachment.mimeType || 'image/png';
    const base64Raw = toTrimmedString(attachment.base64);
    let dataUrl = toTrimmedString(attachment.dataUrl);

    if (!dataUrl && base64Raw) {
      dataUrl = `data:${fallbackMime};base64,${base64Raw}`;
    }

    if (!dataUrl) {
      return;
    }

    parts.push({ type: imageType, image_url: dataUrl });
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

export const callProvider = async ({ provider, ...payload }) => {
  console.log('[callProvider] 호출됨:', {
    provider,
    hasMessages: !!payload.messages,
    messagesCount: payload.messages?.length,
    hasAttachments: !!payload.attachments,
    attachmentsCount: payload.attachments?.length,
    payload,
  });

  const normalizedProvider = normalizeProvider(provider);
  console.log('[callProvider] 정규화된 프로바이더:', { normalizedProvider });

  if (normalizedProvider === PROVIDERS.OPENAI) {
    console.log('[callProvider] OpenAI 호출');
    return callOpenAIChat(payload);
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
