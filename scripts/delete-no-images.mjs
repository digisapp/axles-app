import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteListingsWithoutImages() {
  console.log('🗑️  Deleting listings without images...\n');

  // Get all listing_ids that have images
  const { data: imageListingIds } = await supabase
    .from('listing_images')
    .select('listing_id')
    .limit(10000);

  const listingIdsWithImages = new Set(imageListingIds?.map(i => i.listing_id) || []);
  console.log(`Found ${listingIdsWithImages.size} listings with images`);

  // Get all active listings
  let allListingIds = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch } = await supabase
      .from('listings')
      .select('id')
      .eq('status', 'active')
      .range(offset, offset + batchSize - 1);

    if (!batch || batch.length === 0) break;
    allListingIds.push(...batch.map(l => l.id));
    offset += batchSize;
    if (batch.length < batchSize) break;
  }

  console.log(`Total active listings: ${allListingIds.length}`);

  // Find listings without images
  const listingsToDelete = allListingIds.filter(id => !listingIdsWithImages.has(id));
  console.log(`Listings to delete (no images): ${listingsToDelete.length}\n`);

  if (listingsToDelete.length === 0) {
    console.log('No listings to delete!');
    return;
  }

  // Delete in batches
  let deleted = 0;
  const deleteBatchSize = 100;

  for (let i = 0; i < listingsToDelete.length; i += deleteBatchSize) {
    const batch = listingsToDelete.slice(i, i + deleteBatchSize);

    const { error } = await supabase
      .from('listings')
      .delete()
      .in('id', batch);

    if (error) {
      console.error(`Error deleting batch: ${error.message}`);
    } else {
      deleted += batch.length;
      process.stdout.write(`\r  Deleted: ${deleted}/${listingsToDelete.length}`);
    }
  }

  console.log('\n\n✅ Done!');
  console.log(`Deleted ${deleted} listings without images`);
  console.log(`Remaining listings with images: ${listingIdsWithImages.size}`);
}

deleteListingsWithoutImages();
