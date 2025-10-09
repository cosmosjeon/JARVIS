import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'jarvis.ai.preference';

export const AI_PROVIDERS = [
  {
    id: 'openai',
    label: 'GPT-5',
    defaultModel: 'gpt-5',
    models: [
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini 2.5 Pro',
    defaultModel: 'gemini-2.5-pro',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (미리보기)' },
    ],
  },
  {
    id: 'claude',
    label: 'Claude 4.5',
    defaultModel: 'claude-sonnet-4-5',
    models: [
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
  },
];

const PROVIDER_MAP = AI_PROVIDERS.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

const DEFAULT_STATE = {
  provider: 'openai',
  model: PROVIDER_MAP.openai.defaultModel,
  temperature: 0.7,
};

const PREFERENCE_EVENT = 'jarvis:ai-preference-change';

const normalizePreference = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE };
  }

  const provider = typeof raw.provider === 'string' && PROVIDER_MAP[raw.provider]
    ? raw.provider
    : DEFAULT_STATE.provider;

  const providerConfig = PROVIDER_MAP[provider];
  const supportedModels = providerConfig.models.map((model) => model.id);

  const model = typeof raw.model === 'string' && supportedModels.includes(raw.model)
    ? raw.model
    : providerConfig.defaultModel;

  const temperature = typeof raw.temperature === 'number' && Number.isFinite(raw.temperature)
    ? raw.temperature
    : DEFAULT_STATE.temperature;

  return {
    provider,
    model,
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

  const providerConfig = useMemo(
    () => PROVIDER_MAP[preference.provider] ?? PROVIDER_MAP[DEFAULT_STATE.provider],
    [preference.provider],
  );

  const providerOptions = useMemo(
    () => AI_PROVIDERS.map(({ id, label }) => ({ id, label })),
    [],
  );

  const setProvider = useCallback((providerId) => {
    setPreference((prev) => {
      const nextProvider = PROVIDER_MAP[providerId] ? providerId : prev.provider;
      if (nextProvider === prev.provider) {
        return prev;
      }
      const nextProviderConfig = PROVIDER_MAP[nextProvider];
      return {
        ...prev,
        provider: nextProvider,
        model: nextProviderConfig.defaultModel,
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
   providerOptions,
    currentProvider: providerConfig,
    setProvider,
    setTemperature,
    setPreference,
  };
};

export default useAIModelPreference;
