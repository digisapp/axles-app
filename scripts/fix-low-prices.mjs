#!/usr/bin/env node

/**
 * Fix unrealistically low prices
 *
 * Any truck/trailer priced under $15,000 is likely bad data.
 * This script replaces those with the AI estimate or sets to "Call for Price"
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

const MIN_REALISTIC_PRICE = 15000;

async function main() {
  console.log(`Finding listings with price < $${MIN_REALISTIC_PRICE.toLocaleString()}...\n`);

  // Find listings with suspiciously low prices
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, price, ai_price_estimate, make, year')
    .eq('status', 'active')
    .not('price', 'is', null)
    .gt('price', 0)
    .lt('price', MIN_REALISTIC_PRICE);

  if (error) {
    console.error('Error fetching listings:', error);
    process.exit(1);
  }

  if (!listings || listings.length === 0) {
    console.log('No listings found with unrealistic prices.');
    return;
  }

  console.log(`Found ${listings.length} listings with low prices:\n`);

  let useEstimate = 0;
  let setCallForPrice = 0;

  for (const listing of listings) {
    const oldPrice = listing.price;
    let newPrice = null;
    let action = '';

    // If we have a reasonable AI estimate, use it
    if (listing.ai_price_estimate && listing.ai_price_estimate >= MIN_REALISTIC_PRICE) {
      newPrice = listing.ai_price_estimate;
      action = `Use estimate: $${newPrice.toLocaleString()}`;
      useEstimate++;
    } else {
      // Otherwise set to null (Call for Price)
      newPrice = null;
      action = 'Set to Call for Price';
      setCallForPrice++;
    }

    console.log(`${listing.title?.slice(0, 50)}`);
    console.log(`  Was: $${oldPrice.toLocaleString()} → ${action}`);

    // Update the listing
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        price: newPrice,
        // Clear the estimate if we used it as the price
        ai_price_estimate: newPrice ? null : listing.ai_price_estimate,
        ai_price_confidence: newPrice ? null : undefined,
      })
      .eq('id', listing.id);

    if (updateError) {
      console.log(`  ERROR: ${updateError.message}`);
    }
  }

  console.log('\n✅ Done!');
  console.log(`   Used AI estimate: ${useEstimate}`);
  console.log(`   Set to Call for Price: ${setCallForPrice}`);
}

main().catch(console.error);
