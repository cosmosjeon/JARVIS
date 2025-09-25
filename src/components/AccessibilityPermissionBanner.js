import React from 'react';
import { useSettings } from '../hooks/SettingsContext';

const AccessibilityPermissionBanner = () => {
  const { accessibilityGranted, requestAccessibility, refreshAccessibilityStatus } = useSettings();

  if (accessibilityGranted === null || accessibilityGranted) {
    return null;
  }

  return (
    <div className="glass-surface flex items-center justify-between gap-3 rounded-3xl border border-rose-400/40 bg-rose-500/30 px-4 py-3 text-sm text-rose-50 shadow-2xl">
      <div>
        <p className="font-semibold">macOS 접근성 권한이 필요합니다</p>
        <p className="text-xs text-rose-100/90">
          설정 &rsaquo; 보안 및 개인 정보 보호 &rsaquo; 접근성에서 JARVIS를 허용한 뒤, 다시 시도해 주세요.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={refreshAccessibilityStatus}
          className="glass-chip rounded-full bg-white/20 px-3 py-1 text-xs text-rose-50 hover:bg-white/30"
        >
          상태 새로고침
        </button>
        <button
          type="button"
          onClick={requestAccessibility}
          className="glass-chip rounded-full bg-rose-400/60 px-3 py-1 text-xs text-white hover:bg-rose-400/80"
        >
          권한 요청
        </button>
      </div>
    </div>
  );
};

export default AccessibilityPermissionBanner;
