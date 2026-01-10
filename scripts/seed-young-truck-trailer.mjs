// @ts-nocheck
/**
 * Seed Young Truck Trailer Inc
 * Omaha, NE - Side dumps, lowboys, drop decks, flatbeds, dry vans
 * Trail King, JET, Wabash, Utility dealer
 * Note: Site uses Imperva bot protection, so we seed from known inventory data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Young Truck Trailer Inc',
  email: 'sales@youngtrucktrailer.com',
  phone: '(402) 625-7891',
  address: '14905 Frontier Road',
  city: 'Omaha',
  state: 'NE',
  zip: '68138',
  website: 'https://www.youngtrucktrailer.com',
  about: 'Young Truck Trailer Inc is a full service heavy duty trailer dealer that has proudly served customers for over 35 years. Conveniently located just off I-80 at the 440 exit west of Omaha, Nebraska. We specialize in new and used side dump, lowboy detachable, drop deck beavertail, flatbed, drop deck, and dry van trailers. We represent Trail King, JET, Wabash, and Utility. Our full Service Repair Facility and Parts Department serves all makes and models. Young Leasing has been providing dry van semi-trailers and storage containers for rent since 1989.',
};

// Known inventory from web search results (MachineryTrader, TruckPaper)
const INVENTORY = [
  // Trail King Lowboys
  { title: 'TRAIL KING TK-80 Hydraulic Full-Width Loadable Neck Lowboy Trailer', year: null, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },
  { title: 'TRAIL KING TK-70 70,000 lb Capacity Mini Deck Lowboy Trailer', year: null, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },
  { title: 'TRAIL KING TK-90HG Hydraulic Narrow-Neck 80,000 lb Lowboy Trailer', year: null, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },
  { title: 'TRAIL KING All Steel Low Cambered Mini Deck 80,000 lb Lowboy Trailer', year: null, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },
  { title: 'TRAIL KING Hydraulic Detachable Gooseneck Lowboy Trailer', year: null, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },
  { title: 'TRAIL KING 51ft Hydraulic Mini Deck Air Ride Lowboy Trailer', year: null, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },

  // JET Side Dumps
  { title: 'JET Super Tri-Axle Air Ride 72in Rear Spread Side Dump Trailer', year: null, make: 'JET', category: 'dump-trailers', condition: 'new' },
  { title: 'JET Trunnion Mount Inverted Cylinder Lift Side Dump Trailer', year: null, make: 'JET', category: 'dump-trailers', condition: 'new' },
  { title: 'JET Tandem Axle Steel Side Dump Trailer', year: null, make: 'JET', category: 'dump-trailers', condition: 'new' },

  // Drop Decks / Step Decks
  { title: 'TRAIL KING Drop Deck Beavertail Trailer with Ramps', year: null, make: 'TRAIL KING', category: 'step-deck-trailers', condition: 'new' },
  { title: 'TRAIL KING 48ft Steel Drop Deck Trailer Air Ride', year: null, make: 'TRAIL KING', category: 'step-deck-trailers', condition: 'new' },
  { title: 'TRAIL KING Aluminum Combo Drop Deck Trailer', year: null, make: 'TRAIL KING', category: 'step-deck-trailers', condition: 'new' },

  // Flatbeds
  { title: 'TRAIL KING 48ft Steel Flatbed Trailer Tandem Axle', year: null, make: 'TRAIL KING', category: 'flatbed-trailers', condition: 'new' },
  { title: 'TRAIL KING 53ft Aluminum Combo Flatbed Trailer', year: null, make: 'TRAIL KING', category: 'flatbed-trailers', condition: 'new' },

  // Dry Vans
  { title: 'WABASH 53ft Dry Van Trailer Air Ride Swing Doors', year: null, make: 'WABASH', category: 'dry-van-trailers', condition: 'used' },
  { title: 'UTILITY 53ft Dry Van Trailer Roll Door', year: null, make: 'UTILITY', category: 'dry-van-trailers', condition: 'used' },
  { title: 'GREAT DANE 53ft Dry Van Trailer Logistics', year: null, make: 'GREAT DANE', category: 'dry-van-trailers', condition: 'used' },

  // Double Drops
  { title: 'TRAIL KING Double Drop Extendable Lowboy Trailer', year: null, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },
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

  const password = 'YoungTrailer2024!';
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
  console.log('Seeding Young Truck Trailer Inc');
  console.log('   Website: youngtrucktrailer.com');
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
  console.log('Note: This dealer\'s website has Imperva bot protection.');
  console.log('Images were not available. Visit their website for full inventory.');
}

main().catch(console.error);
