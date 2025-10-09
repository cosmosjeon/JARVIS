import React from 'react';
import { cn } from 'shared/utils';
import { DEFAULT_CHAT_PANEL_STYLES } from 'features/chat/constants/panelStyles';

const DEFAULT_CONTAINER_BG = {
  light: 'rgba(255, 255, 255, 0.85)',
  dark: 'rgba(55, 55, 55, 0.85)',
};

const DEFAULT_TILE_BG = {
  light: 'rgba(15, 23, 42, 0.35)',
  dark: 'rgba(65, 65, 65, 0.75)',
};

const ChatAttachmentPreviewList = ({
  attachments = [],
  onRemove,
  onClear,
  clearLabel = '전체 제거',
  panelStyles,
  isDarkTheme = false,
  className,
  containerBackground,
  tileBackground,
}) => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  const resolvedPanelStyles = {
    ...DEFAULT_CHAT_PANEL_STYLES,
    ...(panelStyles || {}),
  };

  const effectiveContainerBackground = containerBackground
    ?? (isDarkTheme ? DEFAULT_CONTAINER_BG.dark : DEFAULT_CONTAINER_BG.light);

  const effectiveTileBackground = tileBackground
    ?? (isDarkTheme ? DEFAULT_TILE_BG.dark : DEFAULT_TILE_BG.light);

  return (
    <div
      className={cn('flex w-full flex-wrap gap-3 rounded-xl border px-3 py-3', className)}
      style={{
        pointerEvents: 'auto',
        borderColor: resolvedPanelStyles.borderColor,
        backgroundColor: effectiveContainerBackground,
      }}
      data-block-pan="true"
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="relative h-24 w-32 overflow-hidden rounded-lg border"
          style={{
            borderColor: resolvedPanelStyles.borderColor,
            backgroundColor: effectiveTileBackground,
          }}
        >
          <img
            src={attachment.dataUrl}
            alt={attachment.label || attachment.name || '첨부 이미지'}
            className="h-full w-full object-cover"
          />
          {typeof onRemove === 'function' ? (
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs font-bold text-white transition hover:bg-black/80"
              aria-label="첨부 이미지 제거"
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      {attachments.length > 1 && typeof onClear === 'function' ? (
        <button
          type="button"
          onClick={onClear}
          className="flex h-10 items-center justify-center rounded-lg border border-dashed px-3 text-[11px] font-medium transition hover:bg-white/40"
          style={{
            borderColor: resolvedPanelStyles.borderColor,
            color: resolvedPanelStyles.textColor,
          }}
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
};

export default ChatAttachmentPreviewList;
