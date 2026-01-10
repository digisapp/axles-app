// @ts-nocheck
/**
 * Seed Lubbock Truck Sales
 * Lubbock, TX - Freightliner, Western Star, trailers
 * Note: Their site has strong bot protection, so we seed from known inventory data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Lubbock Truck Sales',
  email: 'sales@lubbocktrucksales.com',
  phone: '(806) 748-1529',
  address: '1801 E Slaton Rd',
  city: 'Lubbock',
  state: 'TX',
  zip: '79404',
  website: 'https://www.lubbocktrucksales.com',
  about: 'Lubbock Truck Sales is a full service truck and trailer dealership in Lubbock, TX, locally owned and in business at the same location since 1990. We specialize in Freightliner and Western Star Trucks, as well as CPS/Manac, Doonan, Great Dane, Kalyn Siebert, Trail King, Transcraft, Peerless, and Scona trailers. Our 26-bay shop has certified mechanics offering engine, transmission and driveline rebuilds and repairs along with electrical and A/C repairs.',
};

// Known inventory from web search results
const INVENTORY = [
  // Trucks
  { title: '2025 FREIGHTLINER CASCADIA 126 Day Cab Trucks', year: 2025, make: 'FREIGHTLINER', category: 'day-cab-trucks', condition: 'new' },
  { title: '2022 WESTERN STAR 49X Sleeper Trucks', year: 2022, make: 'WESTERN STAR', category: 'sleeper-trucks', condition: 'used' },
  { title: '2018 FREIGHTLINER BUSINESS CLASS M2 106 Box Trucks', year: 2018, make: 'FREIGHTLINER', category: 'trucks', condition: 'used' },
  { title: '2020 PETERBILT 567 Sleeper Trucks', year: 2020, make: 'PETERBILT', category: 'sleeper-trucks', condition: 'used' },
  // Trailers
  { title: '2024 KALYN SIEBERT 55 TON DIAMOND BACK Lowboy Trailers', year: 2024, make: 'KALYN SIEBERT', category: 'lowboy-trailers', condition: 'new' },
  { title: '2024 DOONAN SPECIALIZED 48\' STEEL CLOSED A/R Flatbed Trailers', year: 2024, make: 'DOONAN', category: 'flatbed-trailers', condition: 'new' },
  { title: '2025 DOONAN 3 AXLE EXTENDABLE DROP W/ ROLLER Oil Field Trailers', year: 2025, make: 'DOONAN', category: 'lowboy-trailers', condition: 'new' },
  { title: '2026 DOONAN DROP WITH BEAVER TAIL Drop Deck Trailers', year: 2026, make: 'DOONAN', category: 'step-deck-trailers', condition: 'new' },
  { title: '2023 XL SPECIALIZED XL 22FA Lowboy Trailers', year: 2023, make: 'XL SPECIALIZED', category: 'lowboy-trailers', condition: 'used' },
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

  const password = 'Lubbock2024!';
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
      .eq('slug', 'trucks')
      .single();
    return fallback?.id;
  }

  return cat.id;
}

async function main() {
  console.log('Seeding Lubbock Truck Sales');
  console.log('   Website: lubbocktrucksales.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  let imported = 0;
  let skipped = 0;

  for (const item of INVENTORY) {
    process.stdout.write(`[${imported + skipped + 1}/${INVENTORY.length}] ${item.title.substring(0, 40)}... `);

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
      price: null,
      price_type: 'contact',
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
      console.log('OK');
    }
  }

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Location: ' + DEALER_INFO.city + ', ' + DEALER_INFO.state);
  console.log('   Imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('==================================================\n');
  console.log('Note: This dealer\'s website has strong bot protection.');
  console.log('Images were not available. Visit their website for full inventory.');
}

main().catch(console.error);
