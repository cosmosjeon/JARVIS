const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  CLAUDE: 'claude',
};

const PROVIDER_LABELS = {
  [PROVIDERS.OPENAI]: 'OpenAI',
  [PROVIDERS.GEMINI]: 'Google Gemini',
  [PROVIDERS.CLAUDE]: 'Anthropic Claude',
};

const PROVIDER_DEFAULTS = {
  [PROVIDERS.OPENAI]: {
    model: process.env.OPENAI_MODEL || 'gpt-5',
    temperature: process.env.OPENAI_TEMPERATURE !== undefined
      ? Number(process.env.OPENAI_TEMPERATURE)
      : undefined,
  },
  [PROVIDERS.GEMINI]: {
    model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    temperature: process.env.GEMINI_TEMPERATURE !== undefined
      ? Number(process.env.GEMINI_TEMPERATURE)
      : undefined,
  },
  [PROVIDERS.CLAUDE]: {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    temperature: process.env.ANTHROPIC_TEMPERATURE !== undefined
      ? Number(process.env.ANTHROPIC_TEMPERATURE)
      : undefined,
  },
};

const REQUEST_TIMEOUT_MS = process.env.OPENAI_TIMEOUT_MS
  ? Number(process.env.OPENAI_TIMEOUT_MS)
  : 30000;

