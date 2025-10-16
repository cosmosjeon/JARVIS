import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from 'shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from 'shared/ui/dropdown-menu';
import { cn } from 'shared/utils';

const ProviderDropdown = ({
  options = [],
  value,
  onChange,
  disabled = false,
  className,
  align = 'end',
  onOpenChange,
  onContentHeightChange,
}) => {
  const active = options.find((option) => option.id === value) || options[0];
  const contentRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = useCallback((open) => {
    setIsOpen(open);
    onOpenChange?.(open);
  }, [onOpenChange]);

  // 드롭다운 콘텐츠 높이 측정
  useEffect(() => {
    if (!isOpen || !contentRef.current || !onContentHeightChange) {
      return;
    }

    const measureHeight = () => {
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect();
        const measuredHeight = rect.height;
        if (measuredHeight > 0) {
          onContentHeightChange(measuredHeight);
        }
      }
    };

    // 약간의 지연을 두고 측정 (렌더링 완료 보장)
    const timeoutId = setTimeout(measureHeight, 50);

    // ResizeObserver로 동적 크기 변화 감지
    const observer = new ResizeObserver(() => {
      measureHeight();
    });

    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [isOpen, onContentHeightChange, options.length]);

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || options.length === 0}
          className={cn(
            'rounded-lg px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground',
            className,
          )}
        >
          {active ? active.label : 'AI'}
          <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={contentRef}
        align={align}
        className="min-w-[14rem] max-h-[280px] overflow-y-auto transition-all duration-300 ease-out"
        data-interactive-zone="true"
      >
        <DropdownMenuRadioGroup
          value={active ? active.id : options[0]?.id}
          onValueChange={(next) => onChange?.(next)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              className="text-sm py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProviderDropdown;
