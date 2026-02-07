'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, Sparkles, Loader2, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchTranslations } from '@/lib/i18n';
import { getRecentSearches, saveRecentSearch, clearRecentSearches } from '@/lib/recent-searches';
import { ChatResponsePanel, type ChatResponse } from '@/components/search/ChatResponsePanel';
import { SuggestionsDropdown, type AutocompleteSuggestion } from '@/components/search/SuggestionsDropdown';
import { logger } from '@/lib/logger';

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
        logger.error('Autocomplete error', { error });
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
      logger.error('Chat API error', { error });
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
        <ChatResponsePanel
          chatResponse={chatResponse}
          query={query}
          onClose={closeChatResponse}
          getCategoryLabel={getCategoryLabel}
          browseLabel={t.ui.browse}
          searchListingsForLabel={t.ui.searchListingsFor}
        />
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && !showChat && (
        <SuggestionsDropdown
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          query={query}
          isLoadingSuggestions={isLoadingSuggestions}
          recentSearches={recentSearches}
          onSelect={handleSearch}
          onClearRecent={handleClearRecent}
          suggestionsLabel={t.ui.suggestions}
          trySearchingLabel={t.ui.trySearching}
        />
      )}

      {/* Language hint - shows supported languages */}
      {showLanguageHint && !showSuggestions && !showChat && (
        <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          <Sparkles className="w-3 h-3" />
          <span>Axlon speaks:</span>
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
