/**
 * Scrape JB Pavelka Inc inventory with images
 *
 * Run with: npx tsx scripts/scrape-jb-pavelka.ts
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ListingData {
  title: string;
  price: string | null;
  image: string;
  link: string;
  year?: number;
  make?: string;
  model?: string;
  condition?: string;
  location?: string;
}

// Dealer Information
const dealer = {
  email: 'info@jbpavelkainc.com',
  company_name: 'J & B Pavelka, Inc.',
  phone: '(361) 387-5010',
  toll_free: '844-694-2368',
  website: 'https://www.jbpavelkainc.com',
  address: '3205 Highway 44',
  city: 'Robstown',
  state: 'TX',
  zip: '78380',
  about: `J & B Pavelka, Inc. is a premier South Texas pre-owned truck and new/pre-owned trailer dealer since 1997. With locations in Robstown (Corpus Christi), Houston, and Burnet Texas, we offer a full line of Doonan, Manac CPS, Kalyn/Siebert, Talbert, Viking, Eager Beaver, Interstate, Holden, and Protrak trailers. We specialize in Heavy Haul, Oilfield, Wind Energy, Construction, and Railroad industries, with trailers ranging from 25 to 100 ton capacity. Our service department offers complete customization, laser alignments, DOT inspections, and more. We are members of the Used Truck Association (UTA), National Trailer Dealer Association (NTDA), SC&RA, and NATDA.`,
  is_dealer: true,
  locations: [
    { name: 'Robstown', address: '3205 Highway 44', city: 'Robstown', state: 'TX', zip: '78380', phone: '844-694-2368' },
    { name: 'Houston', address: '11113 Wallisville RD', city: 'Houston', state: 'TX', zip: '77013', phone: '844-759-6907' },
    { name: 'Burnet', address: '1103 S Water ST', city: 'Burnet', state: 'TX', zip: '78611', phone: '844-764-3370' },
  ],
};

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
}

async function scrapeInventory(): Promise<ListingData[]> {
  console.log('\n=== Scraping J & B Pavelka, Inc. ===\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const allListings: ListingData[] = [];

  // Different inventory URLs to scrape
  const urls = [
    'https://www.jbpavelkainc.com/Inventory/?/listings/for-sale/trailers/28?accountcrmid=361605&settingscrmid=361605&dlr=1',
    'https://www.jbpavelkainc.com/inventory/?/listings/for-sale/trucks/27?dlr=1&accountcrmid=361604&settingscrmid=361605',
    'https://www.jbpavelkainc.com/inventory/?/listings/for-sale/lowboy-trailers-semi-trailers/18?dlr=1&accountcrmid=361605&settingscrmid=361605',
    'https://www.jbpavelkainc.com/inventory/?/listings/for-sale/drop-deck-trailers-semi-trailers/12?dlr=1&accountcrmid=361605&settingscrmid=361605',
  ];

  for (const url of urls) {
    try {
      console.log(`Loading: ${url.substring(0, 80)}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await new Promise(r => setTimeout(r, 3000));

      // Scroll to load lazy images
      for (let i = 0; i < 5; i++) {
        await autoScroll(page);
        await new Promise(r => setTimeout(r, 1000));
      }

      await new Promise(r => setTimeout(r, 2000));

      // Extract listings
      const listings = await page.evaluate(() => {
        const results: any[] = [];

        const containers = document.querySelectorAll(
          '[class*="listing"], [class*="result"], [class*="item"], [class*="card"], [data-listing]'
        );

        containers.forEach((container) => {
          const link = container.querySelector('a[href*="listing"]') as HTMLAnchorElement;
          const img = container.querySelector('img') as HTMLImageElement;
          const titleEl = container.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');
          const priceEl = container.querySelector('[class*="price"]');
          const locationEl = container.querySelector('[class*="location"], [class*="city"]');

          if (link && img && img.src && !img.src.includes('logo') && !img.src.includes('icon')) {
            const title = titleEl?.textContent?.trim() || 'Unknown';

            // Parse year and make from title
            const yearMatch = title.match(/^(\d{4})\s+/);
            const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

            // Get make (usually after year)
            const makeMatch = title.match(/^\d{4}\s+([A-Z][A-Z\s]+?)(?:\s+\d|\s+[a-z]|$)/i);
            const make = makeMatch ? makeMatch[1].trim().toUpperCase() : undefined;

            results.push({
              title,
              price: priceEl?.textContent?.trim() || null,
              image: img.currentSrc || img.src,
              link: link.href,
              year,
              make,
              location: locationEl?.textContent?.trim() || undefined,
            });
          }
        });

        return results;
      });

      console.log(`  Found ${listings.length} listings`);
      allListings.push(...listings);

    } catch (err) {
      console.log(`  Error: ${(err as Error).message}`);
    }
  }

  await browser.close();

  // Dedupe by link
  const deduped = allListings.filter((v, i, a) => a.findIndex(t => t.link === v.link) === i);
  return deduped;
}

async function seedDealer(listings: ListingData[]) {
  console.log('\n=== Seeding J & B Pavelka, Inc. ===\n');

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

    await supabase
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
        is_dealer: true,
      })
      .eq('id', dealerId);

    console.log('Dealer profile updated.');
  } else {
    console.log('Creating new dealer account...');

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: dealer.email,
      password: 'TempPassword123!',
      email_confirm: true,
      user_metadata: { company_name: dealer.company_name },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    dealerId = authData.user.id;
    console.log('Auth user created:', dealerId);

    await supabase
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
        is_dealer: true,
      })
      .eq('id', dealerId);

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
    // Check if exists
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('user_id', dealerId)
      .eq('title', listing.title)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Determine category
    const isTruck = listing.title.toLowerCase().includes('truck') ||
                    listing.link.includes('trucks');
    const categoryId = isTruck ? trucksCategory.id : trailersCategory.id;

    // Determine condition
    const isNew = listing.title.toLowerCase().includes('new') ||
                  (listing.year && listing.year >= 2024);
    const condition = isNew ? 'New' : 'Used';

    // Parse price
    let price: number | null = null;
    if (listing.price && listing.price !== 'Call for price') {
      const priceMatch = listing.price.replace(/[^0-9]/g, '');
      if (priceMatch) {
        price = parseInt(priceMatch);
      }
    }

    // Get location
    const locationMatch = listing.location?.match(/(\w+),?\s*(\w+)/);
    const city = locationMatch?.[1] || dealer.city;
    const state = locationMatch?.[2] || dealer.state;

    const { data: newListing, error } = await supabase
      .from('listings')
      .insert({
        user_id: dealerId,
        title: listing.title,
        year: listing.year,
        make: listing.make,
        category_id: categoryId,
        condition,
        price,
        city,
        state,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  Error: ${listing.title.substring(0, 40)}: ${error.message}`);
    } else {
      // Insert image into listing_images table
      if (listing.image && newListing) {
        await supabase
          .from('listing_images')
          .insert({
            listing_id: newListing.id,
            url: listing.image,
            is_primary: true,
            sort_order: 0,
          });
      }
      created++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Dealer: ${dealer.company_name} (ID: ${dealerId})`);
  console.log(`Listings created: ${created}`);
  console.log(`Listings skipped: ${skipped}`);

  return { dealerId, created, skipped };
}

async function main() {
  console.log('Starting J & B Pavelka scraper...\n');

  // Scrape inventory
  const listings = await scrapeInventory();
  console.log(`\nTotal unique listings scraped: ${listings.length}`);

  // Save to JSON
  const outputDir = path.join(process.cwd(), 'data', 'dealers');
  fs.writeFileSync(
    path.join(outputDir, 'jb-pavelka-images.json'),
    JSON.stringify(listings, null, 2)
  );
  console.log(`Saved to data/dealers/jb-pavelka-images.json`);

  // Also save full dealer data
  fs.writeFileSync(
    path.join(outputDir, 'jb-pavelka.json'),
    JSON.stringify({
      dealer,
      listings,
      scraped_at: new Date().toISOString(),
    }, null, 2)
  );

  // Seed to database
  await seedDealer(listings);

  console.log('\nDone!');
}

main().catch(console.error);
