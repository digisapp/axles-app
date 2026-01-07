import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get all listing IDs
  const { data: listings } = await supabase
    .from('listings')
    .select('id');

  const listingIds = new Set(listings?.map(l => l.id));

  // Get all images
  const { data: images } = await supabase
    .from('listing_images')
    .select('id, listing_id, url')
    .limit(5000);

  // Find orphaned images
  const orphaned = images?.filter(img => !listingIds.has(img.listing_id)) || [];

  console.log('Total images:', images?.length);
  console.log('Listings exist:', listingIds.size);
  console.log('Orphaned images (listing was deleted but image remains):', orphaned.length);

  if (orphaned.length > 0) {
    console.log('\nThese images belong to DELETED listings:');
    orphaned.slice(0, 10).forEach(img => {
      console.log('  listing_id:', img.listing_id);
    });
  }
}

check();
