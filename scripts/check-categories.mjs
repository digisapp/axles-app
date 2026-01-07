import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Total active listings
  const { count: total } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  console.log('Total active listings:', total);

  // Get category breakdown
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id');

  const { data: listings } = await supabase
    .from('listings')
    .select('category_id')
    .eq('status', 'active');

  // Count by category
  const counts = {};
  listings?.forEach(l => {
    counts[l.category_id] = (counts[l.category_id] || 0) + 1;
  });

  console.log('\nListings by category:');
  categories?.forEach(cat => {
    if (counts[cat.id]) {
      console.log(`  ${cat.name} (${cat.slug}): ${counts[cat.id]}`);
    }
  });

  // Check trailers parent category
  const trailersParent = categories?.find(c => c.slug === 'trailers' && !c.parent_id);
  const trailerChildren = categories?.filter(c => c.parent_id === trailersParent?.id);

  console.log('\nTrailers parent ID:', trailersParent?.id);
  console.log('Trailer subcategories:', trailerChildren?.map(c => c.slug).join(', '));

  let trailerTotal = counts[trailersParent?.id] || 0;
  trailerChildren?.forEach(c => {
    trailerTotal += counts[c.id] || 0;
  });
  console.log('Total in trailers + subcategories:', trailerTotal);
}

check();
