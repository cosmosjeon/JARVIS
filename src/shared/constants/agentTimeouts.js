const parseTimeoutFromEnv = () => {
  const envCandidates = [
    process.env.REACT_APP_AGENT_TIMEOUT_MS,
    process.env.AGENT_TIMEOUT_MS,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);

  for (const candidate of envCandidates) {
    const parsed = Number.parseInt(candidate, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

export const DEFAULT_AGENT_RESPONSE_TIMEOUT_MS = parseTimeoutFromEnv() ?? 120000;
export const LONG_RESPONSE_NOTICE_DELAY_MS = 20000;
export const LONG_RESPONSE_REMINDER_DELAY_MS = 45000;

export default {
  DEFAULT_AGENT_RESPONSE_TIMEOUT_MS,
  LONG_RESPONSE_NOTICE_DELAY_MS,
  LONG_RESPONSE_REMINDER_DELAY_MS,
};
