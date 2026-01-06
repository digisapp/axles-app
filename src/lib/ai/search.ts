import { createXai } from '@ai-sdk/xai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { AISearchResult, SearchFilters } from '@/types';

// Lazy initialization to avoid build-time errors
function getXai() {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }
  return createXai({
    apiKey: process.env.XAI_API_KEY,
  });
}

const searchFiltersSchema = z.object({
  category_slug: z.string().optional().describe('Category slug like "heavy-duty-trucks", "dry-van-trailers", "excavators"'),
  min_price: z.number().optional().describe('Minimum price in dollars'),
  max_price: z.number().optional().describe('Maximum price in dollars'),
  min_year: z.number().optional().describe('Minimum year (e.g., 2018)'),
  max_year: z.number().optional().describe('Maximum year (e.g., 2024)'),
  make: z.string().optional().describe('Manufacturer like "Peterbilt", "Freightliner", "Kenworth", "Volvo", "Mack"'),
  model: z.string().optional().describe('Model name like "579", "Cascadia", "W900"'),
  condition: z.array(z.enum(['new', 'used', 'certified', 'salvage'])).optional(),
  state: z.string().optional().describe('US state code like "TX", "CA", "FL"'),
  city: z.string().optional(),
  max_mileage: z.number().optional().describe('Maximum mileage in miles'),
});

const searchResultSchema = z.object({
  interpretation: z.string().describe('Human-readable interpretation of what the user is searching for'),
  filters: searchFiltersSchema,
  suggested_categories: z.array(z.string()).optional().describe('Suggested category slugs if query is ambiguous'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0 to 1'),
});

export async function parseSearchQuery(query: string): Promise<AISearchResult> {
  const xai = getXai();

  const { object } = await generateObject({
    model: xai('grok-2-latest'),
    schema: searchResultSchema,
    prompt: `You are an AI assistant for AxlesAI, a marketplace for buying and selling trucks, trailers, and heavy equipment.

Parse the following natural language search query and extract structured search filters.

Available categories:
- Trucks: heavy-duty-trucks, medium-duty-trucks, light-duty-trucks, day-cab-trucks, sleeper-trucks, dump-trucks, box-trucks, flatbed-trucks, tow-trucks, tanker-trucks, garbage-trucks, fire-trucks
- Trailers: dry-van-trailers, reefer-trailers, flatbed-trailers, lowboy-trailers, drop-deck-trailers, tank-trailers, dump-trailers, livestock-trailers, car-hauler-trailers, utility-trailers
- Heavy Equipment: excavators, bulldozers, loaders, cranes, forklifts, backhoes
- Components: engines, transmissions, axles, tires-wheels

Common truck manufacturers: Peterbilt, Freightliner, Kenworth, Volvo, Mack, International, Western Star, Navistar

User Query: "${query}"

Extract the search intent and return structured filters. Be smart about interpreting:
- "semi" or "18-wheeler" = heavy-duty-trucks or sleeper-trucks
- "rig" = heavy-duty-trucks
- "under 100k" = max_price: 100000
- "in Texas" or "TX" = state: "TX"
- Price ranges like "$50,000-$80,000" = min_price: 50000, max_price: 80000
- Year ranges like "2018-2022" = min_year: 2018, max_year: 2022
- "low miles" or "under 500k miles" = max_mileage: 500000`,
  });

  return {
    query,
    interpretation: object.interpretation,
    filters: object.filters as SearchFilters,
    suggested_categories: object.suggested_categories,
    confidence: object.confidence,
  };
}

export async function generateSearchSuggestions(partialQuery: string): Promise<string[]> {
  if (partialQuery.length < 2) return [];

  try {
    const xai = getXai();

    const { object } = await generateObject({
      model: xai('grok-2-latest'),
      schema: z.object({
        suggestions: z.array(z.string()).max(5),
      }),
      prompt: `You are helping users search for trucks, trailers, and heavy equipment on AxlesAI.

Based on this partial search query, suggest 5 relevant completions:
"${partialQuery}"

Suggestions should be realistic searches like:
- "2020 Peterbilt 579 sleeper"
- "Freightliner Cascadia under $80,000"
- "Reefer trailer 53ft"
- "Used dump trucks in Texas"
- "Kenworth W900 low miles"

Return natural, complete search phrases.`,
    });

    return object.suggestions;
  } catch {
    return [];
  }
}
