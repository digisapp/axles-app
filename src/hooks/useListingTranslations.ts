'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { detectLocale, type SupportedLocale } from '@/lib/i18n';

interface TranslationResult {
  title: string;
  description: string;
  fromCache: boolean;
}

interface ListingForTranslation {
  id: string;
  title: string;
  description?: string | null;
}

interface UseListingTranslationsOptions {
  enabled?: boolean;
}

export function useListingTranslations(
  listings: ListingForTranslation[],
  options: UseListingTranslationsOptions = {}
) {
  const { enabled = true } = options;
  const [translations, setTranslations] = useState<Map<string, TranslationResult>>(new Map());
  const [isTranslating, setIsTranslating] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>('en');
  const [error, setError] = useState<string | null>(null);

  // Track which listings we've already requested to avoid duplicate fetches
  const requestedIdsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect locale on mount
  useEffect(() => {
    const detectedLocale = detectLocale();
    setLocale(detectedLocale);
  }, []);

  // Translate listings when they change
  useEffect(() => {
    // Skip if disabled, English, or no listings
    if (!enabled || locale === 'en' || listings.length === 0) {
      return;
    }

    // Find listings that need translation (not already translated or requested)
    const needsTranslation = listings.filter(
      (l) => !translations.has(l.id) && !requestedIdsRef.current.has(l.id)
    );

    if (needsTranslation.length === 0) {
      return;
    }

    // Mark these as requested
    needsTranslation.forEach((l) => requestedIdsRef.current.add(l.id));

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const translateListings = async () => {
      setIsTranslating(true);
      setError(null);

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listings: needsTranslation.map((l) => ({
              id: l.id,
              title: l.title,
              description: l.description,
            })),
            targetLang: locale,
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error('Translation request failed');
        }

        const data = await response.json();

        // Merge new translations with existing ones
        setTranslations((prev) => {
          const next = new Map(prev);
          for (const [id, translation] of Object.entries(data.translations)) {
            next.set(id, translation as TranslationResult);
          }
          return next;
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, ignore
          return;
        }
        console.error('Translation error:', err);
        setError('Failed to translate listings');
        // Remove from requested set so we can retry
        needsTranslation.forEach((l) => requestedIdsRef.current.delete(l.id));
      } finally {
        setIsTranslating(false);
      }
    };

    translateListings();
  }, [listings, locale, enabled, translations]);

  // Get translated content for a listing
  const getTranslatedListing = useCallback(
    (listing: ListingForTranslation) => {
      if (locale === 'en') {
        return {
          title: listing.title,
          description: listing.description || '',
          isTranslated: false,
        };
      }

      const translation = translations.get(listing.id);
      if (translation) {
        return {
          title: translation.title,
          description: translation.description,
          isTranslated: true,
          fromCache: translation.fromCache,
        };
      }

      // Return original while loading
      return {
        title: listing.title,
        description: listing.description || '',
        isTranslated: false,
      };
    },
    [locale, translations]
  );

  // Clear translations (useful when search changes)
  const clearTranslations = useCallback(() => {
    setTranslations(new Map());
    requestedIdsRef.current.clear();
  }, []);

  return {
    locale,
    isTranslating,
    error,
    getTranslatedListing,
    clearTranslations,
    needsTranslation: locale !== 'en',
  };
}
