import React from 'react';

const VoranKeyboardGuide = () => (
  <div className="pointer-events-none absolute bottom-6 right-6 z-[103] text-xs text-muted-foreground">
    <div className="pointer-events-auto flex flex-col gap-2 rounded-md border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-border rounded text-xs">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-border rounded text-xs">→</kbd>
          <span className="text-muted-foreground/80">폴더 이동</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-border rounded text-xs">↑</kbd>
          <kbd className="px-1.5 py-0.5 bg-border rounded text-xs">↓</kbd>
          <span className="text-muted-foreground/80">트리 선택</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-border rounded text-xs">Tab</kbd>
          <span className="text-muted-foreground/80">폴더 순환</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-border rounded text-xs">Enter</kbd>
          <span className="text-muted-foreground/80">드래그 없이 저장</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-border rounded text-xs">Esc</kbd>
          <span className="text-muted-foreground/80">닫기</span>
        </span>
        <span className="text-muted-foreground/80">드래그로 이동/정렬</span>
      </div>
    </div>
  </div>
);

export default VoranKeyboardGuide;
