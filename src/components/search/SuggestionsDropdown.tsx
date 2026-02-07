'use client';

import { memo } from 'react';
import { Search, Clock, Truck, Tag, TrendingUp, Sparkles, ArrowUpRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutocompleteSuggestion {
  type: 'make' | 'model' | 'category' | 'popular' | 'recent';
  text: string;
  subtext?: string;
}

interface SuggestionsDropdownProps {
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  query: string;
  isLoadingSuggestions: boolean;
  recentSearches: string[];
  onSelect: (text: string) => void;
  onClearRecent: (e: React.MouseEvent) => void;
  suggestionsLabel: string;
  trySearchingLabel: string;
}

export const SuggestionsDropdown = memo(function SuggestionsDropdown({
  suggestions,
  selectedIndex,
  query,
  isLoadingSuggestions,
  recentSearches,
  onSelect,
  onClearRecent,
  suggestionsLabel,
  trySearchingLabel,
}: SuggestionsDropdownProps) {
  return (
    <div
      className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border-2 border-t-0 border-primary/50 rounded-b-2xl shadow-lg shadow-primary/10 z-50 overflow-hidden"
      role="listbox"
      aria-label="Search suggestions"
    >
      <div className="p-2">
        {/* Header with clear recent option */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
            {query ? suggestionsLabel : (recentSearches.length > 0 ? 'Recent & Suggested' : trySearchingLabel)}
          </p>
          {!query && recentSearches.length > 0 && (
            <button
              onClick={onClearRecent}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Clear recent
            </button>
          )}
        </div>

        {/* Loading indicator */}
        {isLoadingSuggestions && query && (
          <div className="flex items-center gap-2 px-3 py-2 text-zinc-400" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Axlon is searching...</span>
          </div>
        )}

        {/* Suggestion items */}
        {suggestions.map((suggestion, index) => {
          const isQuestion = suggestion.text.includes('?') ||
            suggestion.text.toLowerCase().startsWith('what') ||
            suggestion.text.toLowerCase().startsWith('how');

          const SuggestionIcon = suggestion.type === 'recent' ? Clock
            : suggestion.type === 'make' ? Truck
            : suggestion.type === 'model' ? Truck
            : suggestion.type === 'category' ? Tag
            : suggestion.type === 'popular' ? TrendingUp
            : isQuestion ? Sparkles
            : Search;

          return (
            <button
              key={`${suggestion.type}-${suggestion.text}`}
              onClick={() => onSelect(suggestion.text)}
              role="option"
              aria-selected={selectedIndex === index}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group',
                selectedIndex === index
                  ? 'bg-primary/10 text-primary'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              <SuggestionIcon className={cn(
                'w-4 h-4 flex-shrink-0',
                suggestion.type === 'recent' ? 'text-amber-500' :
                suggestion.type === 'make' || suggestion.type === 'model' ? 'text-blue-500' :
                suggestion.type === 'category' ? 'text-purple-500' :
                'opacity-50'
              )} />
              <div className="flex-1 min-w-0">
                <span className="truncate block">{suggestion.text}</span>
                {suggestion.subtext && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">{suggestion.subtext}</span>
                )}
              </div>
              <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
            </button>
          );
        })}

        {/* Keyboard navigation hint */}
        {suggestions.length > 0 && (
          <div className="flex items-center gap-4 px-3 pt-2 pb-1 border-t border-zinc-100 dark:border-zinc-800 mt-1">
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px]">↑↓</kbd> navigate
            </span>
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px]">↵</kbd> search
            </span>
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px]">esc</kbd> close
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export type { AutocompleteSuggestion };
