import AgentClient, { PROVIDERS } from 'infrastructure/ai/agentClient';

const MAX_TITLE_LENGTH = 48;
const GEMINI_FLASH_LITE = 'gemini-2.0-flash-lite';

const toTrimmed = (value) => (typeof value === 'string' ? value.trim() : '');

const sanitizeGeneratedTitle = (value) => {
  const trimmed = toTrimmed(value)
    .replace(/^["'“”‘’«»「」\[\](（）){}<>]+/, '')
    .replace(/["'“”‘’«»「」\[\](（）){}<>]+$/, '');

  if (!trimmed) {
    return '';
  }

  const withoutTrailing = trimmed.replace(/[\s·•:;.,!?]+$/u, '').trim();
  if (!withoutTrailing) {
    return '';
  }

  return withoutTrailing.length > MAX_TITLE_LENGTH
    ? `${withoutTrailing.slice(0, MAX_TITLE_LENGTH).trim()}…`
    : withoutTrailing;
};

export const generateNodeTitle = async ({
  question,
  treeBridge,
} = {}) => {
  const trimmedQuestion = toTrimmed(question);
  if (!trimmedQuestion) {
    return { title: '' };
  }

  const systemInstruction = '사용자가 작성한 질문을 간결한 제목으로 요약하세요. '
    + '한국어 3~6단어 이내로 핵심 의미만 남기고, 불필요한 조사나 종결어미를 제거하며 '
    + '마침표 등 특수문자를 포함하지 마세요.';

  const userPrompt = `질문을 요약해 제목을 만들어주세요:\n${trimmedQuestion}`;

  try {
    const response = await AgentClient.askChild({
      provider: PROVIDERS.GEMINI,
      model: GEMINI_FLASH_LITE,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      maxTokens: 32,
      webSearchEnabled: false,
    });

    const rawAnswer = toTrimmed(response?.answer);
    const candidate = rawAnswer
      .split(/\r?\n/u)
      .map((line) => sanitizeGeneratedTitle(line))
      .find((line) => Boolean(line));

    if (!candidate) {
      const error = new Error('제목 생성 결과가 비어 있습니다.');
      error.code = 'NODE_TITLE_EMPTY';
      throw error;
    }

    return {
      title: candidate,
      usage: response?.usage || null,
    };
  } catch (error) {
    if (treeBridge?.log) {
      try {
        treeBridge.log('warn', 'node_title_generation_failed', {
          message: error?.message,
          code: error?.code,
        });
      } catch (loggingError) {
        // ignore logging failure
      }
    }
    throw error;
  }
};

export default {
  generateNodeTitle,
};
