'use client';

import { useMemo } from 'react';
import { detectLocale, getTranslations, type SearchTranslations, type SupportedLocale } from './translations';

// Helper to get the locale (client-side only)
function getInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  return detectLocale();
}

export function useSearchTranslations() {
  const locale = useMemo<SupportedLocale>(() => getInitialLocale(), []);
  const translations = useMemo<SearchTranslations>(() => getTranslations(locale), [locale]);

  return { translations, locale };
}
