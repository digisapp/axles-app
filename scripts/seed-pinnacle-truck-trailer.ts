/**
 * Seed script for Pinnacle Truck & Trailer
 *
 * Run with: npx tsx scripts/seed-pinnacle-truck-trailer.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Dealer Information
const dealer = {
  email: 'info@pinnaclellc.us',
  company_name: 'Pinnacle Truck & Trailer',
  phone: '(615) 793-9890',
  fax: '(615) 793-6825',
  toll_free: '800-738-3188',
  website: 'https://www.pinnaclellc.us',
  address: '176 Charter Pl',
  city: 'La Vergne',
  state: 'TN',
  zip: '37086',
  about: `Pinnacle Truck & Trailer is a one-stop-shop for trucks, trailers, service, and parts located in La Vergne (Nashville), Tennessee. We specialize in truck and trailer sales throughout Tennessee, carrying equipment from trusted brands like XL Specialized Trailers, Transcraft, Benson, Extreme Trailers, Reitnouer, Fontaine, and Liddell. We have 6 service bays to handle repairs on Flatbeds, Drop Decks, Lowboys, Dry Vans, Reefers, and Car Haulers. We specialize in pre-emission trucks for the Owner Operator. Competitive financing rates available from a variety of lenders.`,
  is_dealer: true,
  business_hours: {
    monday: '8:00 AM - 5:00 PM',
    tuesday: '8:00 AM - 5:00 PM',
    wednesday: '8:00 AM - 5:00 PM',
    thursday: '8:00 AM - 5:00 PM',
    friday: '8:00 AM - 5:00 PM',
    saturday: 'Closed',
    sunday: 'Closed',
  },
};

// Sales contacts
const salesContacts = [
  { name: 'Chuck Guinn', role: 'General Manager', phone: null, email: null },
  { name: 'Perry Franks', role: 'Sales', phone: '(615) 434-7129', email: null },
];

// Listings from search results
const listings = [
  // Trucks
  {
    title: 'Kenworth W900 Day Cab Custom Paint',
    year: null,
    make: 'KENWORTH',
    model: 'W900 Day Cab',
    category_slug: 'trucks',
    condition: 'Used',
    price: 105000,
    description: `Kenworth W900 Day Cab with custom paint. Converted to day cab with new hood by Rush Peterbilt. Platinum overhaul with Cat parts less than 4,000 miles ago. New hood and seats.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'Peterbilt 379EXHD Sleeper Truck',
    year: null,
    make: 'PETERBILT',
    model: '379EXHD Sleeper',
    category_slug: 'trucks',
    condition: 'Used',
    price: null,
    description: `Pre-emission Peterbilt 379EXHD sleeper truck. Ideal for Owner Operators looking for reliable pre-emission trucks.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'Kenworth T660',
    year: null,
    make: 'KENWORTH',
    model: 'T660',
    category_slug: 'trucks',
    condition: 'Used',
    price: null,
    description: `Kenworth T660 available. Contact for details and pricing.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  // Flatbed Trailers
  {
    title: '2025 BENSON 48\' x 102" Aluminum Flatbed',
    year: 2025,
    make: 'BENSON',
    model: '48\' x 102" Aluminum Flatbed',
    category_slug: 'trailers',
    condition: 'New',
    price: 59610,
    stock_number: '28882',
    description: `New Benson 48' x 102" aluminum flatbed trailer. Features air ride suspension. Payments as low as $1,266.54/month. 3 units available.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'BENSON 53\' x 102" Aluminum Flatbed',
    year: null,
    make: 'BENSON',
    model: '53\' x 102" Aluminum Flatbed',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `Benson 53' x 102" aluminum flatbed trailer. Standard concentrated load capacity of 52,000# in 4', 55,000# in 10' and evenly distributed load capacity of 105,000#.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  // Drop Deck Trailers
  {
    title: '2025 EXTREME TRAILERS 53\' x 102" Drop Deck',
    year: 2025,
    make: 'EXTREME TRAILERS',
    model: '53\' x 102" Drop Deck',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `New 2025 Extreme Trailers 53' x 102" drop deck. Features include:
- 11' top deck
- 24" kingpin
- 42' lower deck
- 4 rows of J-track
- Coil package
- 16 zinc sliding winches
- Bridgestone tires
- Aluminum wheels
- Meritor PSI inflation system
Empty weight: 11,763#`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: '2025 BENSON/WABASH 53\' x 102" Aluminum Drop Deck',
    year: 2025,
    make: 'BENSON',
    model: '53\' x 102" Aluminum Drop Deck',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `New Benson/Wabash 53' x 102" Aluminum Drop Deck with RAS LO PRO STEP DECK configuration.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: '2025 XP55 55,000# Drop Deck 48\' x 102"',
    year: 2025,
    make: 'XL SPECIALIZED',
    model: 'XP55 55,000# Drop Deck',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `New 2025 XP55 with 55,000# capacity in 4'. Dimensions: 48' x 102" with 30" kingpin.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  // Lowboy Trailers
  {
    title: 'XL SPECIALIZED Flip Axle Low Profile Lowboy',
    year: null,
    make: 'XL SPECIALIZED',
    model: 'Flip Axle Low Profile',
    category_slug: 'trailers',
    condition: 'Used',
    price: 14900,
    stock_number: '28112',
    description: `XL Specialized Flip Axle Low Profile lowboy trailer. Single rear axle configuration.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'XL SPECIALIZED 55 Ton Paver Special Lowboy',
    year: null,
    make: 'XL SPECIALIZED',
    model: '55 Ton Paver Special',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `XL Specialized 55 Ton Paver Special lowboy trailer. Heavy duty construction for paving equipment.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'XL SPECIALIZED 45 Ton Lowboy with 29\' Well & Hyd Flip Axle',
    year: null,
    make: 'XL SPECIALIZED',
    model: '45 Ton w/ 29\' Well & Hyd Flip Axle',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `XL Specialized 45 Ton lowboy with 29' well and hydraulic flip axle.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'XL SPECIALIZED 90HDE Super Stretch',
    year: null,
    make: 'XL SPECIALIZED',
    model: '90HDE Super Stretch',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `XL Specialized 90HDE Super Stretch trailer for oversized loads.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  // Fontaine Trailers
  {
    title: 'FONTAINE 53\' Tri Axle Trailer',
    year: null,
    make: 'FONTAINE',
    model: '53\' Tri Axle',
    category_slug: 'trailers',
    condition: 'New',
    price: 82300,
    stock_number: '29169',
    description: `Fontaine 53' tri axle trailer. Heavy duty configuration.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'FONTAINE 55MX Lowboy',
    year: null,
    make: 'FONTAINE',
    model: '55MX',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `Fontaine 55MX lowboy trailer.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'FONTAINE 55LCC Lowboy',
    year: null,
    make: 'FONTAINE',
    model: '55LCC',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `Fontaine 55LCC lowboy trailer.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'FONTAINE Excalibur 53-90 Extendable',
    year: null,
    make: 'FONTAINE',
    model: 'Excalibur 53-90 Extendable',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `Fontaine Excalibur 53-90 Extendable trailer. Extends from 53' to 90'.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  // Reitnouer Trailers
  {
    title: '2014 REITNOUER Maxlite Flatbed',
    year: 2014,
    make: 'REITNOUER',
    model: 'Maxlite',
    category_slug: 'trailers',
    condition: 'Used',
    price: null,
    description: `2014 Reitnouer Maxlite flatbed trailer. Lightweight aluminum construction.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'REITNOUER Bigger Bubba Flatbed',
    year: null,
    make: 'REITNOUER',
    model: 'Bigger Bubba',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `Reitnouer Bigger Bubba flatbed trailer. Heavy duty aluminum construction.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  {
    title: 'REITNOUER Maxmiser Flatbed',
    year: null,
    make: 'REITNOUER',
    model: 'Maxmiser',
    category_slug: 'trailers',
    condition: 'New',
    price: null,
    description: `Reitnouer Maxmiser flatbed trailer. Maximum payload capacity design.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  // Curtain Side Trailer
  {
    title: 'Curtain Side / Roll Tarp Trailer 48\' x 102"',
    year: null,
    make: 'WABASH',
    model: '48\' x 102" Curtain Side',
    category_slug: 'trailers',
    condition: 'Used',
    price: 47500,
    stock_number: '14954',
    description: `48' x 102" aluminum curtain side / roll tarp trailer. Air ride suspension. Payments as low as $1,009.23/month.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
  // Other Trailers with prices from search
  {
    title: 'REITNOUER 53\' Trailer with Ramps',
    year: null,
    make: 'REITNOUER',
    model: '53\' with Ramps',
    category_slug: 'trailers',
    condition: 'New',
    price: 84521,
    stock_number: '29072',
    description: `Reitnouer 53' trailer with ramps. 12% FET included in pricing.`,
    city: 'La Vergne',
    state: 'TN',
    status: 'active',
  },
];

async function seedDealer() {
  console.log('Seeding Pinnacle Truck & Trailer...\n');

  // Check if dealer already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', dealer.company_name)
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
        address: dealer.address,
        city: dealer.city,
        state: dealer.state,
        zip_code: dealer.zip,
        about: dealer.about,
        business_hours: dealer.business_hours,
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
      password: 'TempPassword123!',
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
        address: dealer.address,
        city: dealer.city,
        state: dealer.state,
        zip_code: dealer.zip,
        about: dealer.about,
        business_hours: dealer.business_hours,
        is_dealer: true,
      })
      .eq('id', dealerId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return;
    }
    console.log('Dealer profile created.');
  }

  // Get category IDs
  const { data: trailersCategory } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'trailers')
    .single();

  const { data: trucksCategory } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'trucks')
    .single();

  if (!trailersCategory || !trucksCategory) {
    console.error('Categories not found!');
    return;
  }

  // Seed listings
  console.log(`\nSeeding ${listings.length} listings...`);

  let created = 0;
  let skipped = 0;

  for (const listing of listings) {
    // Check if listing already exists
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

    const categoryId = listing.category_slug === 'trucks' ? trucksCategory.id : trailersCategory.id;

    const { error: listingError } = await supabase
      .from('listings')
      .insert({
        user_id: dealerId,
        title: listing.title,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        category_id: categoryId,
        condition: listing.condition,
        price: listing.price,
        description: listing.description,
        city: listing.city,
        state: listing.state,
        status: listing.status,
        stock_number: (listing as any).stock_number || null,
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
  console.log(`Address: ${dealer.address}, ${dealer.city}, ${dealer.state} ${dealer.zip}`);
  console.log(`Phone: ${dealer.phone} | Toll-free: ${dealer.toll_free}`);
  console.log(`Website: ${dealer.website}`);
  console.log(`Listings created: ${created}`);
  console.log(`Listings skipped: ${skipped}`);
  console.log(`\nSales Contacts:`);
  salesContacts.forEach(c => console.log(`  - ${c.name} (${c.role})${c.phone ? ': ' + c.phone : ''}`));
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
