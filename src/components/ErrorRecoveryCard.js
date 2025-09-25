import React from 'react';

const ErrorRecoveryCard = ({
  title = '문제가 발생했습니다',
  description = '잠시 후 다시 시도해주세요.',
  onRetry,
  onExport,
  actions = [],
}) => {
  const handleRetry = async () => {
    try {
      await onRetry?.();
      window.jarvisAPI?.log?.('info', 'error_recovery_retry_clicked');
    } catch (error) {
      window.jarvisAPI?.log?.('error', 'error_recovery_retry_failed', { message: error?.message });
    }
  };

  const handleExport = async () => {
    try {
      const result = await onExport?.();
      window.jarvisAPI?.log?.('info', 'error_recovery_export_clicked', result || {});
    } catch (error) {
      window.jarvisAPI?.log?.('error', 'error_recovery_export_failed', { message: error?.message });
    }
  };

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
