import React, { useEffect, useMemo, useRef, useState } from 'react';
import AssistantPanelHeader from 'features/tree/ui/components/node-assistant/AssistantPanelHeader';
import ChatAttachmentPreviewList from 'features/chat/components/ChatAttachmentPreviewList';
import ChatMessageList from 'features/chat/components/ChatMessageList';
import ProviderDropdown from 'features/chat/components/ProviderDropdown';
import { useAIModelPreference } from 'shared/hooks/useAIModelPreference';
import { useFileDropZone } from 'shared/hooks/useFileDropZone';
import { ChatStatus } from 'features/chat/models/message';
import { DEFAULT_CHAT_PANEL_STYLES } from 'features/chat/constants/panelStyles';
import {
  PromptInput,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from 'shared/ui/shadcn-io/ai/prompt-input';
import { AttachmentDropOverlay } from 'shared/ui/AttachmentDropOverlay';
import { cn } from 'shared/utils';
import {
  DEFAULT_AGENT_RESPONSE_TIMEOUT_MS,
  LONG_RESPONSE_NOTICE_DELAY_MS,
  LONG_RESPONSE_REMINDER_DELAY_MS,
} from 'shared/constants/agentTimeouts';
import { Globe, Paperclip } from 'lucide-react';

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
  const {
    provider: selectedProvider,
    providerOptions,
    setProvider: setSelectedProvider,
    webSearchEnabled,
    setWebSearchEnabled,
  } = useAIModelPreference();
  const [slowResponseNotice, setSlowResponseNotice] = useState(null);

  const resolvedPanelStyles = useMemo(
    () => ({
      ...DEFAULT_CHAT_PANEL_STYLES,
      ...(panelStyles || {}),
    }),
    [panelStyles],
  );

  const subtleTextColor = resolvedPanelStyles.subtleTextColor;
  const isDarkTheme = theme === 'dark';
  const isStreaming = useMemo(
    () => messages.some((message) => {
      const status = message?.status;
      return status === ChatStatus.Pending || status === ChatStatus.Typing;
    }),
    [messages],
  );

  useEffect(() => {
    if (!isStreaming) {
      setSlowResponseNotice(null);
      return undefined;
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    const timers = [];
    timers.push(
      window.setTimeout(
        () => setSlowResponseNotice('AI가 답변을 정리 중입니다. 잠시만 기다려 주세요.'),
        LONG_RESPONSE_NOTICE_DELAY_MS,
      ),
    );

    if (LONG_RESPONSE_REMINDER_DELAY_MS > LONG_RESPONSE_NOTICE_DELAY_MS) {
      timers.push(
        window.setTimeout(
          () => setSlowResponseNotice(`아직 계산 중이에요. 최대 ${Math.ceil(DEFAULT_AGENT_RESPONSE_TIMEOUT_MS / 60000)}분까지 걸릴 수 있습니다.`),
          LONG_RESPONSE_REMINDER_DELAY_MS,
        ),
      );
    }

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [isStreaming]);

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

  const {
    isDragOver: isAttachmentDragOver,
    eventHandlers: attachmentDropHandlers,
  } = useFileDropZone({
    onDropFiles: onAttachmentFiles,
    isDisabled: isAttachmentUploading || isStreaming,
  });

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
        background: resolvedPanelStyles.background,
        borderColor: resolvedPanelStyles.borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
        color: resolvedPanelStyles.textColor,
      }}
      data-interactive-zone="true"
      onWheelCapture={panelWheelHandler}
      {...attachmentDropHandlers}
    >
    <AssistantPanelHeader
      summaryLabel={summary.label}
      keyword={node.keyword}
      nodeId={node.id}
      disableNavigation={disableNavigation}
      panelStyles={resolvedPanelStyles}
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
      panelStyles={resolvedPanelStyles}
      theme={theme}
      className="glass-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
      onContainerRef={registerMessageContainer}
      assistantMessageMaxWidth={560}
      userBubbleMaxWidth={280}
      retryingMessageMap={spinningMap}
      isScrollable={false}
    />

    <ChatAttachmentPreviewList
      attachments={attachments}
      onRemove={onAttachmentRemove}
      onClear={onClearAttachments}
      panelStyles={resolvedPanelStyles}
      isDarkTheme={isDarkTheme}
    />

    {slowResponseNotice && (
      <div className="rounded-lg border border-amber-200/60 bg-amber-50/90 px-3 py-2 text-xs text-amber-700 shadow-sm">
        {slowResponseNotice}
      </div>
    )}

    <div
      className="flex -mb-2 flex-shrink-0 flex-wrap items-center gap-2"
      data-block-pan="true"
      style={{
        position: 'relative',
        zIndex: 1002,
        pointerEvents: 'auto',
        width: '100%',
      }}
    >
      <button
        type="button"
        onClick={handleHighlightToggle}
        aria-pressed={isHighlightMode}
        aria-label="하이라이트 모드"
        className="rounded-xl border px-3 py-1 text-xs font-medium transition-all duration-200"
        style={{
          cursor: 'pointer',
          pointerEvents: 'auto',
          backgroundColor: isHighlightMode
            ? 'rgba(16, 185, 129, 0.6)'
            : isDarkTheme
              ? 'rgba(65, 65, 65, 0.8)'
              : 'rgba(255, 255, 255, 0.8)',
          borderColor: isHighlightMode
            ? 'rgba(16, 185, 129, 0.6)'
            : resolvedPanelStyles.borderColor,
          borderWidth: '1px',
          borderStyle: 'solid',
          color: resolvedPanelStyles.textColor,
        }}
      >
        다중 질문
      </button>
      {placeholderNotice ? (
        <div
          className={cn(
            'rounded px-2 py-1 text-xs transition-colors',
            placeholderNotice.type === 'success' && 'bg-emerald-500/10',
            placeholderNotice.type === 'warning' && 'bg-amber-500/10',
            placeholderNotice.type === 'info' && 'bg-black/10',
          )}
          style={{
            color: placeholderNotice.type === 'warning'
              ? (isDarkTheme ? 'rgba(253, 230, 138, 0.95)' : 'rgba(217, 119, 6, 0.9)')
              : placeholderNotice.type === 'success'
                ? (isDarkTheme ? 'rgba(110, 231, 183, 0.9)' : 'rgba(5, 122, 85, 0.9)')
                : subtleTextColor,
          }}
        >
          {placeholderNotice.message}
        </div>
      ) : null}
    </div>

    <PromptInput
      onSubmit={handleFormSubmit}
      className={cn(
        'relative flex-col items-stretch gap-2 transition-colors',
        isAttachmentDragOver && 'border-dashed border-primary/60 bg-primary/10 ring-1 ring-primary/30',
      )}
      style={{ zIndex: 1003, pointerEvents: 'auto' }}
      {...attachmentDropHandlers}
    >
      {isAttachmentDragOver ? <AttachmentDropOverlay /> : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleAttachmentInputChange}
      />

      <PromptInputToolbar className="flex items-center justify-between px-1">
        <ProviderDropdown
          options={providerOptions}
          value={selectedProvider}
          onChange={setSelectedProvider}
          disabled={isAttachmentUploading || isStreaming}
          align="start"
        />
        <div className="flex items-center gap-1">
          <PromptInputButton
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            variant={webSearchEnabled ? 'secondary' : 'ghost'}
            disabled={isAttachmentUploading || isStreaming}
            className={cn(
              'rounded-full px-2',
              webSearchEnabled ? 'text-foreground' : 'text-muted-foreground',
            )}
            aria-label="웹 검색 토글"
          >
            <Globe className="h-4 w-4" />
          </PromptInputButton>
          <PromptInputButton
            onClick={handleAttachmentButtonClick}
            disabled={isAttachmentUploading || isStreaming}
            variant="ghost"
            aria-label="이미지 첨부"
          >
            <Paperclip className="h-4 w-4" />
          </PromptInputButton>
        </div>
      </PromptInputToolbar>

      <div className="flex w-full items-end gap-2">
        <PromptInputTextarea
          ref={composerRef}
          value={composerValue}
          onChange={onComposerChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={onComposerPaste}
          placeholder="Ask anything..."
          autoComplete="off"
          autoFocus={false}
          spellCheck={false}
          data-node-assistant-composer="true"
        />
        <PromptInputSubmit
          disabled={isSendDisabled}
          status={isStreaming ? 'streaming' : 'ready'}
          onClick={handleSendClick}
          aria-label="메시지 전송"
        />
      </div>
    </PromptInput>
  </div>
  );
};

export default NodeAssistantPanelView;
