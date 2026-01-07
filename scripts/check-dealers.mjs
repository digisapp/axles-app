// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDealer(companyName) {
  console.log('=== ' + companyName.toUpperCase() + ' ===\n');

  const { data: dealer } = await supabase
    .from('profiles')
    .select('id, email, phone, city, state')
    .eq('company_name', companyName)
    .single();

  if (!dealer) {
    console.log('Dealer not found\n');
    return;
  }

  console.log('Email:', dealer.email);
  console.log('Phone:', dealer.phone || 'Not set');
  console.log('Location:', (dealer.city || '') + ', ' + (dealer.state || ''));

  // Get listings with categories and images
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, category:categories(name), images:listing_images(id)')
    .eq('user_id', dealer.id);

  // Count by category
  const catCounts = {};
  let withImages = 0;
  let noImages = 0;

  for (const l of listings || []) {
    const catName = l.category?.name || 'NO CATEGORY';
    catCounts[catName] = (catCounts[catName] || 0) + 1;

    if (l.images && l.images.length > 0) withImages++;
    else noImages++;
  }

  console.log('\nCategories:');
  for (const [cat, count] of Object.entries(catCounts).sort((a,b) => b[1] - a[1])) {
    console.log('  ' + cat + ': ' + count);
  }

  console.log('\nWith images:', withImages);
  console.log('Without images:', noImages);
  console.log('\n');
}

async function main() {
  await checkDealer('Pinnacle Trailers');
  await checkDealer('Hale Trailer');
  await checkDealer('Don Baskin Truck Sales');
  await checkDealer('Royal Truck & Utility Trailer');
  await checkDealer('Midco Sales');
  await checkDealer('TNT Trailer Sales');
  await checkDealer('Jim Hawk Truck Trailers');
  await checkDealer('Custom Truck One Source');
  await checkDealer('LMI Tennessee LLC');
  await checkDealer('TEC Equipment');
  await checkDealer("Lucky's Trailer Sales");
  await checkDealer('DG Peterbilt');
  await checkDealer('Western Truck & Trailer');
}

main().catch(console.error);
