import React, { useRef } from 'react';
import AssistantPanelHeader from 'features/tree/ui/components/node-assistant/AssistantPanelHeader';
import ChatMessageList from 'features/chat/components/ChatMessageList';

const NodeAssistantPanelView = ({
  panelRef,
  panelStyles,
  theme,
  summary,
  node,
  bootstrapMode,
  disableNavigation,
  onCloseNode,
  onPanZoomGesture,
  registerMessageContainer,
  messages,
  handleRetryMessage,
  handleCopyMessage,
  spinningMap = {},
  attachments = [],
  onAttachmentRemove = () => {},
  onClearAttachments = () => {},
  onAttachmentFiles = () => {},
  isAttachmentUploading = false,
  handleHighlightToggle,
  isHighlightMode,
  placeholderNotice,
  composerRef,
  composerValue,
  onComposerChange,
  onComposerPaste,
  handleKeyDown,
  handleCompositionStart,
  handleCompositionEnd,
  handleFormSubmit,
  handleSendClick,
  panelWheelHandler,
  isSendDisabled,
  showHeaderControls = true,
}) => {
  const fileInputRef = useRef(null);

  const handleAttachmentButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentInputChange = (event) => {
    const { files } = event.target;
    if (files && files.length > 0) {
      onAttachmentFiles(files);
    }
    event.target.value = '';
  };

  return (
  <div
    ref={panelRef}
    className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden rounded-2xl p-6 backdrop-blur-3xl"
    style={{
      fontFamily: '"Spoqa Han Sans Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      zIndex: 1001,
      pointerEvents: 'auto',
      WebkitAppRegion: 'no-drag',
      background: panelStyles.background,
      borderColor: panelStyles.borderColor,
      borderWidth: '1px',
      borderStyle: 'solid',
      color: panelStyles.textColor,
    }}
    data-interactive-zone="true"
    onWheelCapture={panelWheelHandler}
  >
    <AssistantPanelHeader
      summaryLabel={summary.label}
      keyword={node.keyword}
      nodeId={node.id}
      disableNavigation={disableNavigation}
      panelStyles={panelStyles}
      theme={theme}
      bootstrapMode={bootstrapMode}
      onClose={onCloseNode}
      onPanZoomGesture={onPanZoomGesture}
      showCloseButton={showHeaderControls}
    />

    <ChatMessageList
      title="Assistant"
      messages={messages}
      onRetry={handleRetryMessage}
      onCopy={handleCopyMessage}
      panelStyles={panelStyles}
      theme={theme}
      className="flex-1 min-h-0 pr-1 h-full"
      onContainerRef={registerMessageContainer}
      assistantMessageMaxWidth={560}
      userBubbleMaxWidth={280}
      retryingMessageMap={spinningMap}
    />

    {Array.isArray(attachments) && attachments.length > 0 ? (
      <div
        className="flex w-full flex-wrap gap-3 rounded-xl border px-3 py-3"
        style={{
          pointerEvents: 'auto',
          borderColor: panelStyles.borderColor,
          backgroundColor: theme === 'dark'
            ? 'rgba(37, 38, 48, 0.75)'
            : 'rgba(255, 255, 255, 0.85)',
        }}
        data-block-pan="true"
      >
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="relative h-24 w-32 overflow-hidden rounded-lg border"
            style={{
              borderColor: panelStyles.borderColor,
              backgroundColor: 'rgba(15, 23, 42, 0.35)'
            }}
          >
            <img
              src={attachment.dataUrl}
              alt={attachment.label || attachment.name || '첨부 이미지'}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onAttachmentRemove(attachment.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs font-bold text-white transition hover:bg-black/80"
              aria-label="첨부 이미지 제거"
            >
              ×
            </button>
          </div>
        ))}
        {attachments.length > 1 ? (
          <button
            type="button"
            onClick={onClearAttachments}
            className="flex h-10 items-center justify-center rounded-lg border border-dashed px-3 text-[11px] font-medium transition hover:bg-white/10"
            style={{
              borderColor: panelStyles.borderColor,
              color: panelStyles.textColor,
            }}
          >
            전체 제거
          </button>
        ) : null}
      </div>
    ) : null}

    <div
      className="flex -mb-2 flex-shrink-0 justify-start"
      data-block-pan="true"
      style={{ position: 'relative', zIndex: 2 }}
    >
      <button
        type="button"
        onClick={handleHighlightToggle}
        aria-pressed={isHighlightMode}
        aria-label="하이라이트 모드"
        className={`px-3 py-1 rounded-xl border text-xs font-medium transition-all duration-200 ${isHighlightMode
          ? 'bg-emerald-500/60 text-emerald-100 border-emerald-400/60'
          : 'hover:bg-white/20'
        }`}
        style={{
          backgroundColor: isHighlightMode
            ? 'rgba(16, 185, 129, 0.6)'
            : theme === 'dark'
              ? 'rgba(64, 65, 79, 0.8)'
              : 'rgba(255, 255, 255, 0.8)',
          borderColor: isHighlightMode
            ? 'rgba(16, 185, 129, 0.6)'
            : panelStyles.borderColor,
          borderWidth: '1px',
          borderStyle: 'solid',
          color: panelStyles.textColor,
        }}
      >
        다중 질문
      </button>
    </div>

    <form
      className="glass-surface flex flex-shrink-0 items-end gap-3 rounded-xl border px-3 py-2"
      onSubmit={handleFormSubmit}
      style={{
        pointerEvents: 'auto',
        zIndex: 1002,
        backgroundColor: theme === 'dark'
          ? 'rgba(64, 65, 79, 0.8)'
          : 'rgba(255, 255, 255, 0.8)',
        borderColor: panelStyles.borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <div className="flex w-full items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleAttachmentInputChange}
        />
        <button
          type="button"
          onClick={handleAttachmentButtonClick}
          disabled={isAttachmentUploading}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-sm shadow-sm transition disabled:opacity-50"
          aria-label="이미지 첨부"
          style={{
            borderColor: panelStyles.borderColor,
            color: panelStyles.textColor,
            backgroundColor: theme === 'dark'
              ? 'rgba(30, 31, 45, 0.85)'
              : 'rgba(255, 255, 255, 0.95)',
          }}
        >
          {isAttachmentUploading ? '…' : '📎'}
        </button>
        <textarea
          ref={composerRef}
          value={composerValue}
          onChange={onComposerChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={onComposerPaste}
          placeholder="Ask anything..."
          data-node-assistant-composer="true"
          className={`max-h-24 min-h-[40px] flex-1 resize-none border-none bg-transparent text-sm focus:outline-none ${
            theme === 'dark'
              ? 'placeholder:text-gray-400'
              : 'placeholder:text-gray-500'
          }`}
          style={{
            pointerEvents: 'auto',
            color: panelStyles.textColor,
            fontFamily: 'inherit',
            outline: 'none',
            border: 'none',
            resize: 'none',
          }}
          autoFocus={false}
          autoComplete="off"
          spellCheck="false"
        />
      </div>
      {placeholderNotice && (
        <span
          className={`text-xs whitespace-nowrap ${
            placeholderNotice.type === 'success' 
              ? (theme === 'dark' ? 'text-emerald-200' : 'text-emerald-600')
              : (theme === 'dark' ? 'text-amber-200' : 'text-amber-600')
          }`}
        >
          {placeholderNotice.message}
        </span>
      )}
      <button
        type="submit"
        disabled={isSendDisabled}
        className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-opacity disabled:opacity-40"
        aria-label="메시지 전송"
        style={{
          pointerEvents: 'auto',
          backgroundColor: theme === 'dark'
            ? 'rgba(64, 65, 79, 0.9)'
            : 'rgba(255, 255, 255, 0.8)',
          color: panelStyles.textColor,
          border: `1px solid ${panelStyles.borderColor}`,
        }}
        onClick={handleSendClick}
      >
        ↗
      </button>
    </form>
  </div>
  );
};

export default NodeAssistantPanelView;
