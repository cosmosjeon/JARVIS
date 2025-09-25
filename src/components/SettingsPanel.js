import React, { useState } from 'react';
import { useSettings } from '../hooks/SettingsContext';
import HotkeyRecorderModal from './HotkeyRecorderModal';

const SettingsPanel = () => {
  const {
    accelerator,
    setAccelerator,
  } = useSettings();

  const [recorderOpen, setRecorderOpen] = useState(false);

  const handleRecorderClose = () => setRecorderOpen(false);

  const handleAcceleratorSave = (value) => {
    if (typeof value === 'string' && value.trim()) {
      setAccelerator(value);
    }
    setRecorderOpen(false);
  };

  return (
    <div className="glass-surface flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 text-sm text-slate-100 shadow-2xl">
      <h2 className="text-base font-semibold text-slate-50">설정</h2>

      <div className="flex items-center justify-between">
        <span className="text-sm">단축키</span>
        <div className="flex items-center gap-2 text-xs text-slate-200">
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 font-mono text-slate-50">
            {accelerator}
          </span>
          <button
            type="button"
            onClick={() => setRecorderOpen(true)}
            className="glass-chip rounded-full bg-white/15 px-2 py-1 text-xs text-slate-50 hover:bg-white/25"
          >
            변경
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm">뷰포트 리셋</span>
          <span className="text-xs text-slate-300">더블클릭하면 1배 줌으로 리셋됩니다</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-200">
          <span className="rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-slate-50 text-xs" style={{ fontSize: '10px' }}>
            더블클릭
          </span>
        </div>
      </div>

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
