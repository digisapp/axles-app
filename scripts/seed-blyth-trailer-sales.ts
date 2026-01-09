/**
 * Seed script for Blyth Trailer Sales
 *
 * Run with: npx tsx scripts/seed-blyth-trailer-sales.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Try multiple env files
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Dealer Information
const dealer = {
  email: 'charlieblyth@blythtrailer.com',
  company_name: 'Blyth Trailer Sales',
  phone: '(314) 270-4008',
  website: 'https://www.blythtrailersales.com',
  location: '300 S. Elam Ave Suite B',
  city: 'Valley Park',
  state: 'MO',
  zip: '63088',
  about: `Blyth Trailer Sales is a class 8 semi trailer dealership located just outside of St. Louis, MO. We buy and sell trailers all over the United States and Canada. We offer a wide selection of flatbeds, drop decks, dry vans, lowboys, and much more from popular brands including Manac, Dorsey Trailer, and XL Specialized Trailers. We also offer competitive financing through BMO Harris, Hitachi, Wells Fargo, and more.`,
  is_dealer: true,
  avatar_url: null,
};

// Sales contacts for reference
const salesContacts = [
  { name: 'Grant Evans', phone: '(314) 607-6969', email: 'grantevans@blythtrailer.com' },
  { name: 'Daniel Rhea', phone: '(314) 800-5680', email: 'danielrhea@blythtrailer.com' },
  { name: 'Charlie Blyth', phone: null, email: 'charlieblyth@blythtrailer.com', role: 'Owner' },
];

// Listings scraped from search results
const listings = [
  // Flatbed Trailers
  {
    title: '2026 DORSEY 53\' x 102" All Aluminum Flatbed with Aero Conestoga',
    year: 2026,
    make: 'DORSEY',
    model: '53\' x 102" All Aluminum Flatbed',
    category_slug: 'trailers',
    condition: 'New',
    price: null, // Call for price
    description: `NEW 2026 Dorsey 53'x102" All Aluminum Flatbeds with Aero Conestoga sliding tarp. Features include:
- Bulkhead access door
- Quad uplift bows for reduced tarp sag
- Air ride suspension with rear axle slide CA legal
- All aluminum 22.5 wheels
- Coil package
- Winch track with 12 sliding winches
Price includes FET and is FOB Valley Park (St. Louis), MO.`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2026 DORSEY 45\' x 102" Steel Flatbed with Forklift Kit',
    year: 2026,
    make: 'DORSEY',
    model: '45\' x 102" Steel Flatbed Lift Hauler',
    category_slug: 'trailers',
    condition: 'New',
    price: 49950,
    description: `New 2026 Dorsey 45'x102" steel flatbeds with forklift kit. Features include:
- Hendrickson INTRAAX 23k air ride suspension
- Universal MT lift hauler
- Heavy duty construction for equipment hauling`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2024 DORSEY 53\' x 102" All Aluminum Flatbed with Aero Conestoga',
    year: 2024,
    make: 'DORSEY',
    model: '53\' x 102" All Aluminum Flatbed',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `NEW 2024 Dorsey 53'x102" All Aluminum Flatbeds with Aero Conestoga sliding tarp. Features include:
- Bulkhead access door
- Quad uplift bows for reduced tarp sag
- Air ride suspension with rear axle slide CA legal`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2024 DORSEY 53\' x 102" Combo Flatbed',
    year: 2024,
    make: 'DORSEY',
    model: '53\' x 102" Combo Flatbed',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `NEW 2024 Dorsey 53'x102" combo flatbeds. Features include:
- Hendrickson Intraax air ride suspension
- Rear axle slide CA legal
- 30" king pin setting
- Aluminum floor and siderails
- 12" x-member spacing`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2024 DORSEY 48\' x 102" Combo Flatbed Spread Axle',
    year: 2024,
    make: 'DORSEY',
    model: '48\' x 102" Combo Flatbed',
    category_slug: 'trailers',
    condition: 'New',
    price: 45950,
    description: `NEW 2024 Dorsey 48'x102" combo flatbeds. Features include:
- Hendrickson Intraax air ride suspension
- Spread axle configuration
- 30" king pin setting
- Aluminum floor and siderails`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  // Drop Deck Trailers
  {
    title: '2026 DORSEY 53\' Steel Drop Deck Air Ride Spread',
    year: 2026,
    make: 'DORSEY',
    model: '53\' Steel Drop Deck',
    category_slug: 'trailers',
    condition: 'New',
    price: 62950,
    description: `NEW 2026 Dorsey 53' steel drop decks with air ride spread. Features include:
- Apitong floor
- Winch track and winches on driver's side
- Steel wheels on LP22.5 tires`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2026 DORSEY 53\' x 102" All Aluminum Drop Deck',
    year: 2026,
    make: 'DORSEY',
    model: '53\' x 102" All Aluminum Drop Deck',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `NEW 2026 Dorsey 53'x102" all aluminum drop decks. Features include:
- Galvanized air ride suspension
- Rear axle slide (CA legal)
- Coil package
- 11' upper deck`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2025 MANAC Darkwing 53\' x 102" All Aluminum Drop Deck',
    year: 2025,
    make: 'MANAC',
    model: 'Darkwing 53\' x 102" All Aluminum Drop Deck',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `New 2025 Manac Darkwing 53'x102" all aluminum drop decks. Features include:
- Hendrickson intraax air ride suspension
- Rear axle slide
- All aluminum wheels
- Winch track`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2024 MANAC 53\' x 102" Combo Drop Deck',
    year: 2024,
    make: 'MANAC',
    model: '53\' x 102" Combo Drop Deck',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `New 2024 Manac 53'x102" Combo Drop Deck. Features include:
- Hendrickson intraax air ride suspension
- Rear axle slide
- Aluminum floor and side rails
- Coil package`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2024 BRAZOS 53\' Combo Drop Deck',
    year: 2024,
    make: 'BRAZOS',
    model: '53\' Combo Drop Deck',
    category_slug: 'trailers',
    condition: 'New',
    price: 39500,
    description: `2024 Brazos 53' combo drop decks. Features include:
- Air ride suspension
- Rear axle slide California legal
- Full ramp kit
- Tool boxes
- Winch track
10 units available.`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  // Lowboy Trailers
  {
    title: '2026 DORSEY 55 Ton Hydraulic RGN Lowboy',
    year: 2026,
    make: 'DORSEY',
    model: '55 Ton Hydraulic RGN Lowboy',
    category_slug: 'trailers',
    condition: 'New',
    price: 78500,
    description: `NEW 2026 Dorsey 55 ton hydraulic RGN lowboys. Features include:
- Honda pony motor
- 102" swing clearance
- 53' overall length
- 25' well
- 22" loaded deck height
- Apitong floor covering`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2026 DORSEY LB35-33CS 35 Ton Fixed Neck Lowboy',
    year: 2026,
    make: 'DORSEY',
    model: 'LB35-33CS 35 Ton Fixed Neck Lowboy',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `New 2026 Dorsey LB35-33CS 35 ton fixed neck lowboy, contractor special neck. Specifications:
- 45'4" x 102"
- 33" loaded deck height
- 27' main deck
- 8'6" upper deck`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
  {
    title: '2025 XL SPECIALIZED 35 Ton Lowboy',
    year: 2025,
    make: 'XL SPECIALIZED',
    model: '35 Ton Lowboy',
    category_slug: 'trailers',
    condition: 'New',
    price: 119950,
    description: `XL Specialized 35 ton lowboy trailer. Features include:
- 35 ton payload capacity
- 53 ft length
- 102 in width
- Wood floor`,
    city: 'Valley Park',
    state: 'MO',
    status: 'active',
  },
];

async function seedDealer() {
  console.log('Seeding Blyth Trailer Sales...\n');

  // Check if dealer already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', dealer.email)
    .single();

  let dealerId: string;

  if (existingProfile) {
    console.log('Dealer profile already exists, updating...');
    dealerId = existingProfile.id;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        company_name: dealer.company_name,
        phone: dealer.phone,
        website: dealer.website,
        location: dealer.location,
        city: dealer.city,
        state: dealer.state,
        about: dealer.about,
        is_dealer: true,
      })
      .eq('id', dealerId);

    if (updateError) {
      console.error('Error updating dealer:', updateError);
      return;
    }
    console.log('Dealer profile updated.');
  } else {
    // Create auth user first
    console.log('Creating new dealer account...');

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: dealer.email,
      password: 'TempPassword123!', // They'll need to reset this
      email_confirm: true,
      user_metadata: {
        company_name: dealer.company_name,
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    dealerId = authData.user.id;
    console.log('Auth user created:', dealerId);

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        company_name: dealer.company_name,
        phone: dealer.phone,
        website: dealer.website,
        location: dealer.location,
        city: dealer.city,
        state: dealer.state,
        about: dealer.about,
        is_dealer: true,
      })
      .eq('id', dealerId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return;
    }
    console.log('Dealer profile created.');
  }

  // Get trailers category ID
  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'trailers')
    .single();

  if (!category) {
    console.error('Trailers category not found!');
    return;
  }

  // Seed listings
  console.log(`\nSeeding ${listings.length} listings...`);

  let created = 0;
  let skipped = 0;

  for (const listing of listings) {
    // Check if listing already exists (by title and dealer)
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('user_id', dealerId)
      .eq('title', listing.title)
      .single();

    if (existing) {
      console.log(`  Skipping (exists): ${listing.title}`);
      skipped++;
      continue;
    }

    const { error: listingError } = await supabase
      .from('listings')
      .insert({
        user_id: dealerId,
        title: listing.title,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        category_id: category.id,
        condition: listing.condition,
        price: listing.price,
        description: listing.description,
        city: listing.city,
        state: listing.state,
        status: listing.status,
      });

    if (listingError) {
      console.error(`  Error creating listing "${listing.title}":`, listingError);
    } else {
      console.log(`  Created: ${listing.title}`);
      created++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Dealer: ${dealer.company_name} (ID: ${dealerId})`);
  console.log(`Listings created: ${created}`);
  console.log(`Listings skipped: ${skipped}`);
  console.log(`\nSales Contacts:`);
  salesContacts.forEach(c => console.log(`  - ${c.name}: ${c.email}${c.phone ? ', ' + c.phone : ''}`));
  console.log(`\nNote: Dealer password is "TempPassword123!" - they should reset it.`);
}

seedDealer()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
