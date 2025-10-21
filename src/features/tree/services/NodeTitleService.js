import AgentClient, { PROVIDERS } from 'infrastructure/ai/agentClient';

const MAX_TITLE_LENGTH = 48;

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

const stripParticles = (word) => {
  if (typeof word !== 'string') {
    return '';
  }
  const trimmed = word.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/(은|는|이|가|을|를|과|와|도|만|에게|에서|으로|로|까지|부터|이나|나|라고|이며|처럼|에게서|이라면|이라서)$/u, '');
};

const removeLeadingInterrogatives = (tokens) => {
  const leadingStopwords = new Set([
    '어떻게', '왜', '무엇', '무엇을', '무엇이', '무슨', '어디', '어디서', '언제', '누가', '누구',
    '어떤', '어느', '혹시', '혹은', '혹은요', '혹시요', '혹', '정확히', '혹시도',
  ]);
  const result = [...tokens];
  while (result.length > 0 && leadingStopwords.has(result[0])) {
    result.shift();
  }
  return result;
};

const buildHeuristicTitle = (source) => {
  const base = toTrimmed(source)
    .replace(/[`"'“”‘’«»「」\[\]()（）{}<>]/g, ' ')
    .replace(/[?!？！，,.]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base) {
    return '';
  }

  const rawTokens = base.split(/\s+/u).filter(Boolean).map(stripParticles).filter(Boolean);
  const tokens = removeLeadingInterrogatives(rawTokens);

  if (!tokens.length) {
    return base.length > MAX_TITLE_LENGTH ? `${base.slice(0, MAX_TITLE_LENGTH).trim()}…` : base;
  }

  const candidate = tokens.slice(0, 6).join(' ');
  const normalized = candidate || base;
  return normalized.length > MAX_TITLE_LENGTH
    ? `${normalized.slice(0, MAX_TITLE_LENGTH).trim()}…`
    : normalized;
};

const DEFAULT_PROVIDER_PRIORITY = [
  { provider: PROVIDERS.OPENAI, model: null },
];

const normalizeProviderId = (providerId) => {
  if (typeof providerId !== 'string') {
    return '';
  }
  const lower = providerId.trim().toLowerCase();
  if (!lower || lower === PROVIDERS.AUTO) {
    return '';
  }
  if (Object.values(PROVIDERS).includes(lower)) {
    return lower;
  }
  return '';
};

const buildProviderQueue = ({ provider, model } = {}) => {
  const queue = [];
  const seen = new Set();

  const pushCandidate = (candidateProvider, candidateModel) => {
    const normalized = normalizeProviderId(candidateProvider);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    queue.push({
      provider: normalized,
      model: candidateModel || null,
    });
  };

  pushCandidate(provider, model);
  DEFAULT_PROVIDER_PRIORITY.forEach((candidate) => pushCandidate(candidate.provider, candidate.model));

  return queue;
};

const logGenerationFailure = (treeBridge, error, context = {}) => {
  if (!treeBridge?.log) {
    return;
  }
  try {
    treeBridge.log('warn', 'node_title_generation_failed', {
      message: error?.message,
      code: error?.code,
      provider: error?.provider || context?.provider || null,
      attempts: context?.attempts,
    });
  } catch (_loggingError) {
    // logging best-effort
  }
};

export const generateNodeTitle = async ({
  question,
  treeBridge,
  provider,
  model,
} = {}) => {
  const trimmedQuestion = toTrimmed(question);
  if (!trimmedQuestion) {
    return { title: '' };
  }

  const systemInstruction = '사용자가 작성한 질문을 간결한 제목으로 요약하세요. '
    + '한국어 3~6단어 이내로 핵심 의미만 남기고, 불필요한 조사나 종결어미를 제거하며 '
    + '마침표 등 특수문자를 포함하지 마세요.';

  const userPrompt = `질문을 요약해 제목을 만들어주세요:\n${trimmedQuestion}`;

  const providerQueue = buildProviderQueue({ provider, model });
  const attempts = [];
  let lastError = null;

  for (const candidate of providerQueue) {
    try {
      const response = await AgentClient.askChild({
        provider: candidate.provider,
        model: candidate.model || undefined,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens: 32,
      });

      const rawAnswer = toTrimmed(response?.answer);
      const candidateTitle = rawAnswer
        .split(/\r?\n/u)
        .map((line) => sanitizeGeneratedTitle(line))
        .find((line) => Boolean(line));

      if (!candidateTitle) {
        const error = new Error('제목 생성 결과가 비어 있습니다.');
        error.code = 'NODE_TITLE_EMPTY';
        throw error;
      }

      return {
        title: candidateTitle,
        usage: response?.usage || null,
      };
    } catch (error) {
      error.provider = error?.provider || candidate.provider;
      lastError = error;
      attempts.push({
        provider: candidate.provider,
        code: error?.code || null,
      });
    }
  }

  if (lastError) {
    logGenerationFailure(treeBridge, lastError, { attempts });
    const fallbackTitle = buildHeuristicTitle(trimmedQuestion);
    if (fallbackTitle) {
      try {
        treeBridge?.log?.('info', 'node_title_generation_heuristic', {
          message: lastError?.message,
          provider: lastError?.provider || null,
          attempts,
        });
      } catch (_loggingError) {
        // best-effort logging
      }
      return {
        title: fallbackTitle,
        usage: null,
        heuristic: true,
      };
    }
    throw lastError;
  }

  const fallbackError = new Error('제목 생성에 사용할 수 있는 제공자가 없습니다.');
  fallbackError.code = 'NODE_TITLE_PROVIDER_UNAVAILABLE';
  logGenerationFailure(treeBridge, fallbackError, { attempts });
  throw fallbackError;
};

export default {
  generateNodeTitle,
};
