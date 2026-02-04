'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, Sparkles, X, Loader2, ArrowUpRight, Mic, MicOff, Calculator, Flame, MapPin, Clock, TrendingUp, Tag, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchTranslations } from '@/lib/i18n';

// Local storage key for recent searches
const RECENT_SEARCHES_KEY = 'axlesai-recent-searches';
const MAX_RECENT_SEARCHES = 5;

// Helper to get recent searches from localStorage
function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Helper to save a search to recent searches
function saveRecentSearch(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    const recent = getRecentSearches();
    // Remove duplicates and add to front
    const filtered = recent.filter(s => s.toLowerCase() !== query.toLowerCase());
    const updated = [query.trim(), ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

// Helper to clear recent searches
function clearRecentSearches() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore
  }
}

interface AutocompleteSuggestion {
  type: 'make' | 'model' | 'category' | 'popular' | 'recent';
  text: string;
  subtext?: string;
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface SuggestedListing {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  location: string;
  isGoodDeal: boolean;
}

interface ChatResponse {
  response: string;
  suggestedCategory: string | null;
  suggestedTool: {
    name: string;
    url: string;
    description: string;
  } | null;
  suggestedListings: SuggestedListing[] | null;
  inventoryStats: {
    total: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
  } | null;
}

interface AISearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  size?: 'small' | 'default' | 'large';
  autoFocus?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
  animatedPlaceholder?: boolean;
  showLanguageHint?: boolean;
}

