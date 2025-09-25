import React, { useEffect, useRef, useState } from 'react';
import TrayDebugButton from '../components/TrayDebugButton';
import ErrorRecoveryCard from '../components/ErrorRecoveryCard';

const DebugDashboard = () => {
  const [showErrorCard, setShowErrorCard] = useState(false);
  const [trayEvents, setTrayEvents] = useState([]);
  const [accessibilityStatus, setAccessibilityStatus] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const autoRetryTimerRef = useRef(null);

  useEffect(() => {
    if (!window.jarvisAPI?.onTrayCommand) return undefined;
    const unsubscribe = window.jarvisAPI.onTrayCommand((payload) => {
      setTrayEvents((prev) => [payload, ...prev].slice(0, 5));
      window.jarvisAPI?.log?.('info', 'tray_command_received', { command: payload?.command });
    });
    return () => unsubscribe?.();
  }, []);

  const simulateRetry = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    setRetryAttempts((prev) => prev + 1);
    setShowErrorCard(false);
  };

  const simulateExport = async () => {
    const result = await window.jarvisAPI?.exportLogs?.();
    setExportStatus(result);
    return result;
  };

  const handleCheckAccessibility = async () => {
    const result = await window.jarvisAPI?.checkAccessibilityPermission?.();
    if (result && typeof result.granted === 'boolean') {
      setAccessibilityStatus(result);
    }
  };

  const handleRequestAccessibility = async () => {
    const result = await window.jarvisAPI?.requestAccessibilityPermission?.();
    if (result && typeof result.granted === 'boolean') {
      setAccessibilityStatus(result);
    }
  };

  useEffect(() => {
    if (!showErrorCard) {
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
      return;
    }

    setRetryAttempts(0);

    const scheduleRetry = (attempt) => {
      if (attempt >= 3) {
        autoRetryTimerRef.current = null;
        return;
      }
      autoRetryTimerRef.current = setTimeout(async () => {
        window.jarvisAPI?.log?.('info', 'auto_retry_attempt', { attempt: attempt + 1 });
        await simulateRetry();
      }, 2000 * (attempt + 1));
    };

    scheduleRetry(0);

    return () => {
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, [showErrorCard]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <TrayDebugButton />
        <button
          type="button"
          onClick={() => setShowErrorCard((prev) => !prev)}
          className="glass-chip rounded-full bg-white/15 px-3 py-1 text-xs text-slate-50 hover:bg-white/25"
        >
          {showErrorCard ? '오류 카드 숨기기' : '오류 카드 보기'}
        </button>
        <button
          type="button"
          onClick={handleCheckAccessibility}
          className="glass-chip rounded-full bg-white/15 px-3 py-1 text-xs text-slate-50 hover:bg-white/30"
        >
          접근성 상태 확인
        </button>
        <button
          type="button"
          onClick={handleRequestAccessibility}
          className="glass-chip rounded-full bg-emerald-500/40 px-3 py-1 text-xs text-emerald-50 hover:bg-emerald-500/60"
        >
          접근성 권한 요청
        </button>
      </div>
      {showErrorCard && (
        <ErrorRecoveryCard
          title="네트워크 연결이 원활하지 않습니다"
          description="인터넷 연결을 확인한 뒤 다시 시도해주세요."
          actions={[
            `자동 재시도 (최대 3회) 진행 중 – 현재 ${retryAttempts}회 실행됨`,
            '네트워크 상태 확인',
            'macOS 접근성 권한 재확인',
            'OpenAI 키 유효성 검사',
          ]}
          onRetry={simulateRetry}
          onExport={simulateExport}
        />
      )}
      {trayEvents.length > 0 && (
        <div className="glass-surface rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-100">
          <h4 className="mb-2 text-sm font-semibold">최근 트레이 이벤트</h4>
          <ul className="space-y-1">
            {trayEvents.map((event, index) => (
              <li key={event?.timestamp || index}>
                <span className="font-mono text-emerald-200">{event?.command}</span>
                <span className="ml-2 text-slate-300/80">
                  {new Date(event?.timestamp || Date.now()).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {accessibilityStatus && (
        <div className="glass-surface rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-100">
          <h4 className="mb-2 text-sm font-semibold">접근성 권한 상태</h4>
          <p className="text-slate-200">
            {accessibilityStatus.granted ? '허용됨' : '미허용'}
          </p>
          {accessibilityStatus.error && (
            <p className="mt-1 text-rose-200">{accessibilityStatus.error}</p>
          )}
        </div>
      )}
      {exportStatus && (
        <div className="glass-surface rounded-2xl border border-white/10 bg-emerald-500/10 p-3 text-xs text-emerald-50">
          <h4 className="mb-2 text-sm font-semibold">로그 내보내기 결과</h4>
          {exportStatus.success ? (
            <p className="text-emerald-100">
              내보낸 파일: <span className="font-mono">{exportStatus.path}</span>
            </p>
          ) : (
            <p className="text-rose-200">
              실패: {exportStatus?.error?.message || '알 수 없는 오류'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugDashboard;
