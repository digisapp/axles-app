// @ts-nocheck
/**
 * Seed Veskerna Equipment Sales
 * Fremont, NE - Lowboys, dump trailers, construction equipment
 * Globe, Kaufman, Dorsey Trailers dealer
 * Note: Site uses Imperva bot protection, so we seed from known inventory data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Veskerna Equipment Sales',
  email: 'dan@veskernaequipment.com',
  phone: '(402) 721-4744',
  address: '1535 Morningside Road',
  city: 'Fremont',
  state: 'NE',
  zip: '68025',
  website: 'https://www.veskernaequipment.com',
  about: 'Veskerna Equipment Sales, located in Fremont, NE, has been delivering quality sales and service since 2010. We specialize in providing customers the right piece of machinery/equipment for the right price. We offer a wide selection including Wheel Loaders, Backhoes, Forklifts (Telescopic, Mast, & Scissor), Trucks, Lowboy Trailers, Excavators, Skid Loaders, Dump Trucks and Service Trucks. We are proud to carry Kaufman Trailers, Dorsey Trailers, and Globe Trailers to suit your hauling needs.',
};

// Known inventory from web search results (MachineryTrader, company website)
const INVENTORY = [
  // Globe Lowboys - 2026
  { title: '2026 GLOBE 55 Ton Hydraulic Flip Stinger Lowboy Trailer', year: 2026, make: 'GLOBE', category: 'lowboy-trailers', condition: 'new', price: 151800 },
  { title: '2026 GLOBE 55 Ton Hydraulic 4th Flip Axle Air Lift Lowboy Trailer', year: 2026, make: 'GLOBE', category: 'lowboy-trailers', condition: 'new', price: 124000 },
  { title: '2026 GLOBE 51 Ton 3rd Axle Lift Aluminum Wheels Lowboy Trailer', year: 2026, make: 'GLOBE', category: 'lowboy-trailers', condition: 'new', price: 97000 },
  { title: '2026 TRAIL KING TK110HDG Viper Red Lowboy Trailer', year: 2026, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new', price: 142000 },
  { title: '2026 55 Ton Hydraulic 4th Flip Axle Air Lift 10 Year Warranty Lowboy', year: 2026, make: 'GLOBE', category: 'lowboy-trailers', condition: 'new', price: 119000 },

  // Globe Lowboys - 2025
  { title: '2025 GLOBE 51 Ton 3rd Axle Lift Pony Motor Lowboy Trailer', year: 2025, make: 'GLOBE', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: '2025 GLOBE 55 Ton Hydraulic Detachable Gooseneck Lowboy Trailer', year: 2025, make: 'GLOBE', category: 'lowboy-trailers', condition: 'new', price: null },

  // Globe Lowboys - 2024
  { title: '2024 GLOBE 55 Ton Hydraulic 4th Flip Axle Powder Coated Lowboy', year: 2024, make: 'GLOBE', category: 'lowboy-trailers', condition: 'new', price: null },

  // Used Lowboys
  { title: '2022 GLOBE 55 Ton 3+1 Lowboy Trailer', year: 2022, make: 'GLOBE', category: 'lowboy-trailers', condition: 'used', price: null },
  { title: '2013 GLOBE 50 Ton 3 Axle Air Lift 22ft Well Lowboy Trailer', year: 2013, make: 'GLOBE', category: 'lowboy-trailers', condition: 'used', price: 52000 },

  // End Dump Trailers
  { title: '2022 30 Ton 75 Yard End Dump Trailer 102x36 Auto Tarp', year: 2022, make: null, category: 'end-dump-trailers', condition: 'used', price: null },

  // Kaufman Trailers
  { title: 'KAUFMAN 35 Ton Tagalong Equipment Trailer', year: null, make: 'KAUFMAN', category: 'tag-trailers', condition: 'new', price: null },
  { title: 'KAUFMAN Gooseneck Equipment Trailer', year: null, make: 'KAUFMAN', category: 'lowboy-trailers', condition: 'new', price: null },

  // Dorsey Trailers
  { title: 'DORSEY 53ft Dry Van Trailer', year: null, make: 'DORSEY', category: 'dry-van-trailers', condition: 'used', price: null },

  // Equipment - Wheel Loaders
  { title: 'CAT Wheel Loader', year: null, make: 'CAT', category: 'construction-equipment', condition: 'used', price: null },
  { title: 'CASE Backhoe Loader', year: null, make: 'CASE', category: 'construction-equipment', condition: 'used', price: null },

  // Trucks
  { title: 'Peterbilt Service Truck', year: null, make: 'PETERBILT', category: 'trucks', condition: 'used', price: null },
  { title: 'Kenworth Dump Truck', year: null, make: 'KENWORTH', category: 'dump-trucks', condition: 'used', price: null },
];

async function getOrCreateDealer() {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', DEALER_INFO.name)
    .single();

  if (existing) {
    console.log('Dealer exists:', DEALER_INFO.name);
    await supabase.from('profiles').update({
      phone: DEALER_INFO.phone,
      address: DEALER_INFO.address,
      city: DEALER_INFO.city,
      state: DEALER_INFO.state,
      zip_code: DEALER_INFO.zip,
      website: DEALER_INFO.website,
      about: DEALER_INFO.about,
      is_dealer: true,
    }).eq('id', existing.id);
    return existing.id;
  }

  const password = 'Veskerna2024!';
  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email: DEALER_INFO.email,
    email_confirm: true,
    password: password,
  });

  if (error) {
    console.error('Error creating dealer:', error.message);
    return null;
  }

  await supabase.from('profiles').update({
    company_name: DEALER_INFO.name,
    phone: DEALER_INFO.phone,
    address: DEALER_INFO.address,
    city: DEALER_INFO.city,
    state: DEALER_INFO.state,
    zip_code: DEALER_INFO.zip,
    website: DEALER_INFO.website,
    about: DEALER_INFO.about,
    is_dealer: true,
  }).eq('id', authUser.user.id);

  console.log('Created dealer:', DEALER_INFO.name);
  console.log('  Email:', DEALER_INFO.email);
  console.log('  Password:', password);
  return authUser.user.id;
}

async function getCategoryId(slug) {
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!cat) {
    const { data: fallback } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'trailers')
      .single();
    return fallback?.id;
  }

  return cat.id;
}

async function main() {
  console.log('Seeding Veskerna Equipment Sales');
  console.log('   Website: veskernaequipment.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  let imported = 0;
  let skipped = 0;

  for (const item of INVENTORY) {
    process.stdout.write(`[${imported + skipped + 1}/${INVENTORY.length}] ${item.title.substring(0, 45)}... `);

    // Check for existing
    const { data: exists } = await supabase
      .from('listings')
      .select('id')
      .eq('title', item.title)
      .eq('user_id', dealerId)
      .single();

    if (exists) {
      console.log('duplicate');
      skipped++;
      continue;
    }

    const categoryId = await getCategoryId(item.category);

    const { error } = await supabase.from('listings').insert({
      user_id: dealerId,
      category_id: categoryId,
      title: item.title,
      description: item.title,
      price: item.price,
      price_type: item.price ? 'fixed' : 'contact',
      condition: item.condition,
      year: item.year,
      make: item.make,
      city: DEALER_INFO.city,
      state: DEALER_INFO.state,
      country: 'USA',
      status: 'active',
      listing_type: 'sale',
    });

    if (error) {
      console.log('error: ' + error.message);
    } else {
      imported++;
      const priceStr = item.price ? `$${item.price.toLocaleString()}` : 'Contact';
      console.log(`OK ${priceStr}`);
    }
  }

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Location: ' + DEALER_INFO.city + ', ' + DEALER_INFO.state);
  console.log('   Imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('==================================================\n');
  console.log('Note: This dealer\'s website has Imperva bot protection.');
  console.log('Images were not available. Visit their website for full inventory.');
}

main().catch(console.error);
