// @ts-nocheck
/**
 * Seed TM Trailer Sales
 * Jackson, GA - Lowboys, RGNs, Drop Decks, Heavy Equipment Trailers
 * Landoll, Fontaine, Trail King, Talbert dealer
 * Note: Site has Imperva bot protection, so we seed from known inventory data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'TM Trailer Sales',
  email: 'tim@lowboydealer.com',
  phone: '(770) 305-9071',
  address: '192 Van Mar Blvd',
  city: 'Jackson',
  state: 'GA',
  zip: '30233',
  website: 'https://www.tmtrailersales.com',
  about: 'TM Trailer Sales, Inc., established in 2001, is a reliable source for heavy equipment trailers in Jackson, GA. Led by CEO Timothy Moore with over 30 years of industry experience, we are the certified dealer of all Landoll trailer product lines throughout Georgia. We offer an extensive selection of new and used trailers including lowboys, hydraulic and mechanical RGNs, traveling axle trailers, drop decks, and nitrogen stingers. We also represent Fontaine, Talbert, Rogers, Trail King and XL Specialized, and offer full service and parts.',
};

// Known inventory from web search results (TruckPaper, MachineryTrader, company website)
const INVENTORY = [
  // Landoll Trailers
  { title: '2026 LANDOLL 455B 50 Heavy Duty Traveling Axle Trailer', year: 2026, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'new' },
  { title: '2025 LANDOLL 835 F Traveling Tail Lowboy Trailer', year: 2025, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'new' },
  { title: '2025 LANDOLL 51ft Traveling Tail 35 Ton Lowboy Trailer', year: 2025, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'new' },
  { title: 'LANDOLL 53x102 55/40 Ton Air Weigh Lowboy Trailer', year: null, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'used' },
  { title: '2025 LANDOLL 855 55 Ton Beavertail Lowboy Trailer', year: 2025, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'new' },
  { title: 'LANDOLL 55 Ton Extendible Deck 34-60ft Lowboy Trailer', year: null, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'used' },

  // Fontaine Trailers
  { title: '2026 FONTAINE WORKHORSE 55 TON PVR Lowboy Trailer', year: 2026, make: 'FONTAINE', category: 'lowboy-trailers', condition: 'new' },
  { title: '2025 FONTAINE WORKHORSE PVR 55 Ton Detachable Lowboy Trailer', year: 2025, make: 'FONTAINE', category: 'lowboy-trailers', condition: 'new' },
  { title: '2025 FONTAINE MAGNITUDE 60LCC 60 Ton Lowboy Trailer', year: 2025, make: 'FONTAINE', category: 'lowboy-trailers', condition: 'new' },
  { title: '2025 FONTAINE MAGNITUDE 55L Lowboy Trailer', year: 2025, make: 'FONTAINE', category: 'lowboy-trailers', condition: 'new' },

  // Trail King Trailers
  { title: '2025 TRAIL KING TKFA 1 Double Drop Lowboy Trailer', year: 2025, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },
  { title: '2025 TRAIL KING TK110HDG Lowboy Trailer', year: 2025, make: 'TRAIL KING', category: 'lowboy-trailers', condition: 'new' },

  // Step Deck / Drop Deck
  { title: '2025 48ft Step Deck Trailer with 12 Sliding Winches', year: 2025, make: null, category: 'step-deck-trailers', condition: 'new' },
  { title: '2026 51x102 35 Ton Hydraulic Tail Trailer', year: 2026, make: null, category: 'lowboy-trailers', condition: 'new' },

  // Tag Trailers
  { title: 'LANDOLL 35 Ton Tandem Axle Beavertail Tag Trailer', year: null, make: 'LANDOLL', category: 'tag-trailers', condition: 'used' },

  // RGN Trailers
  { title: '2025 LANDOLL 55 Ton Hydraulic Removable Gooseneck Trailer', year: 2025, make: 'LANDOLL', category: 'lowboy-trailers', condition: 'new' },
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

  const password = 'TMTrailer2024!';
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
  console.log('Seeding TM Trailer Sales');
  console.log('   Website: tmtrailersales.com');
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
