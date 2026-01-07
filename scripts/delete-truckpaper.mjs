// @ts-nocheck
/**
 * Delete all TruckPaper listings but keep the dealer CSV
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteTruckPaperListings() {
  console.log('🗑️  Deleting TruckPaper listings...\n');

  // Find TruckPaper dealer
  const { data: dealer } = await supabase
    .from('profiles')
    .select('id, company_name')
    .eq('company_name', 'TruckPaper Listings')
    .single();

  if (!dealer) {
    console.log('TruckPaper Listings dealer not found');
    return;
  }

  console.log('Found dealer:', dealer.company_name);

  // Count listings
  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', dealer.id);

  console.log('Total listings to delete:', count);

  // Get listing IDs
  const { data: listings } = await supabase
    .from('listings')
    .select('id')
    .eq('user_id', dealer.id);

  const listingIds = listings?.map(l => l.id) || [];

  if (listingIds.length > 0) {
    // Delete images first (foreign key constraint)
    const { error: imgError } = await supabase
      .from('listing_images')
      .delete()
      .in('listing_id', listingIds);

    if (imgError) {
      console.log('Image delete error:', imgError.message);
    } else {
      console.log('✓ Deleted images');
    }

    // Delete listings
    const { error: listError } = await supabase
      .from('listings')
      .delete()
      .eq('user_id', dealer.id);

    if (listError) {
      console.log('Listing delete error:', listError.message);
    } else {
      console.log('✓ Deleted', listingIds.length, 'listings');
    }
  }

  console.log('\n✅ Done! Dealer CSV preserved at truckpaper-dealers-*.csv');
}

deleteTruckPaperListings().catch(console.error);
