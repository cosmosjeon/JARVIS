import React, { createContext, useContext, useMemo, useState } from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';
import { cn } from 'shared/utils';

const ReasoningContext = createContext({
  open: false,
  setOpen: () => {},
  isStreaming: false,
});

const useReasoning = () => useContext(ReasoningContext);

export const Reasoning = ({
  defaultOpen = false,
  open,
  onOpenChange,
  isStreaming = false,
  className,
  children,
}) => {
  const isControlled = typeof open === 'boolean';
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const effectiveOpen = isControlled ? open : internalOpen;

  const setOpen = (next) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  const contextValue = useMemo(
    () => ({ open: effectiveOpen, setOpen, isStreaming }),
    [effectiveOpen, setOpen, isStreaming],
  );

  return (
    <ReasoningContext.Provider value={contextValue}>
      <div
        className={cn(
          'w-full rounded-xl border border-border/80 bg-card/70 shadow-sm backdrop-blur-sm transition-colors',
          className,
        )}
      >
        {children}
      </div>
    </ReasoningContext.Provider>
  );
};

export const ReasoningTrigger = ({ children, className, ...props }) => {
  const { open, setOpen, isStreaming } = useReasoning();

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex w-full items-center gap-2 rounded-t-xl px-4 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      <Lightbulb className="h-4 w-4 text-amber-500" />
      <span>{children || 'Reasoning'}</span>
      {isStreaming ? (
        <span className="ml-auto animate-pulse text-[11px] text-muted-foreground/80">
          streaming…
        </span>
      ) : null}
    </button>
  );
};

export const ReasoningContent = ({ children, className }) => {
  const { open } = useReasoning();
  if (!open) {
    return null;
  }
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-border/80 px-4 py-3 text-sm leading-relaxed text-muted-foreground',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
        <Sparkles className="h-3 w-3 text-purple-500" />
        <span>Model thoughts</span>
      </div>
      {children}
    </div>
  );
};

export default Reasoning;
