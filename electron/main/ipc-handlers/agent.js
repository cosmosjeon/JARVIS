const registerAgentHandlers = ({ ipcMain, llmService, logger }) => {
  if (!ipcMain || !llmService) {
    throw new Error('[ipc-handlers/agent] Missing required dependencies');
  }

  const handleLLMRequest = async (_event, payload = {}) => {
    try {
      const {
        messages = [],
        model,
        temperature,
        maxTokens,
        provider,
      } = payload;

      const sanitizedMessages = Array.isArray(messages) ? messages : [];

      const result = await llmService.ask({
        messages: sanitizedMessages,
        model,
        temperature,
        maxTokens,
        provider,
      });

      return { success: true, ...result };
    } catch (error) {
      const code = error?.code || 'llm_request_failed';
      const message = error?.message || 'LLM request failed';
      logger?.error?.('agent_request_failed', { code, message });
      return {
        success: false,
        error: {
          code,
          message,
        },
      };
    }
  };

  ipcMain.handle('agent:askRoot', handleLLMRequest);
  ipcMain.handle('agent:askChild', handleLLMRequest);

  const normalizeKeyword = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return '';
    }
    return tokens[0].slice(0, 48);
  };

  ipcMain.handle('agent:extractKeyword', async (_event, payload = {}) => {
    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    if (!question) {
      return {
        success: false,
        error: {
          code: 'invalid_question',
          message: 'Question text is required to extract a keyword.',
        },
      };
    }

    try {
      const messages = [
        {
          role: 'system',
          content: 'Extract the single most important keyword from the user question. Respond with exactly one word, without any additional text.',
        },
        {
          role: 'user',
          content: question,
        },
      ];

      const result = await llmService.ask({
        messages,
        model: payload.model,
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0,
        maxTokens: payload.maxTokens ?? 8,
        provider: payload.provider,
      });

      const keyword = normalizeKeyword(result?.answer || '');
      if (!keyword) {
        return {
          success: false,
          error: {
            code: 'keyword_empty',
            message: 'Keyword extraction returned an empty value.',
          },
        };
      }

      return { success: true, keyword };
    } catch (error) {
      const code = error?.code || 'keyword_request_failed';
      const message = error?.message || 'Keyword extraction failed';
      logger?.error?.('agent_keyword_failed', { code, message });
      return {
        success: false,
        error: {
          code,
          message,
        },
      };
    }
  });
};

module.exports = {
  registerAgentHandlers,
};
