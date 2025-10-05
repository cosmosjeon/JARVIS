import React, { useEffect, useMemo, useRef } from 'react';
import { createLoggerBridge } from 'infrastructure/electron/bridges';

const ErrorRecoveryCard = ({
  title = '문제가 발생했습니다',
  description = '잠시 후 다시 시도해주세요.',
  onRetry,
  onExport,
  actions = [],
  autoRetryPolicy,
}) => {
  const timerRef = useRef(null);
  const attemptRef = useRef(0);
  const loggerBridge = useMemo(() => createLoggerBridge(), []);

  const handleRetry = async () => {
    try {
      await onRetry?.();
      loggerBridge.log?.('info', 'error_recovery_retry_clicked');
    } catch (error) {
      loggerBridge.log?.('error', 'error_recovery_retry_failed', { message: error?.message });
    }
  };

  const handleExport = async () => {
    try {
      const result = await onExport?.();
      loggerBridge.log?.('info', 'error_recovery_export_clicked', result || {});
    } catch (error) {
      loggerBridge.log?.('error', 'error_recovery_export_failed', { message: error?.message });
    }
  };

  useEffect(() => {
    if (!autoRetryPolicy?.enabled || typeof onRetry !== 'function') {
      return undefined;
    }

    const {
      maxAttempts = 3,
      initialDelayMs = 2000,
      intervalMs = 2000,
    } = autoRetryPolicy;

    const scheduleNext = (delay) => {
      if (attemptRef.current >= maxAttempts) {
        return;
      }
      timerRef.current = setTimeout(async () => {
        attemptRef.current += 1;
        loggerBridge.log?.('info', 'error_recovery_auto_retry_attempt', {
          attempt: attemptRef.current,
          maxAttempts,
        });
        try {
          await onRetry();
        } catch (error) {
          loggerBridge.log?.('warn', 'error_recovery_auto_retry_failed', { message: error?.message });
        }
        scheduleNext(intervalMs);
      }, delay);
    };

    scheduleNext(initialDelayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = null;
      attemptRef.current = 0;
    };
  }, [autoRetryPolicy, loggerBridge, onRetry]);

  return (
    <div className="glass-surface flex flex-col gap-3 rounded-2xl border border-white/10 bg-rose-500/10 p-4 text-sm text-rose-50 shadow-xl">
      <div>
        <h3 className="text-base font-semibold text-rose-100">{title}</h3>
        <p className="mt-1 text-rose-50/90">{description}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRetry}
          className="glass-chip rounded-full bg-rose-400/40 px-3 py-1 text-rose-50 hover:bg-rose-400/60"
        >
          다시 시도
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="glass-chip rounded-full bg-white/15 px-3 py-1 text-rose-50 hover:bg-white/25"
        >
          로그 내보내기
        </button>
      </div>
      {actions.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-100/90">
          {actions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ErrorRecoveryCard;
