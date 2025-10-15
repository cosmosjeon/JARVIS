import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AssistantPanelHeader from 'features/tree/ui/components/node-assistant/AssistantPanelHeader';
import ChatAttachmentPreviewList from 'features/chat/components/ChatAttachmentPreviewList';
import ChatMessageList from 'features/chat/components/ChatMessageList';
import ProviderDropdown from 'features/chat/components/ProviderDropdown';
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
import { Paperclip } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'shared/ui/tooltip';

const MODEL_LABELS = {
  'gpt-5': 'GPT-5',
  'gpt-5-mini': 'GPT-5 mini',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-3-5-haiku-latest': 'Claude 3.5 Haiku',
};

const formatModelLabel = (value) => {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  const mapped = MODEL_LABELS[value] || MODEL_LABELS[normalized];
  if (mapped) {
    return mapped;
  }
  if (normalized.startsWith('gpt-5')) return 'GPT-5';
  if (normalized.includes('gemini')) return 'Gemini';
  if (normalized.includes('claude')) return 'Claude';
  return value;
};

const formatProviderLabel = (value) => {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'openai') return 'GPT';
  if (normalized === 'gemini') return 'Gemini';
  if (normalized === 'claude') return 'Claude';
  return value.replace(/^\w/, (char) => char.toUpperCase());
};

const NodeAssistantPanelView = ({
  panelRef,
  panelStyles,
  theme,
  summary,
  node,
  bootstrapMode,
  isBootstrapCompact = false,
  disableNavigation,
  onCloseNode,
  onPanZoomGesture,
  registerMessageContainer,
  messages,
  handleRetryMessage,
  handleRetryWithModel,
  handleCopyMessage,
  availableModels = [],
  spinningMap = {},
  attachments = [],
  onAttachmentRemove = () => { },
  onClearAttachments = () => { },
  onAttachmentFiles = () => { },
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
  selectedProvider,
  selectedModel,
  modelOptions,
  setSelectedModel,
  autoSelectionPreview,
  lastAutoSelection,
  onDropdownOpenChange,
  onTextareaHeightChange,
}) => {
  const fileInputRef = useRef(null);
  const [slowResponseNotice, setSlowResponseNotice] = useState(null);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const textareaContainerRef = useRef(null);

  const handleProviderDropdownOpenChange = useCallback((open) => {
    setIsProviderDropdownOpen(open);
    // 컴팩트 모드일 때만 부모로 상태 전달
    if (isBootstrapCompact && onDropdownOpenChange) {
      onDropdownOpenChange(open);
    }
  }, [isBootstrapCompact, onDropdownOpenChange]);

  // Textarea 높이 변화 감지 (컴팩트 모드에서만 - 최적화)
  useEffect(() => {
    if (!isBootstrapCompact || !textareaContainerRef.current || !onTextareaHeightChange) {
      return;
    }

    const container = textareaContainerRef.current;
    let rafId = null;
    let lastHeight = 0;
    let isInitialMount = true;
    
    const observer = new ResizeObserver((entries) => {
      // RAF로 성능 최적화
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          
          // 초기 마운트 시에는 무시 (깜빡임 방지)
          if (isInitialMount) {
            lastHeight = height;
            isInitialMount = false;
            return;
          }
          
          // 높이가 실제로 변경되었을 때만 콜백 호출
          if (Math.abs(height - lastHeight) > 2) {
            lastHeight = height;
            onTextareaHeightChange(height);
          }
        }
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isBootstrapCompact, onTextareaHeightChange]);

  const resolvedPanelStyles = useMemo(
    () => ({
      ...DEFAULT_CHAT_PANEL_STYLES,
      ...(panelStyles || {}),
    }),
    [panelStyles],
  );

  const subtleTextColor = resolvedPanelStyles.subtleTextColor;
  const isDarkTheme = theme === 'dark';
  const isGlassTheme = theme === 'glass';
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
      className={cn(
        "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden backdrop-blur-3xl",
        isBootstrapCompact ? "gap-0 p-0 rounded-none" : "gap-3 p-6 rounded-2xl"
      )}
      style={{
        fontFamily: '"Spoqa Han Sans Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        zIndex: 1001,
        pointerEvents: 'auto',
        WebkitAppRegion: isBootstrapCompact ? undefined : 'no-drag',
        background: isBootstrapCompact ? 'transparent' : resolvedPanelStyles.background,
        borderColor: isBootstrapCompact ? 'transparent' : resolvedPanelStyles.borderColor,
        borderWidth: isBootstrapCompact ? '0' : '1px',
        borderStyle: 'solid',
        color: resolvedPanelStyles.textColor,
      }}
      data-interactive-zone="true"
      onWheelCapture={panelWheelHandler}
      {...attachmentDropHandlers}
    >
      {!isBootstrapCompact && (
        <>
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
            onRetryWithModel={handleRetryWithModel}
            onCopy={handleCopyMessage}
            availableModels={availableModels}
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
        </>
      )}

      {slowResponseNotice && (
        <div className="rounded-lg border border-amber-200/60 bg-amber-50/90 px-3 py-2 text-xs text-amber-700 shadow-sm">
          {slowResponseNotice}
        </div>
      )}

      <PromptInput
        onSubmit={handleFormSubmit}
        isBootstrapCompact={isBootstrapCompact}
        className={cn(
          'relative flex-col items-stretch gap-2 transition-colors',
          isAttachmentDragOver && 'border-dashed border-primary/60 bg-primary/10 ring-1 ring-primary/30',
          isBootstrapCompact && 'flex-1'
        )}
        style={{ 
          zIndex: 1003, 
          pointerEvents: 'auto',
          ...(isBootstrapCompact && { paddingTop: '25px' })
        }}
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

        <PromptInputToolbar className="flex items-center justify-between px-1 gap-2">
          <div className="flex items-center gap-2">
            <ProviderDropdown
              options={modelOptions}
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={isAttachmentUploading || isStreaming}
              align="start"
              onOpenChange={handleProviderDropdownOpenChange}
            />
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-2 relative z-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative z-10">
                      <PromptInputButton
                        onClick={handleAttachmentButtonClick}
                        disabled={isAttachmentUploading || isStreaming}
                        variant="ghost"
                        className="rounded-full p-2 text-muted-foreground hover:text-foreground relative z-10 transition-all duration-200"
                        aria-label="이미지 첨부"
                      >
                        <Paperclip className="h-4 w-4" />
                      </PromptInputButton>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>파일첨부</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </PromptInputToolbar>

        <div ref={textareaContainerRef} className="flex w-full items-end gap-2">
          <PromptInputTextarea
            ref={composerRef}
            value={composerValue}
            onChange={onComposerChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onPaste={onComposerPaste}
            placeholder={isBootstrapCompact ? "질문을 입력하세요... (Enter로 전송)" : "질문을 입력하세요... (Enter로 전송)"}
            autoComplete="off"
            autoFocus={false}
            spellCheck={false}
            data-node-assistant-composer="true"
            isBootstrapCompact={isBootstrapCompact}
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
