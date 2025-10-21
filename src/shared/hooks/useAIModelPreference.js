import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'jarvis.ai.preference';

const DEFAULT_MODEL = 'gpt-5';

export const AI_MODEL_OPTIONS = [
  {
    id: 'gpt-5',
    label: 'GPT-5',
    description: 'OpenAI의 강력한 성능 모델',
    provider: 'openai',
  },
  {
    id: 'gpt-5-mini',
    label: 'GPT-5 mini',
    description: 'OpenAI의 빠른 모델',
    provider: 'openai',
  },
];

const MODEL_MAP = AI_MODEL_OPTIONS.reduce((acc, model) => {
  acc[model.id] = model;
  return acc;
}, {});

const PROVIDER_MODELS = AI_MODEL_OPTIONS.reduce((acc, model) => {
  const key = typeof model.provider === 'string'
    ? model.provider.toLowerCase()
    : '';
  if (!key) {
    return acc;
  }
  if (!acc[key]) {
    acc[key] = [];
  }
  acc[key].push(model.id);
  return acc;
}, {});

export const resolveModelForProvider = (providerId) => {
  const key = typeof providerId === 'string'
    ? providerId.toLowerCase()
    : '';
  const models = PROVIDER_MODELS[key];
  if (Array.isArray(models) && models.length > 0) {
    return models[0];
  }
  return DEFAULT_MODEL;
};

export const resolveProviderForModel = (modelId) => {
  return MODEL_MAP[modelId]?.provider || 'openai';
};

// Legacy support - kept for backward compatibility
export const PRIMARY_MODEL_OPTIONS = AI_MODEL_OPTIONS;

const DEFAULT_STATE = {
  model: DEFAULT_MODEL,
  provider: resolveProviderForModel(DEFAULT_MODEL),
  temperature: 0.7,
};

const PREFERENCE_EVENT = 'jarvis:ai-preference-change';

const normalizePreference = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE };
  }

  const model = typeof raw.model === 'string' && MODEL_MAP[raw.model]
    ? raw.model
    : DEFAULT_MODEL;

  const provider = resolveProviderForModel(model);

  const temperature = typeof raw.temperature === 'number' && Number.isFinite(raw.temperature)
    ? raw.temperature
    : DEFAULT_STATE.temperature;

  return {
    model,
    provider,
    temperature,
  };
};

const readPreference = () => {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_STATE };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_STATE };
    }
    const parsed = JSON.parse(stored);
    return normalizePreference(parsed);
  } catch (error) {
    console.warn('[useAIModelPreference] Failed to read preference. Fallback to default.', error);
    return { ...DEFAULT_STATE };
  }
};

const persistPreference = (next) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[useAIModelPreference] Failed to persist preference.', error);
  }
};

const broadcastPreference = (next) => {
  if (typeof window === 'undefined') {
    return;
  }
  const event = new CustomEvent(PREFERENCE_EVENT, { detail: next });
  window.dispatchEvent(event);
};

export const useAIModelPreference = () => {
  const [preference, setPreferenceState] = useState(() => readPreference());

  const setPreference = useCallback((updater) => {
    setPreferenceState((prev) => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      const normalized = normalizePreference(updated);
      persistPreference(normalized);
      broadcastPreference(normalized);
      return normalized;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      if (!event.newValue) {
        setPreferenceState(readPreference());
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        setPreferenceState(normalizePreference(parsed));
      } catch (error) {
        console.warn('[useAIModelPreference] Failed to parse storage event payload.', error);
      }
    };

    const handleCustomEvent = (event) => {
      const detail = event?.detail;
      if (!detail) {
        return;
      }
      setPreferenceState(normalizePreference(detail));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(PREFERENCE_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(PREFERENCE_EVENT, handleCustomEvent);
    };
  }, []);

  const modelOptions = useMemo(() => AI_MODEL_OPTIONS, []);

  const currentModelInfo = useMemo(
    () => MODEL_MAP[preference.model] ?? MODEL_MAP[DEFAULT_MODEL],
    [preference.model],
  );

  const setModel = useCallback((modelId) => {
    setPreference((prev) => {
      const nextModel = MODEL_MAP[modelId] ? modelId : prev.model;
      if (nextModel === prev.model) {
        return prev;
      }
      return {
        ...prev,
        model: nextModel,
        provider: resolveProviderForModel(nextModel),
      };
    });
  }, [setPreference]);

  const setTemperature = useCallback((value) => {
    setPreference((prev) => ({
      ...prev,
      temperature: Number.isFinite(value) ? value : prev.temperature,
    }));
  }, [setPreference]);

  return {
    preference,
    provider: preference.provider,
    model: preference.model,
    temperature: preference.temperature,
    modelOptions,
    currentModelInfo,
    setModel,
    setTemperature,
    setPreference,
  };
};

export default useAIModelPreference;
