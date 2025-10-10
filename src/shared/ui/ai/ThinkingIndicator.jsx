import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from 'shared/utils';

const DOT_STYLE = [
  { animationDelay: '0s' },
  { animationDelay: '0.15s' },
  { animationDelay: '0.3s' },
];

const resolveModelLabel = (model) => {
  if (!model) {
    return null;
  }
  const normalized = model.toLowerCase();
  if (normalized.startsWith('gpt-5')) return 'GPT-5';
  if (normalized.startsWith('gpt-4o-mini')) return 'GPT-4o mini';
  if (normalized.startsWith('gpt-4o')) return 'GPT-4o';
  if (normalized.startsWith('gpt-4.1')) return 'GPT-4.1 mini';
  if (normalized.includes('gemini')) return 'Gemini';
  if (normalized.includes('claude')) return 'Claude';
  return model;
};

export const ThinkingIndicator = ({
  label = '생각 중이에요…',
  className,
  modelInfo,
}) => {
  const modelLabel = resolveModelLabel(modelInfo?.model);
  const providerLabel = modelInfo?.provider ? modelInfo.provider.replace(/^\w/, (char) => char.toUpperCase()) : null;

  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <div className="relative flex items-center gap-1 text-primary">
        {DOT_STYLE.map((style, index) => (
          <span
            key={index}
            className="inline-block h-2.5 w-2.5 rounded-full bg-current animate-bounce"
            style={style}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {modelLabel ? (
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/80" />
            {providerLabel ? `${providerLabel} · ` : null}{modelLabel}
          </span>
          {modelInfo?.explanation ? (
            <span className="text-muted-foreground/70">
              {modelInfo.explanation}
            </span>
          ) : null}
        </div>
      ) : modelInfo?.explanation ? (
        <span className="ml-auto text-[11px] text-muted-foreground/70">
          {modelInfo.explanation}
        </span>
      ) : null}
    </div>
  );
};

export default ThinkingIndicator;
