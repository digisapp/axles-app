import { createXai } from '@ai-sdk/xai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { AISearchResult, SearchFilters } from '@/types';

// Known makes for trucks and trailers
const TRUCK_MAKES = [
  'peterbilt', 'freightliner', 'kenworth', 'volvo', 'mack', 'international',
  'western star', 'navistar', 'hino', 'isuzu', 'ford', 'chevrolet', 'gmc'
];

const TRAILER_MAKES = [
  'wabash', 'great dane', 'utility', 'vanguard', 'hyundai', 'stoughton',
  'fontaine', 'trail king', 'kentucky', 'wilson', 'reitnouer', 'east',
  'manac', 'mac', 'talbert', 'felling', 'landoll', 'xl specialized',
  'dorsey', 'eager beaver', 'smithco', 'ranco'
];

// Category keywords mapping
const CATEGORY_KEYWORDS: Record<string, string> = {
  // Trucks
  'semi': 'heavy-duty-trucks',
  'semi truck': 'heavy-duty-trucks',
  '18 wheeler': 'heavy-duty-trucks',
  '18-wheeler': 'heavy-duty-trucks',
  'sleeper': 'sleeper-trucks',
  'day cab': 'day-cab-trucks',
  'daycab': 'day-cab-trucks',
  'dump truck': 'dump-trucks',
  'box truck': 'box-trucks',
  'flatbed truck': 'flatbed-trucks',
  'tow truck': 'tow-trucks',
  'rollback': 'rollback-trucks',
  'tanker truck': 'tanker-trucks',
  // Trailers
  'dry van': 'dry-van-trailers',
  'reefer': 'reefer-trailers',
  'refrigerated': 'reefer-trailers',
  'flatbed trailer': 'flatbed-trailers',
  'flatbed': 'flatbed-trailers',
  'lowboy': 'lowboy-trailers',
  'low boy': 'lowboy-trailers',
  'drop deck': 'drop-deck-trailers',
  'step deck': 'step-deck-trailers',
  'tank trailer': 'tank-trailers',
  'dump trailer': 'dump-trailers',
  'end dump': 'dump-trailers',
  'livestock': 'livestock-trailers',
  'car hauler': 'car-hauler-trailers',
  'car carrier': 'car-hauler-trailers',
  'utility trailer': 'utility-trailers',
  'tag trailer': 'tag-trailers',
  'live floor': 'live-floor-trailers',
  'walking floor': 'live-floor-trailers',
  // Equipment
  'excavator': 'excavators',
  'bulldozer': 'bulldozers',
  'loader': 'loaders',
  'crane': 'cranes',
  'forklift': 'forklifts',
  'backhoe': 'backhoes',
};

// State abbreviations
const STATE_NAMES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY'
};

/**
 * Fallback parser that works without AI API
 * Parses common search patterns like "peterbilt under 100k"
 */
