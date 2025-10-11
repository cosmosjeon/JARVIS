const STRONG_REASONING_KEYWORDS = [
  'analyze',
  'analysis',
  'reason',
  'reasoning',
  'explain',
  'derive',
  'proof',
  'prove',
  'justify',
  'strategy',
  'strategies',
  'plan',
  'architecture',
  'design',
  'complex',
  'optimize',
  'diagnose',
  'evaluate',
  'compare',
  'trade-off',
  'tradeoff',
  'step-by-step',
  'multi-step',
  'debate',
  'implication',
  'insight',
  'scenario',
  'hypothesis',
];

const CODING_KEYWORDS = [
  'function',
  'class',
  'const ',
  'let ',
  'var ',
  'def ',
  'public ',
  'private ',
  'interface',
  'struct',
  'async',
  'await',
  'promise',
  'debug',
  'stack trace',
  'error:',
  'exception',
  'traceback',
];

const CREATIVE_IMAGE_KEYWORDS = [
  'image',
  '사진',
  '그림',
  'visual',
  'diagram',
  'sketch',
  'render',
  'illustration',
  'reference photo',
];

const extractLatestUserMessage = (messages = []) => {
  if (!Array.isArray(messages)) {
    return '';
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }
    const role = candidate.role || candidate.author;
    if (role !== 'user') {
      continue;
    }
    if (typeof candidate.content === 'string') {
      return candidate.content.trim();
    }
    if (Array.isArray(candidate.content)) {
      const joined = candidate.content
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return '';
          }
          if (typeof entry.text === 'string') {
            return entry.text;
          }
          if (typeof entry.value === 'string') {
            return entry.value;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
      if (joined.trim()) {
        return joined.trim();
      }
    }
    if (typeof candidate.text === 'string') {
      return candidate.text.trim();
    }
  }
  return '';
};

const countCodeIndicators = (text) => {
  if (!text) {
    return 0;
  }
  let score = 0;
  if (text.includes('```')) {
    score += 2;
  }
  CODING_KEYWORDS.forEach((keyword) => {
    if (text.toLowerCase().includes(keyword)) {
      score += 1;
    }
  });
  return score;
};

const computeReasoningScore = (text) => {
  if (!text) {
    return 0;
  }
  const normalized = text.toLowerCase();
  let score = 0;
  STRONG_REASONING_KEYWORDS.forEach((keyword) => {
    if (normalized.includes(keyword)) {
      score += 1;
    }
  });
  if (normalized.includes('?') && normalized.includes('explain why')) {
    score += 1;
  }
  if (normalized.includes('step') && normalized.includes('reason')) {
    score += 1;
  }
  return score;
};

const detectImageIntent = (text, attachmentCount) => {
  if (attachmentCount > 0) {
    return true;
  }
  if (!text) {
    return false;
  }
  const normalized = text.toLowerCase();
  return CREATIVE_IMAGE_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const selectOpenAIModel = ({
  text,
  attachments = [],
  webSearchEnabled = false,
  forceReasoning = false,
}) => {
  const trimmed = (text || '').trim();
  const length = trimmed.length;
  const reasoningScore = computeReasoningScore(trimmed);
  const codeScore = countCodeIndicators(trimmed);
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const wantsVision = detectImageIntent(trimmed, attachments?.length || 0);
  const containsMathNotation = /[\d\s]*[\+\-\*\/\=\^\(\)]{2,}/.test(trimmed);
  const containsTableOrListRequest = /\btable\b|\blist\b|\bcompare\b/i.test(trimmed);

  if (forceReasoning) {
    return {
      provider: 'openai',
      model: 'gpt-5',
      reasoning: { effort: length > 800 ? 'high' : 'medium' },
      explanation: '사용자 요청으로 reasoning 모드를 강제 활성화해 GPT-5를 사용합니다.',
      confidence: 'high',
    };
  }

  if (wantsVision || hasAttachments) {
    return {
      provider: 'openai',
      model: 'gpt-5',
      explanation: hasAttachments
        ? '이미지 첨부가 포함되어 멀티모달을 지원하는 GPT-5를 선택했습니다.'
        : '시각 정보를 요구하는 질문으로 판단되어 GPT-5를 선택했습니다.',
      confidence: 'high',
    };
  }

  if (reasoningScore >= 2 || length > 320 || containsTableOrListRequest || (containsMathNotation && length > 200)) {
    return {
      provider: 'openai',
      model: 'gpt-5',
      reasoning: { effort: length > 1200 ? 'high' : 'medium' },
      explanation: '복잡한 분석이 필요해 GPT-5와 reasoning 구성을 권장합니다.',
      confidence: 'medium',
    };
  }

  if (codeScore >= 2 || length <= 180) {
    return {
      provider: 'openai',
      model: 'gpt-5-mini',
      explanation: '빠른 응답이 필요한 일반/코드 질의로 판단되어 GPT-5 mini를 선택했습니다.',
      confidence: 'medium',
    };
  }

  if (webSearchEnabled && length > 200) {
    return {
      provider: 'openai',
      model: 'gpt-5',
      explanation: '웹 검색이 활성화되어 있어 요약 품질을 위해 GPT-5를 선택했습니다.',
      confidence: 'medium',
    };
  }

  return {
    provider: 'openai',
    model: 'gpt-5',
    explanation: '기본적으로 균형 잡힌 GPT-5 모델을 선택했습니다.',
    confidence: 'low',
  };
};

const fallbackSelection = () => ({
  provider: 'openai',
  model: 'gpt-5-mini',
  explanation: '명확한 신호가 없어 가볍고 빠른 GPT-5 mini를 선택했습니다.',
  confidence: 'low',
});

export const selectAutoModel = ({
  messages,
  question,
  attachments,
  webSearchEnabled = false,
  forceReasoning = false,
} = {}) => {
  const latestQuestion = (typeof question === 'string' && question.trim())
    ? question.trim()
    : extractLatestUserMessage(messages);

  const normalizedAttachments = Array.isArray(attachments) ? attachments : [];

  const selection = selectOpenAIModel({
    text: latestQuestion,
    attachments: normalizedAttachments,
    webSearchEnabled,
    forceReasoning,
  });

  return selection || fallbackSelection();
};

export default selectAutoModel;
