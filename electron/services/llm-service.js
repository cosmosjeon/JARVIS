const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = process.env.OPENAI_TEMPERATURE !== undefined
  ? Number(process.env.OPENAI_TEMPERATURE)
  : undefined;
const REQUEST_TIMEOUT_MS = process.env.OPENAI_TIMEOUT_MS ? Number(process.env.OPENAI_TIMEOUT_MS) : 30000;

let cachedSettingsPath = null;

const extractMessageContent = (message) => {
  if (!message) {
    return '';
  }

  const { content } = message;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (!entry) {
          return '';
        }
        if (typeof entry === 'string') {
          return entry;
        }
        if (typeof entry.text === 'string') {
          return entry.text;
        }
        if (Array.isArray(entry.content)) {
          return entry.content
            .filter((child) => typeof child?.text === 'string')
            .map((child) => child.text)
            .join('');
        }
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  if (content && typeof content === 'object' && typeof content.text === 'string') {
    return content.text;
  }

  return '';
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

const resolveApiKey = () => {
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
    this.client = null;
    this.cacheKey = null;
  }

  ensureClient() {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      const error = new Error('Missing OpenAI API key. Set OPENAI_API_KEY or create openai.json with apiKey');
      error.code = 'OPENAI_KEY_MISSING';
      throw error;
    }

    if (this.client && this.cacheKey === apiKey) {
      return this.client;
    }

    this.client = new OpenAI({
      apiKey,
      timeout: REQUEST_TIMEOUT_MS,
    });
    this.cacheKey = apiKey;
    return this.client;
  }

  async ask({ messages, model = DEFAULT_MODEL, temperature = DEFAULT_TEMPERATURE, maxTokens }) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages array is required');
    }

    const client = this.ensureClient();
    const startedAt = Date.now();

    try {
      const requestPayload = {
        model,
        messages,
      };

      if (typeof temperature === 'number' && Number.isFinite(temperature)) {
        requestPayload.temperature = temperature;
      }

      if (typeof maxTokens === 'number' && Number.isFinite(maxTokens)) {
        requestPayload.max_tokens = maxTokens;
      }

      const response = await client.chat.completions.create(requestPayload);

      const choice = response.choices?.[0] || null;
      const answer = extractMessageContent(choice?.message).trim();

      if (!answer) {
        const error = new Error('Empty response from OpenAI. Verify the model and request payload.');
        error.code = 'OPENAI_EMPTY_ANSWER';
        throw error;
      }

      return {
        answer,
        usage: response.usage || null,
        finishReason: choice?.finish_reason || null,
        model: response.model,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (this.logger && typeof this.logger.error === 'function') {
        this.logger.error('openai_request_failed', {
          message: error.message,
          code: error.code,
          status: error.status,
        });
      }
      throw error;
    }
  }
}

module.exports = {
  LLMService,
  resolveApiKey,
};
