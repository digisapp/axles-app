'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, Sparkles, X, Loader2, ArrowUpRight, Mic, MicOff, Calculator, Flame, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchTranslations } from '@/lib/i18n';

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
}

export function AISearchBar({
  defaultValue = '',
  placeholder,
  className,
  size = 'default',
  autoFocus = false,
  onTypingChange,
  animatedPlaceholder = false,
}: AISearchBarProps) {
  const router = useRouter();
  const { translations: t } = useSearchTranslations();
  const [query, setQuery] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognitionAPI);
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

    // Show example suggestions when typing
    if (value.length > 0) {
      const filtered = t.exampleSearches.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.length > 0 ? filtered : t.exampleSearches.slice(0, 3));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (query.length === 0 && !showChat) {
      setSuggestions(t.exampleSearches);
      setShowSuggestions(true);
    }
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
            <p className="px-3 py-1.5 text-xs text-zinc-500 font-medium uppercase tracking-wide">
              {query ? t.ui.suggestions : t.ui.trySearching}
            </p>
            {suggestions.map((suggestion, index) => {
              const isQuestion = suggestion.includes('?') ||
                suggestion.toLowerCase().startsWith('what') ||
                suggestion.toLowerCase().startsWith('how');

              return (
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
                  {isQuestion ? (
                    <Sparkles className="w-4 h-4 flex-shrink-0 opacity-50" />
                  ) : (
                    <Search className="w-4 h-4 flex-shrink-0 opacity-50" />
                  )}
                  <span className="truncate">{suggestion}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
