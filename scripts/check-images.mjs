import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkListings() {
  // Get total active listings count
  const { count: totalListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Count listings that have at least one image using a subquery approach
  // Get all listing_ids that have images
  const { data: imageListingIds } = await supabase
    .from('listing_images')
    .select('listing_id')
    .limit(10000);

  const uniqueListingIdsWithImages = new Set(imageListingIds?.map(i => i.listing_id) || []);

  // Count active listings that DON'T have images
  const { data: listingsWithoutImages, count: countWithoutImages } = await supabase
    .from('listings')
    .select('id, title', { count: 'exact' })
    .eq('status', 'active')
    .not('id', 'in', `(${Array.from(uniqueListingIdsWithImages).slice(0, 100).join(',') || '00000000-0000-0000-0000-000000000000'})`);

  // Actually, let's do this properly with a direct count
  const withImagesCount = uniqueListingIdsWithImages.size;
  const withoutImagesCount = totalListings - withImagesCount;

  console.log('=== Listings Image Analysis ===');
  console.log(`Total active listings: ${totalListings}`);
  console.log(`Listings WITH images: ${withImagesCount}`);
  console.log(`Listings WITHOUT images: ${withoutImagesCount}`);
  console.log(`Percentage without images: ${((withoutImagesCount / (totalListings || 1)) * 100).toFixed(1)}%`);

  // Get sample of listings without images
  const { data: sampleWithout } = await supabase
    .from('listings')
    .select('id, title, user_id')
    .eq('status', 'active')
    .limit(1000);

  const actualWithoutImages = sampleWithout?.filter(l => !uniqueListingIdsWithImages.has(l.id)) || [];

  console.log('\n=== Sample listings without images ===');
  actualWithoutImages.slice(0, 10).forEach(l => {
    console.log(`- ${l.title}`);
  });

  console.log(`\n(Showing ${actualWithoutImages.length} of ${withoutImagesCount} total without images)`);
}

checkListings();