export function AISearchBar({
  defaultValue = '',
  placeholder,
  className,
  size = 'default',
  autoFocus = false,
  onTypingChange,
  animatedPlaceholder = false,
  showLanguageHint = false,
}: AISearchBarProps) {
  const router = useRouter();
  const { translations: t } = useSearchTranslations();
  const [query, setQuery] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognitionAPI);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Fetch autocomplete suggestions with debounce
  const fetchAutocompleteSuggestions = useCallback(async (searchQuery: string) => {
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }

    // For empty query, show recent searches + popular
    if (!searchQuery.trim()) {
      const recent = getRecentSearches();
      const recentSuggestions: AutocompleteSuggestion[] = recent.map(text => ({
        type: 'recent' as const,
        text,
        subtext: 'Recent'
      }));
      setSuggestions(recentSuggestions);
      setRecentSearches(recent);
      return;
    }

    // Debounce API calls
    autocompleteTimeoutRef.current = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();

          // Combine recent searches with API suggestions
          const recent = getRecentSearches()
            .filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
            .slice(0, 2)
            .map(text => ({ type: 'recent' as const, text, subtext: 'Recent' }));

          // Merge, keeping recent at top
          const combined = [...recent, ...data.suggestions];

          // Dedupe
          const seen = new Set<string>();
          const unique = combined.filter(s => {
            const key = s.text.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, 8);

          setSuggestions(unique);
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
        // Fall back to example searches
        const filtered = t.exampleSearches
          .filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
          .slice(0, 5)
          .map(text => ({ type: 'popular' as const, text }));
        setSuggestions(filtered);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 150); // 150ms debounce
  }, [t.exampleSearches]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
    };
  }, []);

  // Voice input handler
  const startVoiceInput = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update query with interim or final results
      const newQuery = finalTranscript || interimTranscript;
      if (newQuery) {
        setQuery(newQuery);
        onTypingChange?.(true);
      }

      // Auto-search on final result
      if (finalTranscript) {
        setIsListening(false);
        // Small delay to let user see the transcription
        setTimeout(() => {
          handleSearch(finalTranscript);
        }, 500);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setShowSuggestions(false);
    setShowChat(false);
    inputRef.current?.focus();
  }, [onTypingChange]);

  const stopVoiceInput = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  // Client-side question detection using translated question starters
  const isQuestion = useCallback((queryText: string): boolean => {
    const q = queryText.toLowerCase().trim();

    // Ends with question mark (universal)
    if (q.endsWith('?')) return true;

    // Check against translated question starters
    for (const starter of t.questionStarters) {
      if (q.startsWith(starter + ' ') || q.startsWith(starter + ',') || q.startsWith(starter)) {
        return true;
      }
    }

    return false;
  }, [t.questionStarters]);

  // Cycle through animated placeholders
  useEffect(() => {
    if (!animatedPlaceholder || query.length > 0 || isFocused) return;

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % t.placeholderExamples.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [animatedPlaceholder, query.length, isFocused, t.placeholderExamples.length]);

  // Get current placeholder - use translated placeholder
  const effectivePlaceholder = placeholder || t.placeholder;
  const currentPlaceholder = animatedPlaceholder && !isFocused && query.length === 0
    ? t.placeholderExamples[placeholderIndex]
    : effectivePlaceholder;

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

    setShowSuggestions(false);
    setChatResponse(null);
    setShowChat(false);

    // Save to recent searches
    saveRecentSearch(q);
    setRecentSearches(getRecentSearches());

    // Client-side detection: if not a question, go straight to search (faster!)
    if (!isQuestion(q)) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      return;
    }

    // It's a question - call the chat API
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatResponse({
          response: data.response,
          suggestedCategory: data.suggestedCategory,
          suggestedTool: data.suggestedTool || null,
          suggestedListings: data.suggestedListings || null,
          inventoryStats: data.inventoryStats || null,
        });
        setShowChat(true);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('Chat API error:', error);
    }

    // Fallback to search if chat fails
    setIsLoading(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSearch(suggestions[selectedIndex].text);
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
      setShowChat(false);
      setSelectedIndex(-1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    setShowChat(false);
    setChatResponse(null);

    // Notify parent about typing state
    onTypingChange?.(value.length > 0);

    // Fetch autocomplete suggestions
    fetchAutocompleteSuggestions(value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (query.length === 0 && !showChat) {
      // Show recent searches first, then popular examples
      const recent = getRecentSearches();
      const recentSuggestions: AutocompleteSuggestion[] = recent.map(text => ({
        type: 'recent' as const,
        text,
        subtext: 'Recent'
      }));
      const popularSuggestions: AutocompleteSuggestion[] = t.exampleSearches
        .slice(0, Math.max(0, 6 - recent.length))
        .map(text => ({ type: 'popular' as const, text }));
      setSuggestions([...recentSuggestions, ...popularSuggestions]);
      setRecentSearches(recent);
      setShowSuggestions(true);
    } else if (query.length > 0 && !showChat) {
      // Refetch suggestions for current query
      fetchAutocompleteSuggestions(query);
      setShowSuggestions(true);
    }
  };

  // Clear recent searches handler
  const handleClearRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearRecentSearches();
    setRecentSearches([]);
    // Refresh suggestions without recent
    const popularSuggestions: AutocompleteSuggestion[] = t.exampleSearches
      .slice(0, 6)
      .map(text => ({ type: 'popular' as const, text }));
    setSuggestions(popularSuggestions);
  };

  const closeChatResponse = () => {
    setShowChat(false);
    setChatResponse(null);
    inputRef.current?.focus();
  };

  const getCategoryLabel = (slug: string): string => {
    // Use translated category labels
    if (t.categories[slug]) {
      return t.categories[slug];
    }
    // Fallback: format slug as title case
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
          (showSuggestions || showChat) && 'rounded-b-none'
        )}
      >
        {/* Search/AI icon */}
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
          onBlur={() => !showSuggestions && !showChat && setIsFocused(false)}
          placeholder={currentPlaceholder}
          className={cn(
            'flex-1 bg-transparent outline-none placeholder:text-zinc-400 min-w-0 text-zinc-900 dark:text-zinc-100',
            isLarge ? 'text-base md:text-lg' : isSmall ? 'text-sm' : 'text-base'
          )}
          autoComplete="off"
          spellCheck="false"
        />

        {/* Voice input button - shows on supported browsers */}
        {speechSupported && (
          <button
            onClick={isListening ? stopVoiceInput : startVoiceInput}
            type="button"
            className={cn(
              'flex-shrink-0 flex items-center justify-center rounded-lg transition-all',
              isLarge ? 'h-9 w-9' : isSmall ? 'h-6 w-6' : 'h-8 w-8',
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
            title={isListening ? 'Stop listening' : 'Voice search'}
          >
            {isListening ? (
              <MicOff className={cn(isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
            ) : (
              <Mic className={cn(isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
            )}
          </button>
        )}

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
          {isLoading ? (
            <Loader2 className={cn(isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5', 'animate-spin')} />
          ) : (
            <ArrowRight className={cn(isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5')} strokeWidth={2.5} />
          )}
        </button>
      </div>

      {/* Chat response panel */}
      {showChat && chatResponse && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border-2 border-t-0 border-primary/50 rounded-b-2xl shadow-lg shadow-primary/10 z-50 overflow-hidden">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">{t.ui.aiAssistant}</span>
              </div>
              <button
                onClick={closeChatResponse}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Response */}
            <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
              {chatResponse.response}
            </div>

            {/* Suggested tool link */}
            {chatResponse.suggestedTool && (
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => {
                    router.push(chatResponse.suggestedTool!.url);
                    setShowChat(false);
                  }}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                  <span>{chatResponse.suggestedTool.name}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  {chatResponse.suggestedTool.description}
                </p>
              </div>
            )}

            {/* Suggested listings from database */}
            {chatResponse.suggestedListings && chatResponse.suggestedListings.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-2">
                  Top Matches
                </p>
                <div className="space-y-2">
                  {chatResponse.suggestedListings.map((listing) => (
                    <button
                      key={listing.id}
                      onClick={() => {
                        router.push(`/listing/${listing.id}`);
                        setShowChat(false);
                      }}
                      className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate">{listing.title}</span>
                          {listing.isGoodDeal && (
                            <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                              <Flame className="w-3 h-3" />
                              Deal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="font-semibold text-primary">
                            {listing.price ? `$${listing.price.toLocaleString()}` : 'Call'}
                          </span>
                          {listing.location && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {listing.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested category link */}
            {chatResponse.suggestedCategory && !chatResponse.suggestedTool && !chatResponse.suggestedListings?.length && (
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => {
                    router.push(`/search?category=${chatResponse.suggestedCategory}`);
                    setShowChat(false);
                  }}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <span>{t.ui.browse} {getCategoryLabel(chatResponse.suggestedCategory)}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Search anyway option */}
            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => {
                  router.push(`/search?q=${encodeURIComponent(query)}`);
                  setShowChat(false);
                }}
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t.ui.searchListingsFor} &quot;{query}&quot;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && !showChat && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border-2 border-t-0 border-primary/50 rounded-b-2xl shadow-lg shadow-primary/10 z-50 overflow-hidden">
          <div className="p-2">
            {/* Header with clear recent option */}
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
                {query ? t.ui.suggestions : (recentSearches.length > 0 ? 'Recent & Suggested' : t.ui.trySearching)}
              </p>
              {!query && recentSearches.length > 0 && (
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  Clear recent
                </button>
              )}
            </div>

            {/* Loading indicator */}
            {isLoadingSuggestions && query && (
              <div className="flex items-center gap-2 px-3 py-2 text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Searching...</span>
              </div>
            )}

            {/* Suggestion items */}
            {suggestions.map((suggestion, index) => {
              const isQuestion = suggestion.text.includes('?') ||
                suggestion.text.toLowerCase().startsWith('what') ||
                suggestion.text.toLowerCase().startsWith('how');

              // Choose icon based on suggestion type
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
                  onClick={() => handleSearch(suggestion.text)}
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
      )}

      {/* Language hint - shows supported languages */}
      {showLanguageHint && !showSuggestions && !showChat && (
        <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          <Sparkles className="w-3 h-3" />
          <span>AI speaks:</span>
          <span className="font-medium text-zinc-500 dark:text-zinc-400">English</span>
          <span>·</span>
          <span className="font-medium text-zinc-500 dark:text-zinc-400">Español</span>
          <span>·</span>
          <span className="font-medium text-zinc-500 dark:text-zinc-400">Français</span>
          <span>·</span>
          <span className="font-medium text-zinc-500 dark:text-zinc-400">Português</span>
          <span className="text-zinc-400 dark:text-zinc-500">+ more</span>
        </div>
      )}
    </div>
  );
}
