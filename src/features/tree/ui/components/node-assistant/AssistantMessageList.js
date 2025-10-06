import React from 'react';
import { RefreshCcw as RefreshCcwIcon, Copy as CopyIcon } from 'lucide-react';
import { Response } from 'shared/ui/shadcn-io/ai/response';
import { Actions, Action } from 'shared/ui/shadcn-io/ai/actions';

const AssistantMessageList = ({
  messages,
  panelStyles,
  theme,
  onRetry,
  onCopy,
  spinningMap,
  copiedMap,
}) => (
  <div className="flex flex-col gap-6">
    {messages.map((message, index) => {
      const isAssistant = message.role === 'assistant';
      const key = typeof message.id === 'string' && message.id.trim()
        ? message.id
        : `message-${index}`;

      return (
        <div
          key={key}
          className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
          data-testid={isAssistant ? 'assistant-message' : 'user-message'}
          data-status={message.status || 'complete'}
        >
          {isAssistant ? (
            <div className="w-full">
              <Response className="w-full text-base leading-7" style={{ color: panelStyles.textColor }}>
                {message.text}
              </Response>
              <Actions className="mt-2">
                <Action
                  tooltip="Regenerate response"
                  label="Retry"
                  onClick={() => onRetry(message)}
                >
                  <RefreshCcwIcon className={`h-4 w-4 ${spinningMap[message.id] ? 'animate-spin' : ''}`} />
                </Action>
                <Action
                  tooltip="Copy to clipboard"
                  label="Copy"
                  onClick={() => onCopy(message)}
                >
                  {copiedMap[message.id] ? (
                    <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Action>
              </Actions>
            </div>
          ) : (
            <div
              className="max-w-[240px] break-all rounded-2xl px-4 py-3 text-sm shadow-lg backdrop-blur-sm"
              style={{
                borderColor: panelStyles.borderColor,
                backgroundColor: theme === 'light' || theme === 'glass'
                  ? 'rgba(0, 0, 0, 0.05)'
                  : 'rgba(255, 255, 255, 0.1)',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              <p
                className="whitespace-pre-wrap leading-relaxed"
                style={{
                  color: theme === 'light' || theme === 'glass'
                    ? 'rgba(0, 0, 0, 0.9)'
                    : 'rgba(255, 255, 255, 0.9)',
                }}
              >
                {message.text}
              </p>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default AssistantMessageList;
