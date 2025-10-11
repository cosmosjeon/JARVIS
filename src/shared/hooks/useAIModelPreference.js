import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'jarvis.ai.preference';

export const AI_PROVIDERS = [
  {
    id: 'openai',
    label: 'GPT',
    defaultModel: 'gpt-5',
    models: [
      { id: 'gpt-5', label: 'GPT-5' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    defaultModel: 'gemini-2.5-pro',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
  },
  {
    id: 'claude',
    label: 'Claude',
    defaultModel: 'claude-sonnet-4-5',
    models: [
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    ],
  },
];

export const PRIMARY_MODEL_OPTIONS = [
  { id: 'openai', label: 'GPT' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
];

const PROVIDER_MAP = AI_PROVIDERS.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

const FAST_MODEL_BY_PROVIDER = {
  openai: 'gpt-5-mini',
  gemini: 'gemini-2.5-flash',
  claude: 'claude-3-5-haiku-latest',
};

const DEFAULT_PROVIDER = 'openai';

export const resolveModelForProvider = (providerId, fastResponseEnabled) => {
  const normalized = PROVIDER_MAP[providerId] ? providerId : DEFAULT_PROVIDER;
  if (fastResponseEnabled && FAST_MODEL_BY_PROVIDER[normalized]) {
    return FAST_MODEL_BY_PROVIDER[normalized];
  }
  return PROVIDER_MAP[normalized]?.defaultModel || FAST_MODEL_BY_PROVIDER[normalized] || '';
};

const DEFAULT_STATE = {
  provider: DEFAULT_PROVIDER,
  model: resolveModelForProvider(DEFAULT_PROVIDER, false),
  temperature: 0.7,
  webSearchEnabled: false,
  reasoningEnabled: false,
  fastResponseEnabled: false,
};

const PREFERENCE_EVENT = 'jarvis:ai-preference-change';

const normalizePreference = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE };
  }

  const provider = typeof raw.provider === 'string' && PROVIDER_MAP[raw.provider]
    ? raw.provider
    : DEFAULT_PROVIDER;

  const providerConfig = PROVIDER_MAP[provider];
  const fastResponseEnabled = typeof raw.fastResponseEnabled === 'boolean'
    ? raw.fastResponseEnabled
    : DEFAULT_STATE.fastResponseEnabled;
  const supportedModels = providerConfig.models
    .map((model) => model.id)
    .concat(FAST_MODEL_BY_PROVIDER[provider] ? [FAST_MODEL_BY_PROVIDER[provider]] : []);

  const model = typeof raw.model === 'string' && supportedModels.includes(raw.model)
    ? raw.model
    : resolveModelForProvider(provider, fastResponseEnabled);

  const temperature = typeof raw.temperature === 'number' && Number.isFinite(raw.temperature)
    ? raw.temperature
    : DEFAULT_STATE.temperature;

  const webSearchEnabled = typeof raw.webSearchEnabled === 'boolean'
    ? raw.webSearchEnabled
    : DEFAULT_STATE.webSearchEnabled;
  const reasoningEnabled = typeof raw.reasoningEnabled === 'boolean'
    ? raw.reasoningEnabled
    : DEFAULT_STATE.reasoningEnabled;

  return {
    provider,
    model,
    temperature,
    webSearchEnabled,
    reasoningEnabled,
    fastResponseEnabled,
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
      return {
        ...prev,
        provider: nextProvider,
        model: resolveModelForProvider(nextProvider, prev.fastResponseEnabled),
      };
    });
  }, [setPreference]);

  const setTemperature = useCallback((value) => {
    setPreference((prev) => ({
      ...prev,
      temperature: Number.isFinite(value) ? value : prev.temperature,
    }));
  }, [setPreference]);

  const setWebSearchEnabled = useCallback((next) => {
    setPreference((prev) => ({
      ...prev,
      webSearchEnabled: Boolean(next),
    }));
  }, [setPreference]);

  const setReasoningEnabled = useCallback((next) => {
    setPreference((prev) => ({
      ...prev,
      reasoningEnabled: Boolean(next),
    }));
  }, [setPreference]);

  const setFastResponseEnabled = useCallback((next) => {
    setPreference((prev) => {
      const fastEnabled = Boolean(next);
      return {
        ...prev,
        fastResponseEnabled: fastEnabled,
        model: resolveModelForProvider(prev.provider, fastEnabled),
      };
    });
  }, [setPreference]);

  return {
    preference,
    provider: preference.provider,
    model: preference.model,
    temperature: preference.temperature,
    webSearchEnabled: preference.webSearchEnabled,
    reasoningEnabled: preference.reasoningEnabled,
    fastResponseEnabled: preference.fastResponseEnabled,
    providerOptions,
    currentProvider: providerConfig,
    setProvider,
    setTemperature,
    setWebSearchEnabled,
    setReasoningEnabled,
    setFastResponseEnabled,
    setPreference,
  };
};

export default useAIModelPreference;
