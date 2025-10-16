import React from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from 'shared/utils';
import { DEFAULT_CHAT_PANEL_STYLES } from 'features/chat/constants/panelStyles';
import { ATTACHMENT_TYPES } from 'shared/constants/attachment';

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

  const renderRemoveButton = (attachment) => {
    if (typeof onRemove !== 'function') {
      return null;
    }
    return (
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs font-bold text-white transition hover:bg-black/80"
        aria-label="첨부 파일 제거"
      >
        ×
      </button>
    );
  };

  const renderImagePreview = (attachment) => (
    <div
      key={attachment.id}
      className="relative h-24 w-32 overflow-hidden rounded-lg border"
      style={{
        borderColor: resolvedPanelStyles.borderColor,
        backgroundColor: effectiveTileBackground,
      }}
    >
      {attachment.dataUrl ? (
        <img
          src={attachment.dataUrl}
          alt={attachment.label || attachment.name || '첨부 이미지'}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black/10">
          <ImageIcon className="h-6 w-6 text-white/70" />
        </div>
      )}
      {renderRemoveButton(attachment)}
    </div>
  );

  const renderPdfPreview = (attachment) => {
    const pageCountLabel = typeof attachment.pageCount === 'number' && attachment.pageCount > 0
      ? `${attachment.pageCount}쪽`
      : null;
    const previewCandidate = attachment.preview || attachment.textContent || '';
    const previewText = previewCandidate.length > 120
      ? `${previewCandidate.slice(0, 120)}…`
      : previewCandidate;
    const pdfBackground = isDarkTheme ? 'rgba(30, 41, 59, 0.85)' : 'rgba(15, 23, 42, 0.75)';
    const pdfTextColor = isDarkTheme ? 'rgba(226, 232, 240, 0.92)' : 'rgba(241, 245, 249, 0.95)';

    return (
      <div
        key={attachment.id}
        className="relative flex h-24 w-48 flex-col justify-between overflow-hidden rounded-lg border p-3 shadow-sm"
        style={{
          borderColor: resolvedPanelStyles.borderColor,
          backgroundColor: pdfBackground,
          color: pdfTextColor,
        }}
      >
        <div className="flex items-start gap-2">
          <div className="rounded-md bg-slate-800/80 p-2">
            <FileText className="h-4 w-4 text-white/90" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold">
              {attachment.label || attachment.name || '첨부 PDF'}
            </p>
            {pageCountLabel ? (
              <p className="text-xs opacity-80">{pageCountLabel}</p>
            ) : null}
          </div>
        </div>
        {previewText ? (
          <p className="mt-2 line-clamp-2 text-xs leading-tight opacity-90">
            {previewText}
          </p>
        ) : null}
        {renderRemoveButton(attachment)}
      </div>
    );
  };

  const renderAttachment = (attachment) => {
    if (attachment?.type === ATTACHMENT_TYPES.PDF) {
      return renderPdfPreview(attachment);
    }
    return renderImagePreview(attachment);
  };

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
      {attachments.map(renderAttachment)}
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
