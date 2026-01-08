import { createClient } from '@/lib/supabase/server';
import {
  cacheGet,
  cacheSet,
  generatePriceCacheKey,
  CACHE_TTL,
  isRedisConfigured,
} from '@/lib/cache';

interface PriceEstimate {
  estimate: number | null;
  confidence: number; // 0-1
  comparableCount: number;
  comparables: {
    id: string;
    title: string;
    price: number;
    year: number | null;
    make: string | null;
  }[];
  method: 'exact_match' | 'category_match' | 'no_match';
}

interface ListingForEstimate {
  id: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  category_id?: string | null;
  mileage?: number | null;
  condition?: string | null;
}

/**
 * Estimate price for a listing by comparing to similar listings in the database
 */
export async function estimatePrice(listing: ListingForEstimate): Promise<PriceEstimate> {
  // Check cache first
  if (isRedisConfigured()) {
    const cacheKey = generatePriceCacheKey({
      make: listing.make || undefined,
      model: listing.model || undefined,
      year: listing.year || undefined,
      condition: listing.condition || undefined,
      mileage: listing.mileage || undefined,
      category_id: listing.category_id || undefined,
    }) + ':db'; // Add suffix to differentiate from AI estimates

    const cached = await cacheGet<PriceEstimate>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const supabase = await createClient();

  // Try to find exact matches first (same make, similar year)
  if (listing.make && listing.year) {
    const { data: exactMatches } = await supabase
      .from('listings')
      .select('id, title, price, year, make')
      .eq('status', 'active')
      .not('price', 'is', null)
      .gt('price', 0)
      .ilike('make', `%${listing.make}%`)
      .gte('year', listing.year - 3)
      .lte('year', listing.year + 3)
      .neq('id', listing.id)
      .limit(20);

    if (exactMatches && exactMatches.length >= 3) {
      const prices = exactMatches.map(l => l.price!).sort((a, b) => a - b);
      const median = calculateMedian(prices);
      const confidence = Math.min(1, 0.5 + (exactMatches.length * 0.05));

      const result: PriceEstimate = {
        estimate: Math.round(median),
        confidence,
        comparableCount: exactMatches.length,
        comparables: exactMatches.slice(0, 5),
        method: 'exact_match',
      };

      // Cache the result
      if (isRedisConfigured()) {
        const cacheKey = generatePriceCacheKey({
          make: listing.make || undefined,
          model: listing.model || undefined,
          year: listing.year || undefined,
          condition: listing.condition || undefined,
          mileage: listing.mileage || undefined,
          category_id: listing.category_id || undefined,
        }) + ':db';
        await cacheSet(cacheKey, result, CACHE_TTL.PRICE_ESTIMATE);
      }

      return result;
    }
  }

  // Fall back to category match
  if (listing.category_id) {
    // Get the category and its parent/children
    const { data: category } = await supabase
      .from('categories')
      .select('id, parent_id')
      .eq('id', listing.category_id)
      .single();

    let categoryIds = [listing.category_id];

    if (category) {
      if (category.parent_id) {
        // This is a child category - also search siblings
        const { data: siblings } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', category.parent_id);
        if (siblings) {
          categoryIds = siblings.map(s => s.id);
        }
      } else {
        // This is a parent category - search children
        const { data: children } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', category.id);
        if (children) {
          categoryIds = [category.id, ...children.map(c => c.id)];
        }
      }
    }

    let query = supabase
      .from('listings')
      .select('id, title, price, year, make')
      .eq('status', 'active')
      .not('price', 'is', null)
      .gt('price', 0)
      .in('category_id', categoryIds)
      .neq('id', listing.id);

    // Add year filter if available
    if (listing.year) {
      query = query.gte('year', listing.year - 5).lte('year', listing.year + 5);
    }

    const { data: categoryMatches } = await query.limit(30);

    if (categoryMatches && categoryMatches.length >= 2) {
      const prices = categoryMatches.map(l => l.price!).sort((a, b) => a - b);
      const median = calculateMedian(prices);
      // Lower confidence for category-only matches
      const confidence = Math.min(0.7, 0.3 + (categoryMatches.length * 0.03));

      const result: PriceEstimate = {
        estimate: Math.round(median),
        confidence,
        comparableCount: categoryMatches.length,
        comparables: categoryMatches.slice(0, 5),
        method: 'category_match',
      };

      // Cache the result
      if (isRedisConfigured()) {
        const cacheKey = generatePriceCacheKey({
          make: listing.make || undefined,
          model: listing.model || undefined,
          year: listing.year || undefined,
          condition: listing.condition || undefined,
          mileage: listing.mileage || undefined,
          category_id: listing.category_id || undefined,
        }) + ':db';
        await cacheSet(cacheKey, result, CACHE_TTL.PRICE_ESTIMATE);
      }

      return result;
    }
  }

  // No good comparables found - don't cache this as data might change
  return {
    estimate: null,
    confidence: 0,
    comparableCount: 0,
    comparables: [],
    method: 'no_match',
  };
}

/**
 * Calculate median of an array of numbers
 */
function calculateMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Update a listing with its price estimate
 */
export async function updateListingEstimate(listingId: string): Promise<PriceEstimate> {
  const supabase = await createClient();

  // Get the listing
  const { data: listing } = await supabase
    .from('listings')
    .select('id, make, model, year, category_id, mileage, condition')
    .eq('id', listingId)
    .single();

  if (!listing) {
    throw new Error('Listing not found');
  }

  // Get estimate
  const estimate = await estimatePrice(listing);

  // Update the listing if we have an estimate
  if (estimate.estimate !== null) {
    await supabase
      .from('listings')
      .update({
        ai_price_estimate: estimate.estimate,
        ai_price_confidence: estimate.confidence,
      })
      .eq('id', listingId);
  }

  return estimate;
}

/**
 * Batch update estimates for listings missing them
 */
export async function backfillEstimates(limit: number = 100): Promise<{
  processed: number;
  updated: number;
  skipped: number;
}> {
  const supabase = await createClient();

  // Find listings with price but no estimate
  const { data: listings } = await supabase
    .from('listings')
    .select('id, make, model, year, category_id, mileage, condition, price')
    .eq('status', 'active')
    .not('price', 'is', null)
    .gt('price', 0)
    .is('ai_price_estimate', null)
    .limit(limit);

  if (!listings || listings.length === 0) {
    return { processed: 0, updated: 0, skipped: 0 };
  }

  let updated = 0;
  let skipped = 0;

  for (const listing of listings) {
    const estimate = await estimatePrice(listing);

    if (estimate.estimate !== null && estimate.confidence >= 0.3) {
      await supabase
        .from('listings')
        .update({
          ai_price_estimate: estimate.estimate,
          ai_price_confidence: estimate.confidence,
        })
        .eq('id', listing.id);
      updated++;
    } else {
      skipped++;
    }
  }

  return {
    processed: listings.length,
    updated,
    skipped,
  };
}
