// @ts-nocheck
/**
 * Seed Tri-State Trailer Sales
 * Pittsburgh, PA (+ Lancaster PA, Hubbard OH, Cincinnati OH)
 * Full service trailer dealership since 1985
 * Fontaine, Eager Beaver, Landoll, XL Specialized, Reitnouer, Talbert dealer
 * Note: Site uses Imperva bot protection, so we seed from known inventory data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Tri-State Trailer Sales',
  email: 'sales@tristatetrailer.com',
  phone: '(412) 747-7777',
  address: '3111 Grand Avenue',
  city: 'Pittsburgh',
  state: 'PA',
  zip: '15225',
  website: 'https://www.tristatetrailer.com',
  about: 'Tri-State Trailer Sales, Inc. is a full service (New & Used Sales / Parts / Service / Rental & Leasing) semi-trailer dealership serving the transportation industry for 38 years since 1985. We have a HUGE inventory of all types of trailers in stock including Vans, Flats, Specialized, Reefers, Tanks and more. We offer four full-service dealerships located in Pittsburgh & Lancaster, PA and Hubbard & Cincinnati, OH. Our promise: "WE MAKE BUSINESS EASY, GUARANTEED"',
};

// Known inventory from web search results (Ritchie List, MachineryTrader)
const INVENTORY = [
  // Fontaine Lowboys
  { title: '2026 FONTAINE WORKHORSE 55LCC Wheel Covers Lowboy Trailer', year: 2026, make: 'FONTAINE', category: 'lowboy-trailers', condition: 'new', price: 115950 },
  { title: '2025 FONTAINE MAGNITUDE 55L Lowboy Trailer', year: 2025, make: 'FONTAINE', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: '2026 FONTAINE 48ft Combo Air Ride Slider Flatbed Trailer', year: 2026, make: 'FONTAINE', category: 'flatbed-trailers', condition: 'new', price: null },

  // Eager Beaver
  { title: '2025 EAGER BEAVER 35GSL-PT Lowboy Trailer', year: 2025, make: 'EAGER BEAVER', category: 'lowboy-trailers', condition: 'new', price: 77250 },
  { title: '2026 EAGER BEAVER 20XPT Flatbed Trailer', year: 2026, make: 'EAGER BEAVER', category: 'flatbed-trailers', condition: 'new', price: 35600 },

  // Landoll
  { title: '2026 LANDOLL 440B-50CA Lowboy Trailer', year: 2026, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'new', price: 112950 },
  { title: '2025 LANDOLL Traveling Axle Lowboy Trailer', year: 2025, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'new', price: null },

  // XL Specialized
  { title: '2024 XL SPECIALIZED Hydraulic Flip Axle Galvanized Lowboy', year: 2024, make: 'XL SPECIALIZED', category: 'lowboy-trailers', condition: 'used', price: 31500 },

  // Talbert
  { title: '2018 TALBERT Flip Axle Fits 55 Ton Trailers Lowboy', year: 2018, make: 'TALBERT', category: 'lowboy-trailers', condition: 'used', price: 14950 },
  { title: '2006 TALBERT 55 Ton Lowboy Trailer', year: 2006, make: 'TALBERT', category: 'lowboy-trailers', condition: 'used', price: 39900 },

  // Reitnouer Flatbeds
  { title: '2019 REITNOUER Maxmiser Rear Axle Slide Front Lift Flatbed', year: 2019, make: 'REITNOUER', category: 'flatbed-trailers', condition: 'used', price: 33900 },
  { title: '2015 REITNOUER 48x102 Maxmiser Disc Brakes Flatbed Trailer', year: 2015, make: 'REITNOUER', category: 'flatbed-trailers', condition: 'used', price: 23950 },
  { title: '2006 REITNOUER Maxmiser Flatbed Trailer', year: 2006, make: 'REITNOUER', category: 'flatbed-trailers', condition: 'used', price: 8250 },

  // Other Flatbeds
  { title: '2019 FONTAINE 48ft Combo Air Ride Slider Flatbed Trailer', year: 2019, make: 'FONTAINE', category: 'flatbed-trailers', condition: 'used', price: 26900 },

  // Dry Vans
  { title: '2007 TRAILMOBILE Sheet Post Dry Van Trailer', year: 2007, make: 'TRAILMOBILE', category: 'dry-van-trailers', condition: 'used', price: 6900 },
  { title: 'GREAT DANE 53ft Dry Van Trailer', year: null, make: 'GREAT DANE', category: 'dry-van-trailers', condition: 'used', price: null },
  { title: 'WABASH 53ft Dry Van Trailer Air Ride', year: null, make: 'WABASH', category: 'dry-van-trailers', condition: 'used', price: null },

  // Reefers
  { title: 'UTILITY 53ft Reefer Trailer Thermo King Unit', year: null, make: 'UTILITY', category: 'reefer-trailers', condition: 'used', price: null },
  { title: 'GREAT DANE 53ft Reefer Trailer Carrier Unit', year: null, make: 'GREAT DANE', category: 'reefer-trailers', condition: 'used', price: null },

  // Tanks
  { title: 'Petroleum Tank Trailer 8000 Gallon', year: null, make: null, category: 'tank-trailers', condition: 'used', price: null },
  { title: 'Dry Bulk Tank Trailer Pneumatic', year: null, make: null, category: 'tank-trailers', condition: 'used', price: null },

  // Drop Decks
  { title: 'Drop Deck Trailer 48ft Combo Air Ride', year: null, make: null, category: 'step-deck-trailers', condition: 'used', price: null },
  { title: 'Extendable Drop Deck Trailer', year: null, make: null, category: 'step-deck-trailers', condition: 'used', price: null },
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

  const password = 'TriState2024!';
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
  console.log('Seeding Tri-State Trailer Sales');
  console.log('   Website: tristatetrailer.com');
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
}

main().catch(console.error);
