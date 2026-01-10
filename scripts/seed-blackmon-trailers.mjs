// @ts-nocheck
/**
 * Seed Blackmon Trailer Sales
 * Mansfield, LA - Lowboys, log trailers, flatbeds, chip vans
 * Pitts, Dorsey dealer
 * Note: Site uses Imperva bot protection, so we seed from known inventory data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Blackmon Trailers LLC',
  email: 'mail@blackmontrailers.com',
  phone: '(318) 824-7053',
  address: '5026 Highway 509',
  city: 'Mansfield',
  state: 'LA',
  zip: '71052',
  website: 'https://www.blackmontrailersllc.com',
  about: 'Blackmon Trailer Sales, located in Mansfield, LA, has a large inventory of in-stock trailers including end dumps, lowboys, log trailers, chip vans, live floor trailers, and more. We carry Pitts Lowboys with Fixed Neck or Detachable Neck options for Heavy Haul Equipment Trailers, available with Air Ride or Spring suspension, Pony Motors, Wheel Covers, and Apitong Flooring. We also carry Dorsey flatbed trailers.',
};

// Known inventory from web search results (MachineryTrader, TruckPaper)
const INVENTORY = [
  // Pitts Lowboys
  { title: 'PITTS 55 Ton RGN Detachable Neck Lowboy Pony Motor Wheel Covers', year: null, make: 'PITTS', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: 'PITTS 55 Ton Tri-Axle Detachable Neck Lowboy Air Ride', year: null, make: 'PITTS', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: 'PITTS 55 Ton Lowboy 3rd Lift Axle Future 4th Flip Setup', year: null, make: 'PITTS', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: '2025 PITTS LB55-22DC Honda Pony Motor Wheel Covers 3rd Axle Lift', year: 2025, make: 'PITTS', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: 'PITTS LB35-38CS 22.5 Tires Spring Ramps Lowboy Trailer', year: null, make: 'PITTS', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: 'PITTS Fixed Neck Heavy Haul Lowboy Air Ride Apitong Floor', year: null, make: 'PITTS', category: 'lowboy-trailers', condition: 'new', price: null },

  // Dorsey Flatbeds
  { title: 'DORSEY 48ft Spread Combo Flatbed Trailer 24x24x60 Toolbox', year: null, make: 'DORSEY', category: 'flatbed-trailers', condition: 'new', price: null },
  { title: 'DORSEY 53ft Combo Flatbed Trailer Air Ride', year: null, make: 'DORSEY', category: 'flatbed-trailers', condition: 'new', price: null },
  { title: 'DORSEY 48ft Steel Flatbed Trailer Tandem Axle', year: null, make: 'DORSEY', category: 'flatbed-trailers', condition: 'new', price: null },

  // Log Trailers
  { title: 'Log Trailer Tandem Axle Air Ride', year: null, make: null, category: 'log-trailers', condition: 'used', price: null },
  { title: 'Tri-Axle Log Trailer', year: null, make: null, category: 'log-trailers', condition: 'used', price: null },

  // Chip Vans
  { title: 'Chip Van Trailer 53ft Walking Floor', year: null, make: null, category: 'trailers', condition: 'used', price: null },

  // End Dumps
  { title: 'End Dump Trailer Tandem Axle Steel', year: null, make: null, category: 'end-dump-trailers', condition: 'used', price: null },

  // Live Floor
  { title: 'Live Floor Trailer 48ft', year: null, make: null, category: 'trailers', condition: 'used', price: null },
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

  const password = 'Blackmon2024!';
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
  console.log('Seeding Blackmon Trailer Sales');
  console.log('   Website: blackmontrailersllc.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  let imported = 0;
  let skipped = 0;

  for (const item of INVENTORY) {
    process.stdout.write(`[${imported + skipped + 1}/${INVENTORY.length}] ${item.title.substring(0, 45)}... `);

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
}

main().catch(console.error);
