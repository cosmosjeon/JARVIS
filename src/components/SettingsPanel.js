import React, { useEffect, useState } from 'react';
import { useSettings } from '../hooks/SettingsContext';
import HotkeyRecorderModal from './HotkeyRecorderModal';

const SettingsPanel = () => {
  const {
    doubleCtrlEnabled,
    trayEnabled,
    accelerator,
    accessibilityGranted,
    setDoubleCtrlEnabled,
    setTrayEnabled,
    setAccelerator,
    resetAccelerator,
    refreshAccessibilityStatus,
    requestAccessibility,
  } = useSettings();

  const [recorderOpen, setRecorderOpen] = useState(false);

  useEffect(() => {
    refreshAccessibilityStatus();
  }, [refreshAccessibilityStatus]);

  const handleRecorderClose = () => setRecorderOpen(false);

  const handleAcceleratorSave = (value) => {
    if (typeof value === 'string' && value.trim()) {
      setAccelerator(value);
    }
    setRecorderOpen(false);
  };

  return (
    <div className="glass-surface flex w-full max-w-md flex-col gap-4 rounded-3xl border border-white/10 bg-white/10 p-4 text-sm text-slate-100 shadow-2xl">
      <h2 className="text-lg font-semibold text-slate-50">설정 (실험용)</h2>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span>Alt+` 토글</span>
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
        <div className="flex items-center justify-between">
          <span>현재 단축키</span>
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 font-mono text-slate-50">
              Alt+`
            </span>
            <button
              type="button"
              onClick={() => setRecorderOpen(true)}
              className="glass-chip rounded-full bg-white/15 px-2 py-1 text-xs text-slate-50 hover:bg-white/25"
            >
              변경
            </button>
            <button
              type="button"
              onClick={resetAccelerator}
              className="glass-chip rounded-full bg-slate-500/40 px-2 py-1 text-xs text-slate-50 hover:bg-slate-500/60"
            >
              기본값
            </button>
          </div>
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
      {recorderOpen && (
        <HotkeyRecorderModal
          currentAccelerator={accelerator}
          onSave={handleAcceleratorSave}
          onClose={handleRecorderClose}
        />
      )}
    </div>
  );
};

export default SettingsPanel;
