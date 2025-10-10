const OPENAI_REASONING_MODEL = 'gpt-5';
const GEMINI_REASONING_MODEL = 'gemini-2.5-pro';
const CLAUDE_REASONING_MODEL = 'claude-sonnet-4-5';

const clampBudget = (value, { min, max }) => {
  if (!Number.isFinite(value)) {
    return null;
  }
  const clamped = Math.max(min, Math.min(max, value));
  return Math.round(clamped);
};

const mapEffortToBudget = (effort, { low, medium, high }) => {
  switch (effort) {
    case 'low':
      return low;
    case 'high':
      return high;
    case 'medium':
    default:
      return medium;
  }
};

const inferEffortFromLength = (length = 0) => {
  if (!Number.isFinite(length) || length <= 0) {
    return 'medium';
  }
  if (length >= 1200) {
    return 'high';
  }
  if (length <= 320) {
    return 'low';
  }
  return 'medium';
};

export const resolveReasoningConfig = ({
  provider,
  model,
  reasoningEnabled,
  inputLength,
} = {}) => {
  if (!reasoningEnabled) {
    return {
      model,
      reasoning: null,
      explanation: null,
    };
  }

  const normalizedProvider = (provider || '').toLowerCase();
  const normalizedModel = typeof model === 'string' ? model : '';
  const inferredEffort = inferEffortFromLength(inputLength);

  if (normalizedProvider === 'openai' || normalizedProvider === 'oai') {
    const resolvedModel = normalizedModel.startsWith(OPENAI_REASONING_MODEL)
      ? normalizedModel
      : OPENAI_REASONING_MODEL;

    const effort = normalizedModel.includes('high')
      ? 'high'
      : inferredEffort;

    const explanation = resolvedModel === normalizedModel
      ? null
      : 'Reasoning 모드 활성화를 위해 GPT-5 모델을 사용합니다.';

    return {
      model: resolvedModel,
      reasoning: {
        provider: 'openai',
        effort,
      },
      explanation,
    };
  }

  if (normalizedProvider === 'gemini' || normalizedProvider === 'google') {
    const resolvedModel = normalizedModel.includes('2.5')
      ? normalizedModel
      : GEMINI_REASONING_MODEL;

    const effort = inferredEffort;
    const thinkingBudget = mapEffortToBudget(effort, {
      low: 256,
      medium: 1024,
      high: 2048,
    });

    const explanation = resolvedModel === normalizedModel
      ? 'Reasoning 모드가 활성화되어 Gemini Thinking 설정을 사용합니다.'
      : 'Reasoning 모드 활성화를 위해 Gemini 2.5 reasoning 모델로 자동 전환했습니다.';

    return {
      model: resolvedModel,
      reasoning: {
        provider: 'gemini',
        effort,
        thinkingBudget,
        includeThoughts: true,
      },
      explanation,
    };
  }

  if (normalizedProvider === 'claude' || normalizedProvider === 'anthropic') {
    const resolvedModel = normalizedModel.includes('thought')
      ? normalizedModel
      : CLAUDE_REASONING_MODEL;

    const effort = inferredEffort;
    const budgetTokens = clampBudget(mapEffortToBudget(effort, {
      low: 2000,
      medium: 6000,
      high: 10000,
    }), { min: 1000, max: 12000 }) || 6000;

    const explanation = resolvedModel === normalizedModel
      ? 'Reasoning 모드가 활성화되어 Claude 생각 토큰을 예약합니다.'
      : 'Reasoning 모드 활성화를 위해 Claude Thinking 모델로 전환했습니다.';

    return {
      model: resolvedModel,
      reasoning: {
        provider: 'claude',
        effort,
        budgetTokens,
      },
      explanation,
    };
  }

  return {
    model,
    reasoning: null,
    explanation: null,
  };
};

export default resolveReasoningConfig;
