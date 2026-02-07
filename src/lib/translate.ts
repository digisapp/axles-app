import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { cacheGet, cacheSet } from './cache/redis';
import { logger } from '@/lib/logger';

// Extend cache keys and TTL for translations
const TRANSLATION_CACHE_KEY = 'translate:';
const TRANSLATION_TTL = 60 * 60 * 24; // 24 hours

// Supported languages for translation
export const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'ru',
  'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'hi', 'he', 'sv'
] as const;

export type TranslationLanguage = typeof SUPPORTED_LANGUAGES[number];

interface TranslationResult {
  title: string;
  description: string;
  fromCache: boolean;
}

interface ListingToTranslate {
  id: string;
  title: string;
  description?: string | null;
}

function getXai() {
  if (!process.env.XAI_API_KEY) {
    return null;
  }
  return createXai({
    apiKey: process.env.XAI_API_KEY,
  });
}

/**
 * Generate a cache key for a translation
 */
function getTranslationCacheKey(listingId: string, targetLang: string): string {
  return `${TRANSLATION_CACHE_KEY}${listingId}:${targetLang}`;
}

/**
 * Translate a single listing's title and description
 */
export async function translateListing(
  listing: ListingToTranslate,
  targetLang: TranslationLanguage
): Promise<TranslationResult | null> {
  // Don't translate to English - that's the source
  if (targetLang === 'en') {
    return {
      title: listing.title,
      description: listing.description || '',
      fromCache: false,
    };
  }

  const cacheKey = getTranslationCacheKey(listing.id, targetLang);

  // Check cache first
  const cached = await cacheGet<{ title: string; description: string }>(cacheKey);
  if (cached) {
    return {
      ...cached,
      fromCache: true,
    };
  }

  // Get xAI client
  const xai = getXai();
  if (!xai) {
    // Return original if no API key
    return {
      title: listing.title,
      description: listing.description || '',
      fromCache: false,
    };
  }

  try {
    // Translate using Grok
    const { text } = await generateText({
      model: xai('grok-2-latest'),
      prompt: `Translate the following truck/trailer listing to ${getLanguageName(targetLang)}.
Keep it natural and professional. Preserve any technical terms, brand names, measurements, and numbers.
Return ONLY a JSON object with "title" and "description" keys, no other text.

Title: ${listing.title}
Description: ${listing.description || 'No description'}

JSON output:`,
    });

    // Parse the response
    let translated: { title: string; description: string };
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        translated = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // If parsing fails, return original
      logger.error('Translation parse error', { text });
      return {
        title: listing.title,
        description: listing.description || '',
        fromCache: false,
      };
    }

    // Cache the translation
    await cacheSet(cacheKey, translated, TRANSLATION_TTL);

    return {
      ...translated,
      fromCache: false,
    };
  } catch (error) {
    logger.error('Translation error', { error });
    return {
      title: listing.title,
      description: listing.description || '',
      fromCache: false,
    };
  }
}

/**
 * Translate multiple listings at once (batched for efficiency)
 */
export async function translateListings(
  listings: ListingToTranslate[],
  targetLang: TranslationLanguage
): Promise<Map<string, TranslationResult>> {
  const results = new Map<string, TranslationResult>();

  // Don't translate to English
  if (targetLang === 'en') {
    listings.forEach(listing => {
      results.set(listing.id, {
        title: listing.title,
        description: listing.description || '',
        fromCache: false,
      });
    });
    return results;
  }

  // Check cache for all listings first
  const cacheKeys = listings.map(l => getTranslationCacheKey(l.id, targetLang));
  const uncachedListings: ListingToTranslate[] = [];

  for (let i = 0; i < listings.length; i++) {
    const cached = await cacheGet<{ title: string; description: string }>(cacheKeys[i]);
    if (cached) {
      results.set(listings[i].id, { ...cached, fromCache: true });
    } else {
      uncachedListings.push(listings[i]);
    }
  }

  // Translate uncached listings (in parallel with limit)
  const BATCH_SIZE = 5;
  for (let i = 0; i < uncachedListings.length; i += BATCH_SIZE) {
    const batch = uncachedListings.slice(i, i + BATCH_SIZE);
    const translations = await Promise.all(
      batch.map(listing => translateListing(listing, targetLang))
    );

    batch.forEach((listing, idx) => {
      if (translations[idx]) {
        results.set(listing.id, translations[idx]!);
      }
    });
  }

  return results;
}

/**
 * Get full language name for prompts
 */
function getLanguageName(code: TranslationLanguage): string {
  const names: Record<TranslationLanguage, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    zh: 'Chinese (Simplified)',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    ru: 'Russian',
    it: 'Italian',
    nl: 'Dutch',
    pl: 'Polish',
    tr: 'Turkish',
    vi: 'Vietnamese',
    th: 'Thai',
    id: 'Indonesian',
    hi: 'Hindi',
    he: 'Hebrew',
    sv: 'Swedish',
  };
  return names[code] || 'English';
}

/**
 * Detect language from browser Accept-Language header or navigator
 */
export function detectLanguage(acceptLanguage?: string): TranslationLanguage {
  if (!acceptLanguage) {
    return 'en';
  }

  // Parse Accept-Language header (e.g., "es-ES,es;q=0.9,en;q=0.8")
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code] = lang.trim().split(';');
      return code.split('-')[0].toLowerCase();
    });

  // Find first supported language
  for (const lang of languages) {
    if (SUPPORTED_LANGUAGES.includes(lang as TranslationLanguage)) {
      return lang as TranslationLanguage;
    }
  }

  return 'en';
}

/**
 * Check if a language needs translation (not English)
 */
export function needsTranslation(lang: TranslationLanguage): boolean {
  return lang !== 'en';
}
