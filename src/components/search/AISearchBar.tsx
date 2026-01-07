'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  size?: 'small' | 'default' | 'large';
  autoFocus?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
}

export function AISearchBar({
  defaultValue = '',
  placeholder = 'Search for trucks, trailers, equipment...',
  className,
  size = 'default',
  autoFocus = false,
  onTypingChange,
}: AISearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Example suggestions for demo
  const exampleSearches = [
    '2020 Peterbilt 579 under $100k',
    'Freightliner Cascadia sleeper in Texas',
    'Reefer trailer 53ft low miles',
    'Kenworth W900 day cab',
    'Used dump trucks near me',
  ];

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setIsLoading(true);
    setShowSuggestions(false);

    // Navigate to search results with the query
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSearch(suggestions[selectedIndex]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);

    // Notify parent about typing state
    onTypingChange?.(value.length > 0);

    // Show example suggestions when typing
    if (value.length > 0) {
      const filtered = exampleSearches.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.length > 0 ? filtered : exampleSearches.slice(0, 3));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (query.length === 0) {
      setSuggestions(exampleSearches);
      setShowSuggestions(true);
    }
  };

  const isLarge = size === 'large';
  const isSmall = size === 'small';

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {/* Modern search input - clean with subtle brand accent */}
      <div
        className={cn(
          'flex items-center gap-3 bg-white dark:bg-zinc-900 border-2 transition-all shadow-sm',
          isLarge ? 'rounded-2xl px-5 py-3' : isSmall ? 'rounded-xl px-3 py-2' : 'rounded-xl px-4 py-2.5',
          isFocused
            ? 'border-primary/50 shadow-lg shadow-primary/10'
            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600',
          showSuggestions && 'rounded-b-none'
        )}
      >
        {/* Search icon */}
        <Search
          className={cn(
            'flex-shrink-0 transition-colors',
            isLarge ? 'w-5 h-5' : 'w-4 h-4',
            isFocused ? 'text-primary' : 'text-zinc-400'
          )}
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => !showSuggestions && setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            'flex-1 bg-transparent outline-none placeholder:text-zinc-400 min-w-0 text-zinc-900 dark:text-zinc-100',
            isLarge ? 'text-base md:text-lg' : isSmall ? 'text-sm' : 'text-base'
          )}
          autoComplete="off"
          spellCheck="false"
        />

        {/* Submit button - arrow that activates on input */}
        <button
          onClick={() => handleSearch()}
          disabled={isLoading || !query.trim()}
          className={cn(
            'flex-shrink-0 flex items-center justify-center rounded-lg transition-all',
            isLarge ? 'h-9 w-9' : isSmall ? 'h-6 w-6' : 'h-8 w-8',
            query.trim()
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
          )}
        >
          <ArrowRight className={cn(isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5')} strokeWidth={2.5} />
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border-2 border-t-0 border-primary/50 rounded-b-2xl shadow-lg shadow-primary/10 z-50 overflow-hidden">
          <div className="p-2">
            <p className="px-3 py-1.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">
              {query ? 'Suggestions' : 'Popular searches'}
            </p>
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => handleSearch(suggestion)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                  selectedIndex === index
                    ? 'bg-primary/10 text-primary'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                <Search className="w-4 h-4 flex-shrink-0 opacity-50" />
                <span className="truncate">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
