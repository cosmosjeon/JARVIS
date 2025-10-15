import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy as CopyIcon, RefreshCcw as RefreshCcwIcon, ChevronDown } from 'lucide-react';
import { Actions, Action } from 'shared/ui/shadcn-io/ai/actions';
import { Response } from 'shared/ui/shadcn-io/ai/response';
import { cn } from 'shared/utils';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  ThinkingIndicator,
} from 'shared/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'shared/ui/dropdown-menu';
import {
  DEFAULT_CHAT_PANEL_STYLES,
  DEFAULT_CHAT_THEME,
  isLightLikeChatTheme,
} from 'features/chat/constants/panelStyles';

const USER_ROLE = 'user';
const SYSTEM_ROLE = 'system';

const getMessageKey = (message, fallback) => {
  const rawId = message?.id;
  if (typeof rawId === 'string') {
    return rawId.trim() ? rawId : fallback;
  }
  if (typeof rawId === 'number') {
    return String(rawId);
  }
  return fallback;
};

const renderAttachments = (attachments = [], theme, panelStyles) => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  const backgroundColor = theme === 'dark'
    ? 'rgba(37, 38, 48, 0.75)'
    : 'rgba(241, 245, 249, 0.85)';

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="relative h-24 w-32 overflow-hidden rounded-lg border"
          style={{
            borderColor: panelStyles.borderColor,
            backgroundColor,
          }}
        >
          {attachment.dataUrl ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.label || '첨부 이미지'}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
};



