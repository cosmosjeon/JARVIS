const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const PROVIDERS = {
  OPENAI: 'openai',
};

const PROVIDER_LABELS = {
  [PROVIDERS.OPENAI]: 'OpenAI',
};

const PROVIDER_DEFAULTS = {
  [PROVIDERS.OPENAI]: {
    model: process.env.OPENAI_MODEL || 'gpt-5',
    temperature: process.env.OPENAI_TEMPERATURE !== undefined
      ? Number(process.env.OPENAI_TEMPERATURE)
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

class LLMService {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.openAIClient = null;
    this.openAICacheKey = null;
  }

  ensureOpenAIClient() {
    const apiKey = resolveOpenAIApiKey();
    if (!apiKey) {
      const error = new Error('Missing OpenAI API key. Set OPENAI_API_KEY or create openai.json with apiKey');
      error.code = 'OPENAI_KEY_MISSING';
      throw error;
    }

    if (this.openAIClient && this.openAICacheKey === apiKey) {
      this.logInfo('openai_client_reused', { cached: true });
      return this.openAIClient;
    }

    this.openAIClient = new OpenAI({
      apiKey,
      timeout: REQUEST_TIMEOUT_MS,
    });
    this.openAICacheKey = apiKey;
    this.logInfo('openai_client_initialized', { cached: false });
    return this.openAIClient;
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

  logInfo(event, payload) {
    if (!this.logger || typeof this.logger.info !== 'function') {
      return;
    }
    this.logger.info(event, payload);
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

  async askOpenAI({ messages, model, temperature, maxTokens }) {
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

      const response = await client.responses.create(requestPayload);
      const answer = typeof response.output_text === 'string' ? response.output_text.trim() : '';

      if (!answer) {
        const error = new Error('Empty response from OpenAI. Verify the model and request payload.');
        error.code = 'OPENAI_EMPTY_ANSWER';
        throw error;
      }

      const latencyMs = Date.now() - startedAt;
      this.logInfo('openai_request_succeeded', {
        model: response.model,
        latencyMs,
      });

      return {
        answer,
        usage: response.usage || null,
        finishReason: response.output?.[0]?.stop_reason || null,
        model: response.model,
        latencyMs,
      };
    } catch (error) {
      this.logError('openai', error);
      throw error;
    }
  }

  async ask({
    provider = PROVIDERS.OPENAI,
    messages,
    model,
    temperature,
    maxTokens,
  } = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages array is required');
    }

    const requestedProvider = typeof provider === 'string'
      ? provider.toLowerCase()
      : provider;
    const normalizedProvider = requestedProvider || PROVIDERS.OPENAI;

    if (!Object.values(PROVIDERS).includes(normalizedProvider)) {
      const error = new Error(`Unsupported provider: ${requestedProvider || provider}`);
      error.code = 'PROVIDER_UNSUPPORTED';
      error.provider = provider;
      throw error;
    }

    switch (normalizedProvider) {
      case PROVIDERS.OPENAI:
        return this.askOpenAI({
          messages,
          model: model || PROVIDER_DEFAULTS[PROVIDERS.OPENAI].model,
          temperature,
          maxTokens,
        });
      default: {
        const error = new Error(`Unsupported provider: ${normalizedProvider}`);
        error.code = 'PROVIDER_UNSUPPORTED';
        error.provider = normalizedProvider;
        throw error;
      }
    }
  }
}

module.exports = {
  LLMService,
  resolveOpenAIApiKey,
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
