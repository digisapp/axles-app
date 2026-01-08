import { NextRequest, NextResponse } from 'next/server';
import { translateListings, detectLanguage, needsTranslation, type TranslationLanguage } from '@/lib/translate';

export async function POST(request: NextRequest) {
  try {
    const { listings, targetLang } = await request.json();

    if (!listings || !Array.isArray(listings)) {
      return NextResponse.json(
        { error: 'listings array is required' },
        { status: 400 }
      );
    }

    // Use provided language or detect from header
    const language = (targetLang as TranslationLanguage) ||
      detectLanguage(request.headers.get('accept-language') || undefined);

    // If English, return original listings
    if (!needsTranslation(language)) {
      const result: Record<string, { title: string; description: string }> = {};
      listings.forEach((listing: { id: string; title: string; description?: string }) => {
        result[listing.id] = {
          title: listing.title,
          description: listing.description || '',
        };
      });
      return NextResponse.json({ translations: result, language: 'en', fromCache: false });
    }

    // Translate listings
    const translations = await translateListings(
      listings.map((l: { id: string; title: string; description?: string }) => ({
        id: l.id,
        title: l.title,
        description: l.description,
      })),
      language
    );

    // Convert Map to object for JSON response
    const result: Record<string, { title: string; description: string; fromCache: boolean }> = {};
    let allFromCache = true;

    translations.forEach((value, key) => {
      result[key] = value;
      if (!value.fromCache) allFromCache = false;
    });

    return NextResponse.json({
      translations: result,
      language,
      fromCache: allFromCache,
    });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