let cachedSettingsPath = null;

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const extractMessageText = (message) => {
  if (!message || typeof message !== 'object') {
    return '';
  }

  if (typeof message.content === 'string') {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((entry) => {
        if (!entry) return '';
        if (typeof entry === 'string') return entry;
        if (typeof entry.text === 'string') return entry.text;
        if (Array.isArray(entry.content)) {
          return entry.content
            .filter((child) => typeof child?.text === 'string')
            .map((child) => child.text)
            .join('');
        }
        return '';
      })
      .filter(Boolean)
      .join('')
      .trim();
  }

  if (message.content && typeof message.content === 'object' && typeof message.content.text === 'string') {
    return message.content.text.trim();
  }

  if (typeof message.text === 'string') {
    return message.text.trim();
  }

  return '';
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
      const text = extractMessageText(message);
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

const mapToGeminiPayload = (messages = []) => {
  const { systemInstruction, conversation } = splitSystemAndConversation(messages);
  const contents = conversation
    .map((message) => {
      const text = extractMessageText(message);
      if (!text) {
        return null;
      }
      return {
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      };
    })
    .filter(Boolean);

  return {
    contents,
    systemInstruction: systemInstruction
      ? { role: 'user', parts: [{ text: systemInstruction }] }
      : null,
  };
};

const mapToClaudePayload = (messages = []) => {
  const { systemInstruction, conversation } = splitSystemAndConversation(messages);
  const claudeMessages = conversation
    .map((message) => {
      const text = extractMessageText(message);
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

const getSettingsFilePath = () => {
  if (cachedSettingsPath) {
    return cachedSettingsPath;
  }
  try {
    cachedSettingsPath = path.join(app.getPath('userData'), 'openai.json');
  } catch (error) {
    cachedSettingsPath = null;
  }
  return cachedSettingsPath;
};

const resolveOpenAIApiKey = () => {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }

  try {
    const settingsPath = getSettingsFilePath();
    if (settingsPath && fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (typeof parsed.apiKey === 'string' && parsed.apiKey.trim()) {
        return parsed.apiKey.trim();
      }
    }
  } catch (error) {
    // ignore and fall back to null
  }

  return null;
};

const resolveGeminiApiKey = () => {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GEMINI_API_KEY,
  ];
  return candidates
    .map(toTrimmedString)
    .find((value) => value) || null;
};

const resolveClaudeApiKey = () => {
  const candidates = [
    process.env.ANTHROPIC_API_KEY,
    process.env.CLAUDE_API_KEY,
  ];
  return candidates
    .map(toTrimmedString)
    .find((value) => value) || null;
};

class LLMService {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.openAIClient = null;
    this.openAICacheKey = null;
    this.geminiClient = null;
    this.claudeClient = null;
  }

  ensureOpenAIClient() {
    const apiKey = resolveOpenAIApiKey();
    if (!apiKey) {
      const error = new Error('Missing OpenAI API key. Set OPENAI_API_KEY or create openai.json with apiKey');
      error.code = 'OPENAI_KEY_MISSING';
      throw error;
    }

    if (this.openAIClient && this.openAICacheKey === apiKey) {
      return this.openAIClient;
    }

    this.openAIClient = new OpenAI({
      apiKey,
      timeout: REQUEST_TIMEOUT_MS,
    });
    this.openAICacheKey = apiKey;
    return this.openAIClient;
  }

  ensureGeminiClient() {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      const error = new Error('Missing Gemini API key. Set GEMINI_API_KEY in the environment.');
      error.code = 'GEMINI_KEY_MISSING';
      throw error;
    }
    if (!this.geminiClient || this.geminiClient._apiKey !== apiKey) {
      this.geminiClient = new GoogleGenerativeAI(apiKey);
      this.geminiClient._apiKey = apiKey;
    }
    return this.geminiClient;
  }

  ensureClaudeClient() {
    const apiKey = resolveClaudeApiKey();
    if (!apiKey) {
      const error = new Error('Missing Claude API key. Set ANTHROPIC_API_KEY in the environment.');
      error.code = 'CLAUDE_KEY_MISSING';
      throw error;
    }
    if (!this.claudeClient || this.claudeClient._apiKey !== apiKey) {
      this.claudeClient = new Anthropic({
        apiKey,
        timeout: REQUEST_TIMEOUT_MS,
      });
      this.claudeClient._apiKey = apiKey;
    }
    return this.claudeClient;
  }

  logError(provider, error) {
    if (!this.logger || typeof this.logger.error !== 'function') {
      return;
    }
    this.logger.error(`${provider}_request_failed`, {
      message: error.message,
      code: error.code,
      status: error.status,
    });
  }

  static isOpenAITemperatureSupported(modelId) {
    if (!modelId) {
      return true;
    }
    const normalized = String(modelId).toLowerCase();
    if (normalized.startsWith('gpt-5')) {
      return false;
    }
    return true;
  }

  async askOpenAI({ messages, model, temperature, maxTokens, webSearchEnabled }) {
    const client = this.ensureOpenAIClient();
    const startedAt = Date.now();

    try {
      const input = mapMessagesToOpenAIInput(messages);

      const requestPayload = {
        model,
        input,
      };

      if (typeof temperature === 'number'
        && Number.isFinite(temperature)
        && LLMService.isOpenAITemperatureSupported(model)) {
        requestPayload.temperature = temperature;
      }

      if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
        requestPayload.max_output_tokens = maxTokens;
      }

      if (webSearchEnabled) {
        requestPayload.tools = [
          {
            type: 'web_search',
          },
        ];
      }

      const response = await client.responses.create(requestPayload);
      const answer = typeof response.output_text === 'string' ? response.output_text.trim() : '';

      if (!answer) {
        const error = new Error('Empty response from OpenAI. Verify the model and request payload.');
        error.code = 'OPENAI_EMPTY_ANSWER';
        throw error;
      }

      return {
        answer,
        usage: response.usage || null,
        finishReason: response.output?.[0]?.stop_reason || null,
        model: response.model,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logError('openai', error);
      throw error;
    }
  }

  async askGemini({ messages, model, temperature, maxTokens, webSearchEnabled }) {
    const client = this.ensureGeminiClient();
    const startedAt = Date.now();

    try {
      const { contents, systemInstruction } = mapToGeminiPayload(messages);
      if (!contents.length) {
        const error = new Error('Gemini conversation payload is empty.');
        error.code = 'GEMINI_EMPTY_MESSAGES';
        throw error;
      }

      const resolvedModel = model || PROVIDER_DEFAULTS[PROVIDERS.GEMINI].model;
      const generativeModel = client.getGenerativeModel({
        model: resolvedModel,
        tools: webSearchEnabled ? [{ googleSearch: {} }] : undefined,
      });

      const request = {
        contents,
      };

      if (systemInstruction) {
        request.systemInstruction = systemInstruction;
      }

      const generationConfig = {};
      if (typeof temperature === 'number' && Number.isFinite(temperature)) {
        generationConfig.temperature = temperature;
      } else if (typeof PROVIDER_DEFAULTS[PROVIDERS.GEMINI].temperature === 'number') {
        generationConfig.temperature = PROVIDER_DEFAULTS[PROVIDERS.GEMINI].temperature;
      }
      if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
        generationConfig.maxOutputTokens = maxTokens;
      }
      if (Object.keys(generationConfig).length > 0) {
        request.generationConfig = generationConfig;
      }

      if (webSearchEnabled) {
        request.tools = [{ googleSearch: {} }];
      }

      const rawResponse = await generativeModel.generateContent(request);
      const response = rawResponse?.response || rawResponse;
      const candidates = response?.candidates || [];
      const candidate = candidates[0];
      const parts = candidate?.content?.parts || [];
      const answer = parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();

      if (!answer) {
        const error = new Error('Empty response from Gemini. Verify the model and request payload.');
        error.code = 'GEMINI_EMPTY_ANSWER';
        throw error;
      }

      return {
        answer,
        usage: response?.usageMetadata || null,
        finishReason: candidate?.finishReason || null,
        model: response?.model || resolvedModel,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logError('gemini', error);
      throw error;
    }
  }

  async askClaude({ messages, model, temperature, maxTokens, webSearchEnabled }) {
    const client = this.ensureClaudeClient();
    const startedAt = Date.now();

    try {
      const { claudeMessages, systemInstruction } = mapToClaudePayload(messages);
      if (!claudeMessages.length) {
        const error = new Error('Claude conversation payload is empty.');
        error.code = 'CLAUDE_EMPTY_MESSAGES';
        throw error;
      }

      const requestPayload = {
        model: model || PROVIDER_DEFAULTS[PROVIDERS.CLAUDE].model,
        messages: claudeMessages,
        max_tokens: typeof maxTokens === 'number' && Number.isFinite(maxTokens) ? maxTokens : 1024,
      };

      if (systemInstruction) {
        requestPayload.system = systemInstruction;
      }

      if (typeof temperature === 'number' && Number.isFinite(temperature)) {
        requestPayload.temperature = temperature;
      } else if (typeof PROVIDER_DEFAULTS[PROVIDERS.CLAUDE].temperature === 'number') {
        requestPayload.temperature = PROVIDER_DEFAULTS[PROVIDERS.CLAUDE].temperature;
      }

      if (webSearchEnabled) {
        requestPayload.tools = [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 5,
          },
        ];
      }

      const response = await client.messages.create(requestPayload);
      const answer = (response.content || [])
        .map((block) => (typeof block?.text === 'string' ? block.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();

      if (!answer) {
        const error = new Error('Empty response from Claude. Verify the model and request payload.');
        error.code = 'CLAUDE_EMPTY_ANSWER';
        throw error;
      }

      return {
        answer,
        usage: response.usage || null,
        finishReason: response.stop_reason || null,
        model: response.model,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logError('claude', error);
      throw error;
    }
  }

  async ask({
    provider = PROVIDERS.OPENAI,
    messages,
    model,
    temperature,
    maxTokens,
    webSearchEnabled = false,
  } = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages array is required');
    }

    const normalizedProvider = Object.values(PROVIDERS).includes(provider)
      ? provider
      : PROVIDERS.OPENAI;

    switch (normalizedProvider) {
      case PROVIDERS.OPENAI:
        return this.askOpenAI({
          messages,
          model: model || PROVIDER_DEFAULTS[PROVIDERS.OPENAI].model,
          temperature,
          maxTokens,
          webSearchEnabled,
        });
      case PROVIDERS.GEMINI:
        return this.askGemini({
          messages,
          model,
          temperature,
          maxTokens,
          webSearchEnabled,
        });
      case PROVIDERS.CLAUDE:
        return this.askClaude({
          messages,
          model,
          temperature,
          maxTokens,
          webSearchEnabled,
        });
      default: {
        const error = new Error(`Unsupported provider: ${provider}`);
        error.code = 'PROVIDER_UNSUPPORTED';
        error.provider = provider;
        throw error;
      }
    }
  }
}

module.exports = {
  LLMService,
  resolveOpenAIApiKey,
  resolveGeminiApiKey,
  resolveClaudeApiKey,
  PROVIDERS,
  PROVIDER_LABELS,
};
const mapMessagesToOpenAIInput = (messages = []) => {
  const partsFromMessage = (message) => {
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

    const appendImage = (value) => {
      const url = typeof value === 'string' ? value.trim() : '';
      if (url) {
        parts.push({ type: imageType, image_url: { url } });
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
          appendImage(
            (part.image_url && part.image_url.url)
            || part.url
            || part.dataUrl
            || ''
          );
        }
      });
    } else {
      appendText(
        typeof message.content === 'string'
          ? message.content
          : message.text,
      );
    }

    const attachments = Array.isArray(message.attachments)
      ? message.attachments.filter((item) => item && typeof item === 'object' && typeof item.dataUrl === 'string')
      : [];

    attachments.forEach((attachment) => appendImage(attachment.dataUrl));

    if (!parts.length) {
      parts.push({ type: textType, text: '' });
    }

    return parts;
  };

  return (messages || []).map((message) => ({
    role: message.role || 'user',
    content: partsFromMessage(message),
  }));
};
