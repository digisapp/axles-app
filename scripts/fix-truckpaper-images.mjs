// @ts-nocheck
/**
 * Fix TruckPaper images - remove flag/decoration images and set correct primary
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Patterns that indicate non-product images
const BAD_PATTERNS = [
  'flag',
  '/flags/',
  'sprite',
  'icon',
  'logo',
  'badge',
  'banner',
  'social',
  'facebook',
  'twitter',
  'avatar',
  'profile',
  '/ui/',
  '/assets/',
  'placeholder',
  '.gif',
  '.svg',
];

async function fixImages() {
  console.log('🔧 Fixing TruckPaper images...\n');

  // Get TruckPaper dealer ID
  const { data: dealer } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', 'TruckPaper Listings')
    .single();

  if (!dealer) {
    console.log('TruckPaper dealer not found');
    return;
  }

  // Get all TruckPaper listings
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title')
    .eq('user_id', dealer.id);

  console.log(`Found ${listings?.length} TruckPaper listings\n`);

  let totalDeleted = 0;
  let totalFixed = 0;

  for (const listing of listings || []) {
    // Get images for this listing
    const { data: images } = await supabase
      .from('listing_images')
      .select('id, url, is_primary, sort_order')
      .eq('listing_id', listing.id)
      .order('sort_order', { ascending: true });

    if (!images || images.length === 0) continue;

    // Find bad images
    const badImageIds = [];
    const goodImages = [];

    for (const img of images) {
      const urlLower = img.url.toLowerCase();
      const isBad = BAD_PATTERNS.some(pattern => urlLower.includes(pattern));

      if (isBad) {
        badImageIds.push(img.id);
      } else {
        goodImages.push(img);
      }
    }

    // Delete bad images
    if (badImageIds.length > 0) {
      await supabase
        .from('listing_images')
        .delete()
        .in('id', badImageIds);

      totalDeleted += badImageIds.length;
    }

    // Fix primary image - set first good image as primary
    if (goodImages.length > 0) {
      // Reset all to non-primary
      await supabase
        .from('listing_images')
        .update({ is_primary: false })
        .eq('listing_id', listing.id);

      // Set first good image as primary and fix sort order
      for (let i = 0; i < goodImages.length; i++) {
        await supabase
          .from('listing_images')
          .update({ is_primary: i === 0, sort_order: i })
          .eq('id', goodImages[i].id);
      }

      if (badImageIds.length > 0) {
        totalFixed++;
        console.log(`✓ Fixed: ${listing.title?.substring(0, 50)} (removed ${badImageIds.length} bad images)`);
      }
    }
  }

  console.log('\n==================================================');
  console.log(`📊 Summary:`);
  console.log(`   Listings fixed: ${totalFixed}`);
  console.log(`   Bad images deleted: ${totalDeleted}`);
  console.log('==================================================\n');
}

fixImages().catch(console.error);
