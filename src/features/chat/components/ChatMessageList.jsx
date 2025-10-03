import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Response } from 'components/ui/shadcn-io/ai/response';
import { Avatar, AvatarFallback, AvatarImage } from 'components/ui/avatar';
import { Separator } from 'components/ui/separator';
import { Copy as CopyIcon, RefreshCcw as RefreshCcwIcon } from 'lucide-react';
import { Actions, Action } from 'components/ui/shadcn-io/ai/actions';
import { Conversation, ConversationContent, ConversationScrollButton } from 'components/ui/shadcn-io/ai/conversation';

export default function ChatMessageList({ title = 'Assistant', messages = [], endRef, onRetry, onCopy }) {
  const avatarInitial = title.charAt(0).toUpperCase();
  const [copiedMap, setCopiedMap] = useState({});
  const [spinningMap, setSpinningMap] = useState({});
  const messageById = useMemo(() => Object.fromEntries((messages || []).map(m => [m.id, m])), [messages]);
  const scrollContainerRef = useRef(null);
  const isTyping = useMemo(() => messages.some(m => m.status === 'typing' || m.status === 'pending'), [messages]);

  const handleRetryClick = (message) => {
    if (!message) return;
    setSpinningMap((prev) => ({ ...prev, [message.id]: true }));
    try { onRetry?.(message); } finally {
      window.setTimeout(() => setSpinningMap((prev) => ({ ...prev, [message.id]: false })), 900);
    }
  };

  const handleCopyClick = (message) => {
    if (!message) return;
    onCopy?.(message);
    setCopiedMap((prev) => ({ ...prev, [message.id]: true }));
    window.setTimeout(() => setCopiedMap((prev) => ({ ...prev, [message.id]: false })), 1600);
  };

  // 타이핑 중일 때만 자동 스크롤 (메시지 변경될 때마다)
  useEffect(() => {
    if (isTyping && scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      // 다음 프레임에서 스크롤 (DOM 업데이트 후)
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [messages, isTyping]);

  return (
    <div ref={scrollContainerRef} className="flex flex-col gap-5 p-6 h-full overflow-y-auto">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const isSystem = message.role === 'system';
          const showActions = !isUser && !isSystem && (onRetry || onCopy);
          return (
            <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <Avatar className="mt-1 h-10 w-10 border border-border/80 bg-background/40">
                  <AvatarImage alt={`${title} avatar`} />
                  <AvatarFallback className="bg-muted text-xs font-semibold uppercase tracking-wide">{avatarInitial}</AvatarFallback>
                </Avatar>
              )}
              <div className={`flex max-w-[560px] flex-col gap-3 ${isUser ? 'items-end' : ''}`}>
                <div className={`group relative w-full rounded-2xl border border-border/80 bg-card/90 p-4 text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-colors ${isUser ? 'border-primary/50 bg-primary text-primary-foreground' : ''} ${isSystem ? 'border-muted/50 bg-muted text-muted-foreground' : ''}`}>
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground/80">
                    <span>{isUser ? 'You' : isSystem ? 'System' : title}</span>
                    {message.timestamp && <span>{typeof message.timestamp === 'number' ? new Date(message.timestamp).toLocaleTimeString() : message.timestamp}</span>}
                  </div>
                  <Separator className="my-3 bg-border/60" />
                  <div className="leading-relaxed">
                    {isUser ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                    ) : (
                      <Response className="w-full text-sm leading-relaxed">{message.text}</Response>
                    )}
                  </div>
                  {showActions && (
                    <Actions className="mt-2">
                      {onRetry && (
                        <Action
                          tooltip="Regenerate response"
                          label="Retry"
                          onClick={() => handleRetryClick(message)}
                        >
                          <RefreshCcwIcon className={`h-4 w-4 ${spinningMap[message.id] ? 'animate-spin' : ''}`} />
                        </Action>
                      )}
                      {onCopy && (
                        <Action
                          tooltip="Copy to clipboard"
                          label="Copy"
                          onClick={() => handleCopyClick(message)}
                        >
                          {copiedMap[message.id] ? (
                            <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                        </Action>
                      )}
                    </Actions>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
    </div>
  );
}


