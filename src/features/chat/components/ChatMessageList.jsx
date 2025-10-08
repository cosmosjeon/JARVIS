import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy as CopyIcon, RefreshCcw as RefreshCcwIcon } from 'lucide-react';
import { Actions, Action } from 'shared/ui/shadcn-io/ai/actions';
import { Response } from 'shared/ui/shadcn-io/ai/response';
import { cn } from 'shared/utils';
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

export default function ChatMessageList({
  title = 'Assistant',
  messages = [],
  endRef,
  onRetry,
  onCopy,
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
      data-block-pan="true"
      style={{ userSelect: 'text', position: 'relative', zIndex: 0, pointerEvents: 'auto' }}
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
                  color: isLightTheme
                    ? 'rgba(0, 0, 0, 0.9)'
                    : 'rgba(255, 255, 255, 0.92)',
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

        return (
          <div key={key} className="flex justify-start" data-role="assistant" data-status={status}>
            <div className="w-full" style={{ maxWidth: assistantMessageMaxWidth }}>
              {message.text ? (
                <Response
                  className="w-full text-base leading-7"
                  style={{ color: resolvedPanelStyles.textColor }}
                >
                  {message.text}
                </Response>
              ) : null}
              {attachmentsNode}
              {showActions && (
                <Actions className="mt-2">
                  {onRetry && (
                    <Action
                      tooltip="Regenerate response"
                      label="Retry"
                      onClick={() => handleRetryClick(key, message)}
                    >
                      <RefreshCcwIcon className={`h-4 w-4 ${activeSpinningMap?.[key] ? 'animate-spin' : ''}`} />
                    </Action>
                  )}
                  {onCopy && (
                    <Action
                      tooltip="Copy to clipboard"
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
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
