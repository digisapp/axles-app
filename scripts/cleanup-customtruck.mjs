// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanup() {
  // Get Custom Truck dealer
  const { data: dealer } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', 'Custom Truck One Source')
    .single();

  if (!dealer) {
    console.log('Dealer not found');
    return;
  }

  // Delete bad listings (Page Not Found, Custom Truck One Source branding pages)
  const { data: badListings } = await supabase
    .from('listings')
    .select('id, title')
    .eq('user_id', dealer.id)
    .or('title.ilike.%Page Not Found%,title.ilike.%Single-source provider%');

  console.log('Bad listings to delete:', badListings?.length || 0);

  for (const l of badListings || []) {
    // Delete images first
    await supabase.from('listing_images').delete().eq('listing_id', l.id);
    // Delete listing
    await supabase.from('listings').delete().eq('id', l.id);
    console.log('  Deleted:', l.title.substring(0, 40));
  }

  // Now cap images at 15 per listing
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title')
    .eq('user_id', dealer.id);

  console.log('\nTotal listings remaining:', listings?.length);

  let fixedCount = 0;
  for (const l of listings || []) {
    const { data: images } = await supabase
      .from('listing_images')
      .select('id, sort_order')
      .eq('listing_id', l.id)
      .order('sort_order', { ascending: true });

    if (images && images.length > 15) {
      // Delete excess images
      const toDelete = images.slice(15);
      for (const img of toDelete) {
        await supabase.from('listing_images').delete().eq('id', img.id);
      }
      console.log('  Capped images for:', l.title.substring(0, 40));
      fixedCount++;
    }
  }
  console.log('Fixed image count for', fixedCount, 'listings');
}

cleanup().catch(console.error);
