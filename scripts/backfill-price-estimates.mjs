#!/usr/bin/env node

/**
 * Backfill price estimates for all listings
 *
 * Usage: node scripts/backfill-price-estimates.mjs
 *
 * This script:
 * 1. Finds listings with a price but no ai_price_estimate
 * 2. Compares each to similar listings in the database
 * 3. Sets ai_price_estimate and ai_price_confidence
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function calculateMedian(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function estimatePrice(listing) {
  // Try exact match (same make, similar year)
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
      const prices = exactMatches.map(l => l.price).sort((a, b) => a - b);
      const median = calculateMedian(prices);
      const confidence = Math.min(1, 0.5 + (exactMatches.length * 0.05));

      return {
        estimate: Math.round(median),
        confidence,
        comparableCount: exactMatches.length,
        method: 'exact_match',
      };
    }
  }

  // Fall back to category match
  if (listing.category_id) {
    const { data: category } = await supabase
      .from('categories')
      .select('id, parent_id')
      .eq('id', listing.category_id)
      .single();

    let categoryIds = [listing.category_id];

    if (category) {
      if (category.parent_id) {
        const { data: siblings } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', category.parent_id);
        if (siblings) {
          categoryIds = siblings.map(s => s.id);
        }
      } else {
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

    if (listing.year) {
      query = query.gte('year', listing.year - 5).lte('year', listing.year + 5);
    }

    const { data: categoryMatches } = await query.limit(30);

    if (categoryMatches && categoryMatches.length >= 2) {
      const prices = categoryMatches.map(l => l.price).sort((a, b) => a - b);
      const median = calculateMedian(prices);
      const confidence = Math.min(0.7, 0.3 + (categoryMatches.length * 0.03));

      return {
        estimate: Math.round(median),
        confidence,
        comparableCount: categoryMatches.length,
        method: 'category_match',
      };
    }
  }

  return {
    estimate: null,
    confidence: 0,
    comparableCount: 0,
    method: 'no_match',
  };
}

async function main() {
  console.log('🔍 Finding listings that need price estimates...\n');

  // Find listings with price but no estimate
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, make, model, year, category_id, mileage, condition, price')
    .eq('status', 'active')
    .not('price', 'is', null)
    .gt('price', 0)
    .is('ai_price_estimate', null)
    .limit(500);

  if (error) {
    console.error('Error fetching listings:', error);
    process.exit(1);
  }

  if (!listings || listings.length === 0) {
    console.log('✅ No listings need price estimates!');
    return;
  }

  console.log(`Found ${listings.length} listings to process\n`);

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    process.stdout.write(`\r[${i + 1}/${listings.length}] Processing: ${listing.title?.slice(0, 40)}...`);

    const estimate = await estimatePrice(listing);

    if (estimate.estimate !== null && estimate.confidence >= 0.3) {
      const { error: updateError } = await supabase
        .from('listings')
        .update({
          ai_price_estimate: estimate.estimate,
          ai_price_confidence: estimate.confidence,
        })
        .eq('id', listing.id);

      if (!updateError) {
        updated++;
      }
    } else {
      skipped++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50));
  }

  console.log('\n\n✅ Done!');
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped} (not enough comparables)`);
}

main().catch(console.error);
