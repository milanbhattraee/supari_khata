"use client";

import * as React from "react";
import { ChevronDownIcon, CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const searchLower = search.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-xl border-[0.5px] border-foreground/8 bg-white/50 backdrop-blur-sm py-2 pr-2 pl-3 text-[15px] text-left transition-all outline-none select-none focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/8 dark:border-white/10 dark:hover:bg-white/12 h-10",
          !selectedOption && "text-muted-foreground"
        )}
      >
        <span className="flex-1 truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-foreground/10 rounded"
            >
              <XIcon className="size-3.5 text-muted-foreground" />
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-white/95 backdrop-blur-xl shadow-lg ring-1 ring-foreground/8 dark:bg-black/90 dark:ring-white/10 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-foreground/5">
            <SearchIcon className="size-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-0.5 hover:bg-foreground/10 rounded"
              >
                <XIcon className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex w-full items-center gap-2 px-3 py-2 text-[14px] text-left hover:bg-foreground/5 active:bg-foreground/8 transition-colors",
                    option.value === value && "bg-primary/5"
                  )}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.value === value && (
                    <CheckIcon className="size-4 text-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
