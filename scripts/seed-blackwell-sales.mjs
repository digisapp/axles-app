// @ts-nocheck
/**
 * Seed Blackwell Truck & Trailer
 * Daingerfield, TX - Heavy Haul Trucks & Trailers since 1971
 * Kalyn Siebert, XL Specialized, Etnyre, East dealer
 * Note: Site uses Imperva bot protection, so we seed from known inventory data
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Blackwell Truck & Trailer',
  email: 'sales@blackwellsales.net',
  phone: '(903) 347-8279',
  address: '125 County Road 2202',
  city: 'Daingerfield',
  state: 'TX',
  zip: '75638',
  website: 'https://www.blackwellsales.net',
  about: 'Blackwell Truck and Trailer has been specializing in Heavy Haul Trucks & Trailers since 1971, serving customers faithfully from Daingerfield, Texas. We strive to meet and exceed the needs of our customers every day. Over the years, we have obtained a wealth of knowledge that allows us to best serve them. We offer new and used heavy haul trailers and used semi trucks, including lowboys, flatbeds, and heavy equipment trailers from Kalyn Siebert, XL Specialized, Etnyre, and East.',
};

// Known inventory from web search results (ForestryTrader, TractorHouse, MachineryTrader)
const INVENTORY = [
  // Heavy Lowboys
  { title: '85 Ton 13 Axle Heavy Haul Lowboy Trailer 59ft', year: null, make: null, category: 'lowboy-trailers', condition: 'new', price: 511125 },
  { title: 'KALYN SIEBERT 85 Ton 3+3+3 Power Tower Neck Lowboy Trailer', year: null, make: 'KALYN SIEBERT', category: 'lowboy-trailers', condition: 'new', price: 342000 },
  { title: 'KALYN SIEBERT 80 Ton 3+3+3 Hydraulic Detach Short Neck Lowboy', year: null, make: 'KALYN SIEBERT', category: 'lowboy-trailers', condition: 'new', price: 325000 },
  { title: 'KALYN SIEBERT 85 Ton 102ft Apitong Floor Lowboy Trailer', year: null, make: 'KALYN SIEBERT', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: '60 Ton 9ft Wide 26ft Deck Air Lift 3rd Axle Lowboy Trailer', year: null, make: null, category: 'lowboy-trailers', condition: 'new', price: null },
  { title: '85 Ton Refurbished 30ft Deck 10ft Wide Lowboy Trailer', year: null, make: null, category: 'lowboy-trailers', condition: 'used', price: null },

  // XL Specialized
  { title: 'XL SPECIALIZED Heavy Haul Lowboy Trailer', year: null, make: 'XL SPECIALIZED', category: 'lowboy-trailers', condition: 'new', price: null },
  { title: 'XL SPECIALIZED 55 Ton Detachable Gooseneck Lowboy Trailer', year: null, make: 'XL SPECIALIZED', category: 'lowboy-trailers', condition: 'new', price: null },

  // Etnyre Trailers
  { title: 'ETNYRE Heavy Haul Lowboy Trailer', year: null, make: 'ETNYRE', category: 'lowboy-trailers', condition: 'used', price: null },

  // East Flatbeds
  { title: 'EAST 48ft Flatbed Trailer 30in Kingpin 15 Pair Tie Downs', year: null, make: 'EAST', category: 'flatbed-trailers', condition: 'used', price: null },
  { title: 'EAST 53ft Aluminum Flatbed Trailer', year: null, make: 'EAST', category: 'flatbed-trailers', condition: 'used', price: null },

  // Used Semi Trucks
  { title: 'Peterbilt 389 Heavy Haul Day Cab Truck', year: null, make: 'PETERBILT', category: 'day-cab-trucks', condition: 'used', price: null },
  { title: 'Kenworth W900 Heavy Haul Sleeper Truck', year: null, make: 'KENWORTH', category: 'sleeper-trucks', condition: 'used', price: null },
  { title: 'Peterbilt 379 Heavy Haul Truck', year: null, make: 'PETERBILT', category: 'trucks', condition: 'used', price: null },
  { title: 'Kenworth T800 Tri-Axle Heavy Haul Truck', year: null, make: 'KENWORTH', category: 'trucks', condition: 'used', price: null },

  // Other Lowboys
  { title: '55 Ton Hydraulic Detachable Gooseneck Lowboy Trailer', year: null, make: null, category: 'lowboy-trailers', condition: 'new', price: 98500 },
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

  const password = 'Blackwell2024!';
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
  console.log('Seeding Blackwell Truck & Trailer');
  console.log('   Website: blackwellsales.net');
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
