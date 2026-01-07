'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
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
    if (query.length === 0) {
      setSuggestions(exampleSearches);
      setShowSuggestions(true);
    }
  };

  const isLarge = size === 'large';
  const isSmall = size === 'small';

  return (
    <div className={cn('relative w-full', className)} ref={suggestionsRef}>
      <div
        className={cn(
          'search-input-wrapper flex items-center gap-2 bg-white dark:bg-card border border-border rounded-full shadow-sm hover:shadow-md transition-all',
          isLarge ? 'pl-5 pr-2 py-2' : isSmall ? 'px-3 py-1.5' : 'pl-4 pr-2 py-1.5',
          showSuggestions && 'rounded-b-none shadow-md'
        )}
      >
        <Search
          className={cn(
            'text-muted-foreground flex-shrink-0',
            isLarge ? 'w-5 h-5' : isSmall ? 'w-4 h-4' : 'w-5 h-5'
          )}
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={cn(
            'flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70 min-w-0',
            isLarge ? 'text-base md:text-lg py-2' : isSmall ? 'text-sm' : 'text-base'
          )}
          autoComplete="off"
          spellCheck="false"
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              onTypingChange?.(false);
              inputRef.current?.focus();
            }}
            className="p-1.5 hover:bg-muted rounded-full transition-colors flex-shrink-0"
          >
            <X className={cn('text-muted-foreground', isSmall ? 'w-3 h-3' : 'w-4 h-4')} />
          </button>
        )}

        {/* Search button - icon style like ChatGPT/Grok */}
        <Button
          onClick={() => handleSearch()}
          disabled={isLoading || !query.trim()}
          size="icon"
          className={cn(
            'rounded-full flex-shrink-0 transition-all',
            isLarge ? 'h-10 w-10 md:h-12 md:w-12' : isSmall ? 'h-7 w-7' : 'h-9 w-9',
            !query.trim() && 'opacity-50'
          )}
        >
          <Search className={cn(isLarge ? 'w-5 h-5' : 'w-4 h-4')} />
        </Button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-card border border-t-0 border-border rounded-b-2xl shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            <p className="px-3 py-1 text-xs text-muted-foreground font-medium">
              {query ? 'Suggestions' : 'Try searching for'}
            </p>
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => handleSearch(suggestion)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-muted transition-colors',
                  selectedIndex === index && 'bg-muted'
                )}
              >
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
