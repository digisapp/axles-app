import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Security: Only allow seeding in development or by admin users
const ALLOW_SEED = process.env.NODE_ENV === 'development' || process.env.ALLOW_DATABASE_SEED === 'true';

// Sample truck and trailer listings
const sampleListings = [
  // Heavy Duty Trucks
  {
    title: '2022 Peterbilt 579 Ultraloft Sleeper',
    price: 165000,
    price_type: 'negotiable',
    condition: 'used',
    year: 2022,
    make: 'Peterbilt',
    model: '579',
    vin: '1XPWD49X7ND123456',
    mileage: 245000,
    description: 'Well-maintained 2022 Peterbilt 579 with Ultraloft 80" sleeper. Cummins X15 engine with 500HP, Eaton Fuller 18-speed transmission. APU installed, new tires all around. Full service records available. Perfect for owner-operators looking for reliability and comfort.',
    city: 'Dallas',
    state: 'TX',
    zip_code: '75201',
    specs: {
      engine: 'Cummins X15',
      hp: '500',
      transmission: 'Eaton Fuller 18-speed',
      sleeper: '80" Ultraloft',
      wheelbase: '244"',
      rearAxle: '40,000 lbs'
    },
    category_slug: 'sleeper-trucks'
  },
  {
    title: '2020 Kenworth W900L Studio Sleeper',
    price: 189000,
    price_type: 'fixed',
    condition: 'used',
    year: 2020,
    make: 'Kenworth',
    model: 'W900L',
    vin: '1XKWD49X7LR654321',
    mileage: 312000,
    description: 'Iconic 2020 Kenworth W900L with 86" Studio Sleeper. PACCAR MX-13 engine producing 510HP. Showroom condition inside and out. Chrome package, custom interior, all new LED lighting. This truck turns heads everywhere it goes.',
    city: 'Houston',
    state: 'TX',
    zip_code: '77001',
    specs: {
      engine: 'PACCAR MX-13',
      hp: '510',
      transmission: 'Eaton Fuller 18-speed',
      sleeper: '86" Studio',
      wheelbase: '280"',
      rearAxle: '46,000 lbs'
    },
    category_slug: 'sleeper-trucks'
  },
  {
    title: '2021 Freightliner Cascadia Day Cab',
    price: 89500,
    price_type: 'negotiable',
    condition: 'used',
    year: 2021,
    make: 'Freightliner',
    model: 'Cascadia',
    vin: '3AKJHHDR5MSAB1234',
    mileage: 198000,
    description: 'Fleet-maintained 2021 Freightliner Cascadia day cab. Detroit DD15 engine, DT12 automated transmission. Ideal for regional hauls. Clean interior, no accidents. DOT ready and road-tested.',
    city: 'Phoenix',
    state: 'AZ',
    zip_code: '85001',
    specs: {
      engine: 'Detroit DD15',
      hp: '455',
      transmission: 'DT12 Automated',
      wheelbase: '176"',
      rearAxle: '40,000 lbs'
    },
    category_slug: 'day-cab-trucks'
  },
  {
    title: '2019 Volvo VNL 760 Sleeper',
    price: 115000,
    price_type: 'negotiable',
    condition: 'used',
    year: 2019,
    make: 'Volvo',
    model: 'VNL 760',
    vin: '4V4NC9EH8KN123789',
    mileage: 425000,
    description: 'Reliable 2019 Volvo VNL 760 with 70" mid-roof sleeper. D13 engine with 455HP, I-Shift 12-speed automated. New batteries, recent PM service. Great fuel economy for long-haul operations.',
    city: 'Atlanta',
    state: 'GA',
    zip_code: '30301',
    specs: {
      engine: 'Volvo D13',
      hp: '455',
      transmission: 'I-Shift 12-speed',
      sleeper: '70" Mid-roof',
      wheelbase: '223"',
      fuelTank: '150 gallons'
    },
    category_slug: 'sleeper-trucks'
  },
  {
    title: '2023 Mack Anthem Day Cab',
    price: 145000,
    price_type: 'fixed',
    condition: 'certified',
    year: 2023,
    make: 'Mack',
    model: 'Anthem',
    vin: '1M1AN4GY3PM567890',
    mileage: 78000,
    description: 'Like-new 2023 Mack Anthem day cab with remaining factory warranty. MP8 engine with 505HP, mDRIVE 12-speed automated. Premium interior package, lane departure warning, collision mitigation. Perfect for regional or local applications.',
    city: 'Chicago',
    state: 'IL',
    zip_code: '60601',
    specs: {
      engine: 'Mack MP8',
      hp: '505',
      transmission: 'mDRIVE 12-speed',
      wheelbase: '180"',
      rearAxle: '40,000 lbs'
    },
    category_slug: 'day-cab-trucks'
  },
  {
    title: '2018 International LT Day Cab',
    price: 67500,
    price_type: 'negotiable',
    condition: 'used',
    year: 2018,
    make: 'International',
    model: 'LT',
    vin: '3HSDZAPR4JN987654',
    mileage: 512000,
    description: 'Budget-friendly 2018 International LT day cab. Cummins X15 engine, manual transmission. Well-maintained with complete service history. Great starter truck for new owner-operators.',
    city: 'Denver',
    state: 'CO',
    zip_code: '80201',
    specs: {
      engine: 'Cummins X15',
      hp: '450',
      transmission: 'Eaton Fuller 10-speed',
      wheelbase: '175"'
    },
    category_slug: 'day-cab-trucks'
  },

  // Trailers
  {
    title: '2021 Great Dane 53ft Reefer Trailer',
    price: 72000,
    price_type: 'negotiable',
    condition: 'used',
    year: 2021,
    make: 'Great Dane',
    model: 'Everest SS',
    vin: '1GRAA0628MB001234',
    mileage: null,
    hours: 8500,
    description: 'Well-maintained 2021 Great Dane 53ft reefer trailer with Carrier X4 7500 unit. Multi-temp capable. Good interior condition, recently serviced refrigeration unit. Swing doors, air ride suspension.',
    city: 'Los Angeles',
    state: 'CA',
    zip_code: '90001',
    specs: {
      length: '53ft',
      unit: 'Carrier X4 7500',
      interior: 'Aluminum',
      doors: 'Swing',
      suspension: 'Air ride'
    },
    category_slug: 'reefer-trailers'
  },
  {
    title: '2020 Utility 53ft Dry Van',
    price: 34500,
    price_type: 'fixed',
    condition: 'used',
    year: 2020,
    make: 'Utility',
    model: '4000D-X',
    vin: '1UYVS2536LA456789',
    mileage: null,
    description: 'Clean 2020 Utility 53ft dry van trailer. Logistic posts, E-track, LED lights. Wood floor in good condition. Air ride suspension. Ready for work.',
    city: 'Newark',
    state: 'NJ',
    zip_code: '07101',
    specs: {
      length: '53ft',
      interior: 'Logistic posts, E-track',
      floor: 'Wood',
      doors: 'Roll-up',
      suspension: 'Air ride'
    },
    category_slug: 'dry-van-trailers'
  },
  {
    title: '2019 Wabash DuraPlate 53ft Dry Van',
    price: 28000,
    price_type: 'negotiable',
    condition: 'used',
    year: 2019,
    make: 'Wabash',
    model: 'DuraPlate',
    vin: '1JJV532D9KL789012',
    mileage: null,
    description: 'Solid 2019 Wabash DuraPlate 53ft dry van. Proven durability with the DuraPlate HD side panels. Recently inspected and DOT ready. Minor cosmetic wear consistent with age.',
    city: 'Memphis',
    state: 'TN',
    zip_code: '38101',
    specs: {
      length: '53ft',
      interior: 'Logistic posts',
      floor: 'Wood',
      suspension: 'Spring ride'
    },
    category_slug: 'dry-van-trailers'
  },
  {
    title: '2022 Fontaine Infinity 53ft Flatbed',
    price: 52000,
    price_type: 'fixed',
    condition: 'used',
    year: 2022,
    make: 'Fontaine',
    model: 'Infinity',
    vin: '13N24830XN1234567',
    mileage: null,
    description: '2022 Fontaine Infinity 53ft aluminum combo flatbed. Steel main beams with aluminum floor. Winch track, chain tie-downs, coil package. Excellent condition with minimal use.',
    city: 'Nashville',
    state: 'TN',
    zip_code: '37201',
    specs: {
      length: '53ft',
      construction: 'Aluminum combo',
      features: 'Winch track, chain tie-downs, coil package',
      suspension: 'Air ride'
    },
    category_slug: 'flatbed-trailers'
  },

  // Dump Trucks
  {
    title: '2020 Kenworth T880 Dump Truck',
    price: 175000,
    price_type: 'negotiable',
    condition: 'used',
    year: 2020,
    make: 'Kenworth',
    model: 'T880',
    vin: '1NKZL40X7LJ890123',
    mileage: 89000,
    description: 'Powerful 2020 Kenworth T880 dump truck with 16ft steel dump body. PACCAR MX-13 engine with 510HP. Tandem axle, air ride cab. Perfect for construction and aggregate hauling.',
    city: 'Seattle',
    state: 'WA',
    zip_code: '98101',
    specs: {
      engine: 'PACCAR MX-13',
      hp: '510',
      transmission: 'Allison 4500',
      body: '16ft Steel Dump',
      axles: 'Tandem'
    },
    category_slug: 'dump-trucks'
  },
  {
    title: '2017 Peterbilt 567 Tri-Axle Dump',
    price: 135000,
    price_type: 'negotiable',
    condition: 'used',
    year: 2017,
    make: 'Peterbilt',
    model: '567',
    vin: '1XPCD49X8HD456789',
    mileage: 156000,
    description: 'Heavy-hauler 2017 Peterbilt 567 tri-axle dump truck. Cummins ISX15 engine, Allison automatic. 18ft aluminum dump body with electric tarp. Ready for heavy loads.',
    city: 'Portland',
    state: 'OR',
    zip_code: '97201',
    specs: {
      engine: 'Cummins ISX15',
      hp: '500',
      transmission: 'Allison 4700',
      body: '18ft Aluminum Dump',
      axles: 'Tri-axle'
    },
    category_slug: 'dump-trucks'
  },

  // Box Trucks
  {
    title: '2021 Freightliner M2 26ft Box Truck',
    price: 68000,
    price_type: 'fixed',
    condition: 'used',
    year: 2021,
    make: 'Freightliner',
    model: 'M2 106',
    vin: '1FVACXDT7MHAB5678',
    mileage: 112000,
    description: 'Fleet-maintained 2021 Freightliner M2 with 26ft Morgan box. Cummins B6.7 engine, automatic transmission. Maxon liftgate included. Perfect for local delivery operations.',
    city: 'Miami',
    state: 'FL',
    zip_code: '33101',
    specs: {
      engine: 'Cummins B6.7',
      hp: '260',
      transmission: 'Allison Automatic',
      body: '26ft Morgan Box',
      liftgate: 'Maxon 3000lb'
    },
    category_slug: 'box-trucks'
  },
  {
    title: '2019 Hino 268 24ft Box Truck',
    price: 48500,
    price_type: 'negotiable',
    condition: 'used',
    year: 2019,
    make: 'Hino',
    model: '268',
    vin: '5PVNJ8JV0K4123456',
    mileage: 145000,
    description: 'Reliable 2019 Hino 268 with 24ft dry freight box. J08E diesel engine, automatic transmission. Walk ramp included. Great for furniture delivery or moving services.',
    city: 'Boston',
    state: 'MA',
    zip_code: '02101',
    specs: {
      engine: 'Hino J08E',
      hp: '220',
      transmission: 'Allison Automatic',
      body: '24ft Dry Freight',
      ramp: 'Walk ramp included'
    },
    category_slug: 'box-trucks'
  },

  // Heavy Equipment
  {
    title: '2020 Caterpillar 320 Excavator',
    price: 225000,
    price_type: 'negotiable',
    condition: 'used',
    year: 2020,
    make: 'Caterpillar',
    model: '320',
    vin: null,
    mileage: null,
    hours: 3200,
    description: 'Low-hour 2020 Cat 320 excavator. C4.4 ACERT engine with 162HP. Grade with Assist, 2D e-fence, and Cat LINK technologies. 10ft 2in stick, quick coupler, 36" bucket included.',
    city: 'San Antonio',
    state: 'TX',
    zip_code: '78201',
    specs: {
      engine: 'Cat C4.4 ACERT',
      hp: '162',
      operatingWeight: '50,000 lbs',
      digDepth: '22ft 6in',
      features: 'Grade with Assist, 2D e-fence'
    },
    category_slug: 'excavators'
  },
  {
    title: '2018 John Deere 544L Wheel Loader',
    price: 145000,
    price_type: 'fixed',
    condition: 'used',
    year: 2018,
    make: 'John Deere',
    model: '544L',
    vin: null,
    mileage: null,
    hours: 5800,
    description: '2018 John Deere 544L wheel loader. PowerTech Plus 6.8L engine. Ride control, limited slip differentials, and joystick steering. 3.0 yd bucket. Well-maintained with service records.',
    city: 'Kansas City',
    state: 'MO',
    zip_code: '64101',
    specs: {
      engine: 'John Deere PowerTech 6.8L',
      hp: '186',
      operatingWeight: '34,500 lbs',
      bucket: '3.0 cubic yards',
      features: 'Ride control, joystick steering'
    },
    category_slug: 'loaders'
  }
];

