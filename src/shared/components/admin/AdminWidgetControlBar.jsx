import React from 'react';
import { Camera, GripVertical } from 'lucide-react';
import clsx from 'clsx';

const AdminWidgetControlBar = ({
  logoSrc,
  onLogoClick,
  onCreateClick,
  creating,
  onCaptureClick,
  capturing = false,
}) => (
  <div className="flex h-12 items-center gap-2 rounded-full bg-slate-900/80 px-3 py-2 ring-1 ring-slate-800/50 backdrop-blur-xl">
    <button
      type="button"
      onClick={onLogoClick}
      className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/70"
      style={{
        WebkitAppRegion: 'no-drag',
        boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
      }}
    >
      <img src={logoSrc} alt="Voran" className="h-6 w-6" draggable={false} />
    </button>

    <button
      type="button"
      onClick={onCreateClick}
      disabled={creating}
      className={clsx(
        'flex h-8 items-center justify-center rounded-full px-4 text-xs font-semibold tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        creating
          ? 'bg-sky-600/60 text-slate-200'
          : 'bg-[#1f8ab5] text-white hover:bg-[#2ba5d3] active:bg-[#1978a0]'
      )}
      style={{
        WebkitAppRegion: 'no-drag',
        boxShadow: creating
          ? '2px 2px 4px rgba(0, 0, 0, 0.2), -2px -2px 4px rgba(255, 255, 255, 0.05)'
          : '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
      }}
    >
      NEW
    </button>

    <button
      type="button"
      onClick={onCaptureClick}
      disabled={capturing}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2937] text-slate-200 transition hover:bg-[#27303f] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-40"
      style={{
        WebkitAppRegion: 'no-drag',
        boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
      }}
      title="화면 캡처"
      aria-label="화면 캡처"
    >
      <Camera className="h-4 w-4" />
    </button>

    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2d2f36] text-slate-400 transition hover:bg-[#3a3d45] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/70"
      style={{
        WebkitAppRegion: 'drag',
        boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.1)'
      }}
      title="위젯 이동"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  </div>
);

export default AdminWidgetControlBar;
