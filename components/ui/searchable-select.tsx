'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Search...',
  emptyText = 'No option found.',
  className,
  disabled = false,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  // Handle option selection
  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setSearch('');
    setOpen(false);
  };

  // Handle clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onValueChange('');
    setSearch('');
    inputRef.current?.focus();
  };

  // Handle input click - open dropdown
  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      setOpen(true);
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Select the first filtered option
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0].value);
      }
    }
  };

  // Display value in input
  const displayValue = selectedOption ? selectedOption.label : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <input
            ref={inputRef}
            id={id}
            type="text"
            disabled={disabled}
            placeholder={placeholder}
            value={open ? search : displayValue}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!open) setOpen(true);
            }}
            onClick={handleInputClick}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-16',
              className
            )}
            aria-label={placeholder}
            autoComplete="off"
          />
          <div className="absolute right-2 top-2.5 flex items-center gap-1 pointer-events-none">
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="h-5 w-5 rounded-sm opacity-50 hover:opacity-100 transition-opacity pointer-events-auto"
                aria-label="Clear selection"
                tabIndex={-1}
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {filteredOptions.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