export async function POST() {
  try {
    // Security check: Only allow in development or with explicit permission
    if (!ALLOW_SEED) {
      // In production, require admin authentication
      const authClient = await createServerClient();
      const { data: { user } } = await authClient.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Check if user is admin
      const { data: profile } = await authClient
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    // Initialize admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, get all categories to map slugs to IDs
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, slug');

    if (catError) {
      logger.error('Error fetching categories', { error: catError });
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    const categoryMap = new Map(categories?.map(c => [c.slug, c.id]) || []);

    // Create a demo user profile if needed (or use first existing user)
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    let userId: string;

    if (existingProfiles && existingProfiles.length > 0) {
      userId = existingProfiles[0].id;
    } else {
      // Create a demo profile
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: 'demo@axlon.ai',
        password: 'demo-password-123',
        email_confirm: true,
      });

      if (authError || !authUser.user) {
        logger.error('Error creating demo user', { error: authError });
        return NextResponse.json({ error: 'Failed to create demo user' }, { status: 500 });
      }

      // Create profile
      await supabase.from('profiles').insert({
        id: authUser.user.id,
        email: 'demo@axlon.ai',
        company_name: 'AxlonAI Demo',
        phone: '555-123-4567',
        location: 'Dallas, TX',
        is_dealer: true,
      });

      userId = authUser.user.id;
    }

    // Insert listings
    const listingsToInsert = sampleListings.map(listing => {
      const { category_slug, ...listingData } = listing;
      return {
        ...listingData,
        user_id: userId,
        category_id: categoryMap.get(category_slug) || null,
        status: 'active',
        published_at: new Date().toISOString(),
      };
    });

    const { data: insertedListings, error: insertError } = await supabase
      .from('listings')
      .insert(listingsToInsert)
      .select('id, title');

    if (insertError) {
      logger.error('Error inserting listings', { error: insertError });
      return NextResponse.json({ error: 'Failed to insert listings', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${insertedListings?.length || 0} sample listings`,
      listings: insertedListings,
    });

  } catch (error) {
    logger.error('Seed error', { error });
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 });
  }
}

// GET endpoint to check seed status
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { count } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      listingsCount: count || 0,
      sampleDataAvailable: sampleListings.length,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