const renderReasoning = (reasoning, status) => {
  if (!reasoning) {
    return null;
  }
  const summaries = Array.isArray(reasoning.summary) ? reasoning.summary.filter(Boolean) : [];
  const details = Array.isArray(reasoning.details) ? reasoning.details.filter(Boolean) : [];

  if (!summaries.length && !details.length) {
    return null;
  }

  return (
    <Reasoning className="mt-3" isStreaming={status === 'typing'}>
      <ReasoningTrigger />
      <ReasoningContent>
        {summaries.map((text, index) => (
          <p
            key={`reasoning-summary-${index}`}
            className="whitespace-pre-wrap text-sm leading-6 text-foreground/80"
          >
            {text}
          </p>
        ))}
        {details.length ? (
          <ChainOfThought className="mt-3" defaultOpen={false}>
            <ChainOfThoughtHeader>Chain of Thought</ChainOfThoughtHeader>
            <ChainOfThoughtContent>
              {details.map((detail, index) => (
                <ChainOfThoughtStep
                  key={`reasoning-step-${index}`}
                  status="complete"
                  label={`Step ${index + 1}`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {detail}
                  </p>
                </ChainOfThoughtStep>
              ))}
            </ChainOfThoughtContent>
          </ChainOfThought>
        ) : null}
        {typeof reasoning.tokens === 'number' ? (
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            Reasoning tokens · {reasoning.tokens}
          </p>
        ) : null}
      </ReasoningContent>
    </Reasoning>
  );
};


export default function ChatMessageList({
  title = 'Assistant',
  messages = [],
  endRef,
  onRetry,
  onCopy,
  onRetryWithModel,
  availableModels = [],
  theme = DEFAULT_CHAT_THEME,
  panelStyles = DEFAULT_CHAT_PANEL_STYLES,
  className,
  onContainerRef,
  userBubbleMaxWidth = 320,
  assistantMessageMaxWidth = 560,
  retryingMessageMap,
  isScrollable = true,
}) {
  const [internalCopiedMap, setInternalCopiedMap] = useState({});
  const [internalSpinningMap, setInternalSpinningMap] = useState({});
  const [openDropdowns, setOpenDropdowns] = useState({});
  const scrollContainerRef = useRef(null);

  const resolvedPanelStyles = useMemo(
    () => ({ ...DEFAULT_CHAT_PANEL_STYLES, ...(panelStyles || {}) }),
    [panelStyles],
  );
  const resolvedTheme = theme || DEFAULT_CHAT_THEME;
  const isLightTheme = isLightLikeChatTheme(resolvedTheme);
  const isTyping = useMemo(
    () => messages.some((message) => message.status === 'typing' || message.status === 'pending'),
    [messages],
  );

  useEffect(() => {
    if (typeof onContainerRef === 'function') {
      const element = scrollContainerRef.current;
      console.debug('[ChatMessageList] register container', {
        element,
        isScrollable,
      });
      onContainerRef(element);
      return () => {
        console.debug('[ChatMessageList] unregister container', {
          element,
        });
        onContainerRef(null);
      };
    }
    return undefined;
  }, [onContainerRef]);

  useEffect(() => {
    if (!isScrollable) {
      return;
    }
    if (isTyping && scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [isScrollable, isTyping, messages]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdowns = document.querySelectorAll('[data-dropdown]');
      let clickedInside = false;
      
      dropdowns.forEach(dropdown => {
        if (dropdown.contains(event.target)) {
          clickedInside = true;
        }
      });
      
      if (!clickedInside) {
        setOpenDropdowns({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const hasExternalRetryingState = Boolean(retryingMessageMap);
  const activeSpinningMap = hasExternalRetryingState ? retryingMessageMap : internalSpinningMap;

  const handleRetryClick = (messageId, message) => {
    if (!messageId) {
      return;
    }
    if (!hasExternalRetryingState) {
      setInternalSpinningMap((prev) => ({ ...prev, [messageId]: true }));
    }
    try {
      onRetry?.(message);
    } finally {
      if (!hasExternalRetryingState) {
        window.setTimeout(() => {
          setInternalSpinningMap((prev) => ({ ...prev, [messageId]: false }));
        }, 900);
      }
    }
  };

  const handleCopyClick = (messageId, message) => {
    if (!messageId) {
      return;
    }
    onCopy?.(message);
    setInternalCopiedMap((prev) => ({ ...prev, [messageId]: true }));
    window.setTimeout(() => {
      setInternalCopiedMap((prev) => ({ ...prev, [messageId]: false }));
    }, 1600);
  };

  const toggleDropdown = (messageId) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const closeDropdown = (messageId) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [messageId]: false
    }));
  };

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'flex w-full flex-col gap-6',
        isScrollable && 'glass-scrollbar h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden',
        className,
      )}
      aria-live="polite"
      role="log"
      data-testid="chat-message-list"
      data-assistant-name={title}
      style={{ userSelect: 'text', position: 'relative', zIndex: 0 }}
    >
      {messages.map((message, index) => {
        const key = getMessageKey(message, `message-${index}`);
        const status = message?.status || 'complete';
        const role = message?.role || 'assistant';

        if (role === SYSTEM_ROLE) {
          return (
            <div key={key} className="flex justify-center" data-role="system" data-status={status}>
              <div
                className="max-w-[480px] rounded-xl border px-4 py-2 text-xs font-medium backdrop-blur-sm"
                style={{
                  backgroundColor: isLightTheme
                    ? 'rgba(148, 163, 184, 0.16)'
                    : 'rgba(30, 31, 45, 0.65)',
                  borderColor: resolvedPanelStyles.borderColor,
                  color: resolvedPanelStyles.subtleTextColor,
                }}
              >
                {message.text}
              </div>
            </div>
          );
        }

        if (role === USER_ROLE) {
          const hasText = Boolean(message?.text);
          const attachmentsNode = renderAttachments(
            message.attachments,
            resolvedTheme,
            resolvedPanelStyles,
          );

          return (
            <div key={key} className="flex justify-end" data-role="user" data-status={status}>
              <div
                className="break-words rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm"
                style={{
                  maxWidth: userBubbleMaxWidth,
                  backgroundColor: isLightTheme
                    ? 'rgba(0, 0, 0, 0.05)'
                    : 'rgba(255, 255, 255, 0.08)',
                  borderColor: resolvedPanelStyles.borderColor,
                  color: resolvedPanelStyles.textColor,
                }}
              >
                {hasText ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                ) : null}
                {attachmentsNode}
              </div>
            </div>
          );
        }

        const showActions = Boolean((onRetry || onCopy) && role !== SYSTEM_ROLE);
        const attachmentsNode = renderAttachments(
          message.attachments,
          resolvedTheme,
          resolvedPanelStyles,
        );
        const isAssistantPending = status === 'pending' || status === 'typing';
        const shouldShowThinking = isAssistantPending && (!message.text || message.text.trim().length === 0);
        const reasoningNode = renderReasoning(message.reasoning, status);

        return (
          <div key={key} className="flex justify-start" data-role="assistant" data-status={status}>
            <div className="w-full" style={{ maxWidth: assistantMessageMaxWidth }}>
              {shouldShowThinking ? (
                <ThinkingIndicator modelInfo={message.modelInfo} />
              ) : message.text ? (
                <div className="w-full">
                  <Response
                    className="w-full text-base leading-7"
                    style={{ color: resolvedPanelStyles.textColor }}
                  >
                    {message.text}
                  </Response>
                  {showActions && (
                    <Actions className="mt-1 relative z-10">
                  {(onRetry || onRetryWithModel) && (
                    <div className="relative" data-dropdown>
                      <Action
                        tooltip="다른 모델로 재생성"
                        label="Retry"
                        className="relative"
                        onClick={() => toggleDropdown(key)}
                      >
                        <RefreshCcwIcon className={`h-4 w-4 ${activeSpinningMap?.[key] ? 'animate-spin' : ''}`} />
                        <ChevronDown className="h-3 w-3 ml-0.5" />
                      </Action>
                      {availableModels.length > 0 && openDropdowns[key] && (
                        <div className="absolute top-8 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[99999] min-w-[160px]">
                          {availableModels.map((model) => (
                            <button
                              key={model.id}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md last:rounded-b-md disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => {
                                onRetryWithModel?.(message, model.id);
                                closeDropdown(key);
                              }}
                              disabled={activeSpinningMap?.[key]}
                            >
                              {model.label}
                            </button>
                          ))}
                          <button
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700 rounded-b-md disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              handleRetryClick(key, message);
                              closeDropdown(key);
                            }}
                            disabled={activeSpinningMap?.[key]}
                          >
                            현재 모델로 재생성
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {onCopy && (
                    <Action
                      tooltip="클립보드에 복사"
                      label="Copy"
                      onClick={() => handleCopyClick(key, message)}
                    >
                      {internalCopiedMap[key] ? (
                        <svg
                          className="h-4 w-4 text-emerald-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <CopyIcon className="h-4 w-4" />
                      )}
                    </Action>
                  )}
                </Actions>
                  )}
                </div>
              ) : null}
              {reasoningNode}
              {attachmentsNode}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
