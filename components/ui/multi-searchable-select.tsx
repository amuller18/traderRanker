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
import { Badge } from '@/components/ui/badge';

export interface MultiSearchableSelectOption {
  value: string;
  label: string;
}

interface MultiSearchableSelectProps {
  options: MultiSearchableSelectOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function MultiSearchableSelect({
  options,
  values,
  onValuesChange,
  placeholder = 'Search...',
  emptyText = 'No option found.',
  className,
  disabled = false,
  id,
}: MultiSearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOptions = options.filter((option) => values.includes(option.value));

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  // Handle option selection
  const handleSelect = (selectedValue: string) => {
    const isSelected = values.includes(selectedValue);
    if (isSelected) {
      onValuesChange(values.filter((v) => v !== selectedValue));
    } else {
      onValuesChange([...values, selectedValue]);
    }
    setSearch('');
    inputRef.current?.focus();
  };

  // Handle remove badge
  const handleRemove = (valueToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onValuesChange(values.filter((v) => v !== valueToRemove));
  };

  // Handle clear all
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onValuesChange([]);
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
    } else if (e.key === 'Backspace' && search === '' && values.length > 0) {
      // Remove last selected item on backspace when input is empty
      e.preventDefault();
      onValuesChange(values.slice(0, -1));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <div
            className={cn(
              'flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            onClick={handleInputClick}
          >
            <div className="flex flex-wrap gap-1 flex-1 items-center">
              {selectedOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {option.label}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(option.value, e)}
                    className="ml-1 rounded-sm hover:bg-secondary-foreground/20 h-4 w-4 flex items-center justify-center"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                ref={inputRef}
                id={id}
                type="text"
                disabled={disabled}
                placeholder={values.length === 0 ? placeholder : ''}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (!open) setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
                aria-label={placeholder}
                autoComplete="off"
              />
            </div>
            <div className="flex items-center gap-1 ml-2">
              {values.length > 0 && !disabled && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="h-5 w-5 rounded-sm opacity-50 hover:opacity-100 transition-opacity"
                  aria-label="Clear all selections"
                  tabIndex={-1}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
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
                {filteredOptions.map((option) => {
                  const isSelected = values.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
