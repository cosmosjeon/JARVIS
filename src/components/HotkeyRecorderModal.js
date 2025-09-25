import React, { useEffect, useMemo, useState } from 'react';

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'Command']);

const SPECIAL_KEY_MAP = {
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Tab: 'Tab',
  Space: 'Space',
  Spacebar: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

const normalizeKeyPart = (event) => {
  const { code, key } = event;
  if (code?.startsWith('Key')) {
    return code.slice(3).toUpperCase();
  }
  if (code?.startsWith('Digit')) {
    return code.slice(5);
  }
  if (code && SPECIAL_KEY_MAP[code]) {
    return SPECIAL_KEY_MAP[code];
  }
  if (key && SPECIAL_KEY_MAP[key]) {
    return SPECIAL_KEY_MAP[key];
  }
  if (typeof key === 'string' && key.length === 1) {
    return key.toUpperCase();
  }
  if (typeof key === 'string' && !MODIFIER_KEYS.has(key)) {
    return key;
  }
  return '';
};

const buildAccelerator = (event) => {
  const parts = [];
  if (event.metaKey) {
    parts.push('Command');
  }
  if (event.ctrlKey) {
    parts.push('Control');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }

  const keyPart = normalizeKeyPart(event);
  if (!keyPart || MODIFIER_KEYS.has(keyPart)) {
    return '';
  }

  const uniqueParts = Array.from(new Set(parts));
  uniqueParts.push(keyPart);
  return uniqueParts.join('+');
};

const HotkeyRecorderModal = ({ currentAccelerator, onSave, onClose }) => {
  const [captured, setCaptured] = useState(null);
  const [hasModified, setHasModified] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => (
    captured || currentAccelerator || ''
  ), [captured, currentAccelerator]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.repeat) {
        return;
      }

      const accelerator = buildAccelerator(event);
      if (!accelerator) {
        setError('조합 단축키를 입력해주세요. (예: Control+Shift+J)');
        return;
      }

      setCaptured(accelerator);
      setHasModified(true);
      setError('');
    };

    const handleKeyUp = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [onClose]);

  const handleSave = () => {
    if (typeof captured === 'string' && captured.trim()) {
      onSave(captured);
      return;
    }
    if (!hasModified && currentAccelerator) {
      onSave(currentAccelerator);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="glass-surface flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-white/15 bg-slate-900/90 p-6 text-sm text-slate-100 shadow-2xl">
        <div>
          <h3 className="text-base font-semibold text-slate-50">단축키 변경</h3>
          <p className="mt-1 text-xs text-slate-300">
            원하는 단축키 조합을 입력하세요. 저장을 누르면 즉시 적용됩니다. Esc 키로 취소할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-slate-400">현재 입력</span>
          <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-mono text-base text-slate-50">
            {preview || '입력 대기 중'}
          </div>
          {error && <p className="text-xs text-rose-200">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="glass-chip rounded-full bg-white/10 px-3 py-2 text-slate-200 hover:bg-white/20"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="glass-chip rounded-full bg-emerald-500/60 px-3 py-2 text-emerald-50 hover:bg-emerald-500/80"
            disabled={!preview}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default HotkeyRecorderModal;
