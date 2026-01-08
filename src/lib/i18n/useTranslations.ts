'use client';

import { useState, useEffect } from 'react';
import { detectLocale, getTranslations, type SearchTranslations, type SupportedLocale } from './translations';

export function useSearchTranslations() {
  const [translations, setTranslations] = useState<SearchTranslations>(() => getTranslations('en'));
  const [locale, setLocale] = useState<SupportedLocale>('en');

  useEffect(() => {
    const detectedLocale = detectLocale();
    setLocale(detectedLocale);
    setTranslations(getTranslations(detectedLocale));
  }, []);

  return { translations, locale };
}