function parseSearchQueryFallback(query: string): AISearchResult {
  const queryLower = query.toLowerCase().trim();
  const filters: SearchFilters = {};
  const interpretationParts: string[] = [];

  // Parse price with "k" suffix (e.g., "100k", "$100k", "under 100k")
  const priceKMatch = queryLower.match(/(?:under|below|less than|max|<)?\s*\$?(\d+)k\b/i);
  if (priceKMatch) {
    const price = parseInt(priceKMatch[1]) * 1000;
    if (queryLower.includes('under') || queryLower.includes('below') || queryLower.includes('less than') || queryLower.includes('max')) {
      filters.max_price = price;
      interpretationParts.push(`under $${price.toLocaleString()}`);
    } else if (queryLower.includes('over') || queryLower.includes('above') || queryLower.includes('min')) {
      filters.min_price = price;
      interpretationParts.push(`over $${price.toLocaleString()}`);
    } else {
      // Default to max price if just "100k" is mentioned
      filters.max_price = price;
      interpretationParts.push(`under $${price.toLocaleString()}`);
    }
  }

  // Parse full price (e.g., "$100,000", "under $100000")
  const priceFullMatch = queryLower.match(/(?:under|below|less than|max|<)?\s*\$?([\d,]+)(?:\s*dollars?)?/i);
  if (!priceKMatch && priceFullMatch) {
    const price = parseInt(priceFullMatch[1].replace(/,/g, ''));
    if (price >= 1000) { // Only consider as price if >= $1000
      if (queryLower.includes('under') || queryLower.includes('below')) {
        filters.max_price = price;
        interpretationParts.push(`under $${price.toLocaleString()}`);
      }
    }
  }

  // Parse year (e.g., "2020", "2018-2022")
  const yearRangeMatch = queryLower.match(/(\d{4})\s*[-–to]+\s*(\d{4})/);
  if (yearRangeMatch) {
    filters.min_year = parseInt(yearRangeMatch[1]);
    filters.max_year = parseInt(yearRangeMatch[2]);
    interpretationParts.push(`${filters.min_year}-${filters.max_year}`);
  } else {
    const yearMatch = queryLower.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      // If "newer than" or "after", use as min year
      if (queryLower.includes('newer') || queryLower.includes('after')) {
        filters.min_year = year;
      } else {
        // Default: exact year or starting year
        filters.min_year = year;
      }
      interpretationParts.push(`${year}`);
    }
  }

  // Parse truck makes
  for (const make of TRUCK_MAKES) {
    if (queryLower.includes(make)) {
      filters.make = make.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      interpretationParts.unshift(filters.make);
      // If a truck make is found, default to trucks category
      if (!filters.category_slug) {
        filters.category_slug = 'trucks';
      }
      break;
    }
  }

  // Parse trailer makes
  if (!filters.make) {
    for (const make of TRAILER_MAKES) {
      if (queryLower.includes(make)) {
        filters.make = make.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        interpretationParts.unshift(filters.make);
        if (!filters.category_slug) {
          filters.category_slug = 'trailers';
        }
        break;
      }
    }
  }

  // Parse category keywords
  for (const [keyword, slug] of Object.entries(CATEGORY_KEYWORDS)) {
    if (queryLower.includes(keyword)) {
      filters.category_slug = slug;
      if (!interpretationParts.some(p => p.toLowerCase().includes(keyword))) {
        interpretationParts.push(keyword);
      }
      break;
    }
  }

  // Parse state
  // Check for state abbreviations like "TX", "CA"
  const stateAbbrMatch = queryLower.match(/\b(in|from|near)\s+([a-z]{2})\b/i) ||
                         queryLower.match(/\b([a-z]{2})\s+(area|region)?\b/i);
  if (stateAbbrMatch) {
    const stateAbbr = stateAbbrMatch[2]?.toUpperCase() || stateAbbrMatch[1]?.toUpperCase();
    if (Object.values(STATE_NAMES).includes(stateAbbr)) {
      filters.state = stateAbbr;
      interpretationParts.push(`in ${stateAbbr}`);
    }
  }

  // Check for full state names
  for (const [stateName, stateAbbr] of Object.entries(STATE_NAMES)) {
    if (queryLower.includes(stateName) || queryLower.includes(`in ${stateName}`)) {
      filters.state = stateAbbr;
      interpretationParts.push(`in ${stateName.charAt(0).toUpperCase() + stateName.slice(1)}`);
      break;
    }
  }

  // Parse condition
  if (queryLower.includes('new') && !queryLower.includes('newer')) {
    filters.condition = ['new'];
    interpretationParts.push('new');
  } else if (queryLower.includes('used')) {
    filters.condition = ['used'];
    interpretationParts.push('used');
  }

  // Parse mileage
  const mileageMatch = queryLower.match(/(?:under|below|less than|max)?\s*(\d+)k?\s*miles?/i);
  if (mileageMatch) {
    let mileage = parseInt(mileageMatch[1]);
    if (queryLower.includes('k miles') || queryLower.includes('k mile')) {
      mileage *= 1000;
    }
    filters.max_mileage = mileage;
    interpretationParts.push(`under ${mileage.toLocaleString()} miles`);
  }

  // Build interpretation
  let interpretation = 'Searching for ';
  if (interpretationParts.length > 0) {
    interpretation += interpretationParts.join(' ');
  } else {
    interpretation += query;
  }

  // Calculate confidence based on how many filters were extracted
  const filterCount = Object.keys(filters).length;
  const confidence = Math.min(0.95, 0.5 + (filterCount * 0.15));

  return {
    query,
    interpretation,
    filters,
    confidence,
  };
}

// Lazy initialization to avoid build-time errors
function getXai() {
  if (!process.env.XAI_API_KEY) {
    return null; // Return null instead of throwing
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

  // Use fallback parser if XAI is not configured
  if (!xai) {
    console.log('XAI not configured, using fallback parser');
    return parseSearchQueryFallback(query);
  }

  try {
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
- "trailers" alone = use category_slug "trailers" (parent category for all trailer types)
- "trucks" alone = use category_slug "trucks" (parent category for all truck types)
- IMPORTANT: Price parsing with "k" suffix:
  - "$100k" or "100k" = 100000 (k = thousand, so multiply by 1000)
  - "under $100k" = max_price: 100000
  - "$50k-$80k" = min_price: 50000, max_price: 80000
  - "under 100k" = max_price: 100000
- Price parsing with full numbers:
  - "$50,000-$80,000" = min_price: 50000, max_price: 80000
  - "under $100,000" = max_price: 100000
- "in Texas" or "TX" = state: "TX"
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
  } catch (error) {
    console.error('XAI search failed, using fallback:', error);
    return parseSearchQueryFallback(query);
  }
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
