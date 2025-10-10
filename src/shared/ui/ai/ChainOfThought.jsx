import React, { createContext, useContext, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Dot } from 'lucide-react';
import { cn } from 'shared/utils';

const ChainOfThoughtContext = createContext({
  open: false,
  setOpen: () => {},
});

const useChainOfThought = () => useContext(ChainOfThoughtContext);

export const ChainOfThought = ({
  defaultOpen = false,
  open,
  onOpenChange,
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
    () => ({ open: effectiveOpen, setOpen }),
    [effectiveOpen, setOpen],
  );

  return (
    <ChainOfThoughtContext.Provider value={contextValue}>
      <div
        className={cn(
          'w-full rounded-xl border border-border bg-card/60 shadow-sm backdrop-blur-sm transition-colors',
          className,
        )}
      >
        {children}
      </div>
    </ChainOfThoughtContext.Provider>
  );
};

export const ChainOfThoughtHeader = ({ children, className, ...props }) => {
  const { open, setOpen } = useChainOfThought();

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-t-xl px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      <span>{children || 'Chain of Thought'}</span>
      <ChevronDown
        className={cn(
          'h-4 w-4 transition-transform',
          open ? 'rotate-180' : 'rotate-0',
        )}
      />
    </button>
  );
};

export const ChainOfThoughtContent = ({ children, className }) => {
  const { open } = useChainOfThought();
  if (!open) {
    return null;
  }
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-border/60 px-4 py-4 text-sm text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
};

const STATUS_COLOR = {
  complete: 'text-emerald-500 border-emerald-200/50 bg-emerald-500/5',
  active: 'text-sky-500 border-sky-200/50 bg-sky-500/10 animate-pulse',
  pending: 'text-muted-foreground border-border bg-card/40',
};

export const ChainOfThoughtStep = ({
  icon: Icon = Dot,
  label,
  description,
  status = 'complete',
  children,
  className,
}) => (
  <div
    className={cn(
      'flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm',
      STATUS_COLOR[status] || STATUS_COLOR.complete,
      className,
    )}
  >
    <div className="flex items-center gap-2 font-medium text-foreground">
      {Icon ? <Icon className="h-4 w-4" /> : <Dot className="h-4 w-4" />}
      <span>{label}</span>
    </div>
    {description ? (
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    ) : null}
    {children ? (
      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        {children}
      </div>
    ) : null}
  </div>
);

export const ChainOfThoughtSearchResults = ({ children, className }) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-background/60 px-2 py-2 text-xs',
      className,
    )}
  >
    <ChevronRight className="h-3 w-3 text-muted-foreground" />
    <span className="font-medium text-muted-foreground">Search</span>
    <div className="flex flex-wrap items-center gap-1">{children}</div>
  </div>
);

export const ChainOfThoughtSearchResult = ({ children, className, ...props }) => (
  <span
    className={cn(
      'rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

export const ChainOfThoughtImage = ({ src, alt, caption, className }) => (
  <figure
    className={cn(
      'flex flex-col gap-2 overflow-hidden rounded-lg border border-border/70 bg-background/70 p-2',
      className,
    )}
  >
    {src ? (
      <img
        src={src}
        alt={alt || 'Chain of thought reference'}
        className="h-32 w-full rounded-md object-cover"
      />
    ) : null}
    {caption ? (
      <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
    ) : null}
  </figure>
);

export default ChainOfThought;
