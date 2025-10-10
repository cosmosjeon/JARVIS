import React from 'react';
import { Button } from 'shared/ui/button';
import { cn } from 'shared/utils';
import { Loader2, Send, Square, X } from 'lucide-react';

export const PromptInput = ({ className, ...props }) => (
  <form
    className={cn(
      'w-full h-full flex items-end gap-2 overflow-hidden rounded-xl border bg-background/80 backdrop-blur-sm shadow-lg p-2',
      className
    )}
    style={{
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    }}
    {...props}
  />
);

export const PromptInputTextarea = React.forwardRef(({
  onChange,
  onKeyDown: externalOnKeyDown,
  className,
  placeholder = 'What would you like to know?',
  minHeight = 40,
  maxHeight = 164,
  value,
  ...props
}, ref) => {
  const textareaRef = React.useRef(null);
  
  // ref 병합
  React.useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(textareaRef.current);
      } else {
        ref.current = textareaRef.current;
      }
    }
  }, [ref]);

  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight - 8), maxHeight)}px`;
    }
  }, [minHeight, maxHeight]);

  // value 변경 시 높이 조절
  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow newline
        return;
      }
      // Submit on Enter (without Shift)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handleChange = (e) => {
    // 자동 높이 조절
    adjustHeight();
    onChange?.(e);
  };

  const handleTextareaKeyDown = (e) => {
    if (externalOnKeyDown) {
      externalOnKeyDown(e);
      if (e.defaultPrevented) {
        return;
      }
    }
    handleKeyDown(e);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      className={cn(
        'flex-1 w-full resize-none rounded-lg border-none bg-transparent px-3 text-sm shadow-none outline-none ring-0',
        'placeholder:text-muted-foreground',
        'focus-visible:ring-0 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      style={{
        minHeight: `${minHeight - 8}px`,
        maxHeight: `${maxHeight}px`,
        lineHeight: '1.3',
        overflowY: 'auto',
        height: `${minHeight - 8}px`,
        paddingTop: '2px',
        paddingBottom: '2px',
      }}
      name="message"
      onChange={handleChange}
      onKeyDown={handleTextareaKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
});

PromptInputTextarea.displayName = 'PromptInputTextarea';

export const PromptInputToolbar = ({ className, ...props }) => (
  <div
    className={cn('flex items-center justify-between p-1', className)}
    {...props}
  />
);

export const PromptInputTools = ({ className, ...props }) => (
  <div
    className={cn(
      'flex items-center gap-1',
      '[&_button:first-child]:rounded-bl-xl',
      className
    )}
    {...props}
  />
);

export const PromptInputButton = ({
  variant = 'ghost',
  className,
  size = 'icon',
  ...props
}) => {
  return (
    <Button
      className={cn(
        'shrink-0 gap-1.5 rounded-lg',
        variant === 'ghost' && 'text-muted-foreground',
        className
      )}
      size={size}
      type="button"
      variant={variant}
      {...props}
    />
  );
};

export const PromptInputSubmit = ({
  className,
  variant = 'default',
  size = 'icon',
  status,
  children,
  ...props
}) => {
  let Icon = <Send className="size-4" />;
  if (status === 'submitted') {
    Icon = <Loader2 className="size-4 animate-spin" />;
  } else if (status === 'streaming') {
    Icon = <Square className="size-4" />;
  } else if (status === 'error') {
    Icon = <X className="size-4" />;
  }

  return (
    <Button
      className={cn('gap-1.5 rounded-lg shrink-0', className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};
