import React, { useEffect } from 'react';
import { useSettings } from '../hooks/SettingsContext';

const SettingsPanel = () => {
  const {
    doubleCtrlEnabled,
    autoPasteEnabled,
    trayEnabled,
    accessibilityGranted,
    setDoubleCtrlEnabled,
    setAutoPasteEnabled,
    setTrayEnabled,
    refreshAccessibilityStatus,
    requestAccessibility,
  } = useSettings();

  useEffect(() => {
    refreshAccessibilityStatus();
  }, [refreshAccessibilityStatus]);

  return (
    <div className="glass-surface flex w-full max-w-md flex-col gap-4 rounded-3xl border border-white/10 bg-white/10 p-4 text-sm text-slate-100 shadow-2xl">
      <h2 className="text-lg font-semibold text-slate-50">설정 (실험용)</h2>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span>더블 Ctrl 토글</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={doubleCtrlEnabled}
              onChange={(event) => setDoubleCtrlEnabled(event.target.checked)}
            />
            <span className="text-xs text-slate-300">윈도우에서 창 열기/닫기</span>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <span>자동 붙여넣기</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoPasteEnabled}
              onChange={(event) => setAutoPasteEnabled(event.target.checked)}
            />
            <span className="text-xs text-slate-300">클립보드 → 입력창 자동 채우기</span>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <span>트레이 아이콘 사용</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trayEnabled}
              onChange={(event) => setTrayEnabled(event.target.checked)}
            />
            <span className="text-xs text-slate-300">앱 실행 시 트레이 표시</span>
          </label>
        </div>
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span>macOS 접근성 권한</span>
          <span className={`text-xs ${accessibilityGranted ? 'text-emerald-200' : 'text-rose-200'}`}>
            {accessibilityGranted === null ? '확인 중...' : accessibilityGranted ? '허용됨' : '필요'}
          </span>
        </div>
        <button
          type="button"
          onClick={requestAccessibility}
          className="glass-chip rounded-full bg-emerald-500/40 px-3 py-2 text-emerald-50 hover:bg-emerald-500/60"
        >
          권한 확인 / 요청
        </button>
      </section>
    </div>
  );
};

export default SettingsPanel;
