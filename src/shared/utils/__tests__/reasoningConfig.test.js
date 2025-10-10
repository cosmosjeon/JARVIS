import { resolveReasoningConfig } from '../reasoningConfig';

describe('resolveReasoningConfig', () => {
  it('returns original model when reasoning disabled', () => {
    const result = resolveReasoningConfig({
      provider: 'openai',
      model: 'gpt-4o-mini',
      reasoningEnabled: false,
    });

    expect(result).toEqual({
      model: 'gpt-4o-mini',
      reasoning: null,
      explanation: null,
    });
  });

  it('forces GPT-5 with medium effort for OpenAI when reasoning enabled', () => {
    const result = resolveReasoningConfig({
      provider: 'openai',
      model: 'gpt-4o-mini',
      reasoningEnabled: true,
      inputLength: 500,
    });

    expect(result.model).toBe('gpt-5');
    expect(result.reasoning).toEqual({ provider: 'openai', effort: 'medium' });
    expect(result.explanation).toContain('GPT-5');
  });

  it('applies thinking budget for Gemini reasoning', () => {
    const result = resolveReasoningConfig({
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      reasoningEnabled: true,
      inputLength: 1400,
    });

    expect(result.model).toBe('gemini-2.5-pro');
    expect(result.reasoning).toMatchObject({
      provider: 'gemini',
      effort: 'high',
      includeThoughts: true,
    });
    expect(result.reasoning.thinkingBudget).toBeGreaterThanOrEqual(1024);
  });

  it('enables thinking budget for Claude reasoning', () => {
    const result = resolveReasoningConfig({
      provider: 'claude',
      model: 'claude-sonnet-4-5',
      reasoningEnabled: true,
      inputLength: 200,
    });

    expect(result.model).toBe('claude-sonnet-4-5');
    expect(result.reasoning).toMatchObject({
      provider: 'claude',
      effort: 'low',
    });
    expect(result.reasoning.budgetTokens).toBeGreaterThan(0);
  });
});
