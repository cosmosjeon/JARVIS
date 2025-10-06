import { createAgentBridge } from '../electron/bridges';

const resolveAgentBridge = (bridgeOverride) => createAgentBridge(bridgeOverride);

const FALLBACK_OPENAI_URL = process.env.REACT_APP_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const FALLBACK_OPENAI_MODEL = process.env.REACT_APP_OPENAI_MODEL || 'gpt-4o-mini';

const getFallbackApiKey = () => {
  const key = process.env.REACT_APP_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  return typeof key === 'string' ? key.trim() : '';
};

const canUseFallback = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(getFallbackApiKey());
};

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') {
        return null;
      }
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof message.content === 'string'
        ? message.content
        : typeof message.text === 'string'
          ? message.text
          : '';
      const trimmed = content.trim();
      if (!trimmed) {
        return null;
      }
      return { role, content: trimmed };
    })
    .filter(Boolean);
};

const callOpenAI = async ({ messages, model, temperature, maxTokens }) => {
  const apiKey = getFallbackApiKey();
  if (!apiKey) {
    throw buildMissingBridgeError();
  }

  const normalizedMessages = normalizeMessages(messages);
  if (!normalizedMessages.length) {
    throw buildRequestFailedError({ error: { message: '메시지가 비어 있습니다.' } });
  }

  const body = {
    model: model || FALLBACK_OPENAI_MODEL,
    messages: normalizedMessages,
  };

  if (typeof temperature === 'number' && Number.isFinite(temperature)) {
    body.temperature = temperature;
  }

  if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
    body.max_tokens = maxTokens;
  }

  const response = await fetch(FALLBACK_OPENAI_URL, {
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
  const extracted = typeof choice.message?.content === 'string'
    ? choice.message.content.trim()
    : '';

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

const fallbackAsk = (payload = {}) => callOpenAI(payload);

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

  const response = await callOpenAI({
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

const buildMissingBridgeError = () => {
  const error = new Error(
    'AI 서비스를 사용할 수 없습니다.\n\n' +
    '해결 방법:\n' +
    '1. Electron 앱으로 실행 중인 경우:\n' +
    '   - OpenAI API key를 설정해주세요.\n' +
    '   - 프로젝트 루트에 .env 파일을 생성하고 OPENAI_API_KEY를 설정하거나\n' +
    '   - userData 폴더에 openai.json 파일을 생성하여 {"apiKey": "your-key"} 형식으로 저장하세요.\n\n' +
    '2. 브라우저에서 실행 중인 경우:\n' +
    '   - .env 파일에 REACT_APP_OPENAI_API_KEY를 설정해주세요.\n\n' +
    '자세한 내용은 README.md를 참조하세요.'
  );
  error.code = 'AGENT_BRIDGE_MISSING';
  return error;
};

const buildInvalidChannelError = (channel) => {
  const error = new Error(`알 수 없는 에이전트 채널: ${channel}`);
  error.code = 'AGENT_CHANNEL_INVALID';
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
    const bridge = resolveAgentBridge(bridgeOverride);
    const hasBridge = bridge && typeof bridge[channel] === 'function';

    if (hasBridge) {
      const result = await bridge[channel](payload);
      if (result !== null && result !== undefined) {
        if (!result?.success) {
          throw buildRequestFailedError(result);
        }
        return result;
      }
    }

    if (canUseFallback()) {
      if (channel === 'askRoot' || channel === 'askChild') {
        return fallbackAsk(payload);
      }

      if (channel === 'extractKeyword') {
        return fallbackExtractKeyword(payload);
      }
    }

    if (!hasBridge) {
      throw buildInvalidChannelError(channel);
    }

    throw buildMissingBridgeError();
  }

  static async askRoot({ messages, model, temperature, maxTokens } = {}) {
    return AgentClient.request('askRoot', { messages, model, temperature, maxTokens });
  }

  static async askChild({ messages, model, temperature, maxTokens } = {}) {
    return AgentClient.request('askChild', { messages, model, temperature, maxTokens });
  }
}

export default AgentClient;
