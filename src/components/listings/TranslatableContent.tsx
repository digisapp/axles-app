'use client';

import { useState, useEffect } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { detectLocale, type SupportedLocale } from '@/lib/i18n';

interface TranslatableContentProps {
  listingId: string;
  originalTitle: string;
  originalDescription: string | null;
  className?: string;
}

interface TranslationResult {
  title: string;
  description: string;
  fromCache: boolean;
}

export function TranslatableTitle({
  listingId,
  originalTitle,
  className,
}: Pick<TranslatableContentProps, 'listingId' | 'originalTitle' | 'className'>) {
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>('en');

  useEffect(() => {
    const detectedLocale = detectLocale();
    setLocale(detectedLocale);

    // Skip if English
    if (detectedLocale === 'en') return;

    const translateTitle = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listings: [{ id: listingId, title: originalTitle, description: '' }],
            targetLang: detectedLocale,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const translation = data.translations?.[listingId];
          if (translation?.title) {
            setTranslatedTitle(translation.title);
          }
        }
      } catch (error) {
        console.error('Translation error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    translateTitle();
  }, [listingId, originalTitle]);

  const displayTitle = translatedTitle || originalTitle;
  const isTranslated = locale !== 'en' && translatedTitle !== null;

  return (
    <span className={className}>
      {displayTitle}
      {isLoading && (
        <Loader2 className="inline-block w-4 h-4 ml-2 animate-spin text-muted-foreground" />
      )}
      {isTranslated && !isLoading && (
        <span title="Translated" className="inline-block ml-2">
          <Languages className="w-4 h-4 text-muted-foreground" />
        </span>
      )}
    </span>
  );
}

export function TranslatableDescription({
  listingId,
  originalTitle,
  originalDescription,
  className,
}: TranslatableContentProps) {
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locale, setLocale] = useState<SupportedLocale>('en');

  useEffect(() => {
    const detectedLocale = detectLocale();
    setLocale(detectedLocale);

    // Skip if English or no description
    if (detectedLocale === 'en' || !originalDescription) return;

    const translateDescription = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listings: [{ id: listingId, title: originalTitle, description: originalDescription }],
            targetLang: detectedLocale,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const translation = data.translations?.[listingId];
          if (translation?.description) {
            setTranslatedDescription(translation.description);
          }
        }
      } catch (error) {
        console.error('Translation error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    translateDescription();
  }, [listingId, originalTitle, originalDescription]);

  const displayDescription = translatedDescription || originalDescription;
  const isTranslated = locale !== 'en' && translatedDescription !== null;

  if (!displayDescription) return null;

  return (
    <div className={className}>
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Translating...</span>
        </div>
      )}
      <p className="whitespace-pre-wrap">{displayDescription}</p>
      {isTranslated && !isLoading && (
        <div className="flex items-center gap-1 text-muted-foreground mt-2 text-xs">
          <Languages className="w-3 h-3" />
          <span>Translated</span>
        </div>
      )}
    </div>
  );
}
