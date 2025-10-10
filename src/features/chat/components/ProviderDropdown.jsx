import React from 'react';
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
}) => {
  const active = options.find((option) => option.id === value) || options[0];

  return (
    <DropdownMenu>
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
      <DropdownMenuContent align={align} className="min-w-[10rem]" data-interactive-zone="true">
        <DropdownMenuRadioGroup
          value={active ? active.id : options[0]?.id}
          onValueChange={(next) => onChange?.(next)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              className="text-sm"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProviderDropdown;
