// @ts-nocheck
/**
 * Scrape Don Baskin Truck Sales directly from their website
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

puppeteer.use(StealthPlugin());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Don Baskin Truck Sales',
  email: 'inventory@baskintrucksales.com',
  phone: '(901) 401-7024',
  city: 'Covington',
  state: 'TN',
  website: 'https://www.baskintrucksales.com'
};

// Inventory pages on baskintrucksales.com
const INVENTORY_PAGES = [
  { url: 'https://www.baskintrucksales.com/Inventory/?/listings/for-sale/trucks/27?DSCompanyID=7164&settingscrmid=362413', type: 'trucks' },
  { url: 'https://www.baskintrucksales.com/Inventory/?/listings/for-sale/trailers/28?DSCompanyID=7164&settingscrmid=362413', type: 'trailers' },
  { url: 'https://www.baskintrucksales.com/Inventory/?/listings/for-sale/construction-equipment/4?DSCompanyID=7164&settingscrmid=362413', type: 'equipment' },
];

const CATEGORY_MAP = {
  'sleeper': 'sleeper-trucks',
  'day cab': 'day-cab-trucks',
  'dump truck': 'dump-trucks',
  'dump': 'dump-trucks',
  'cab chassis': 'cab-chassis',
  'cab & chassis': 'cab-chassis',
  'garbage': 'vacuum-trucks',
  'roll-off': 'vacuum-trucks',
  'service': 'service-trucks',
  'mechanic': 'service-trucks',
  'utility': 'service-trucks',
  'tow truck': 'wrecker-trucks',
  'wrecker': 'wrecker-trucks',
  'water truck': 'water-trucks',
  'vacuum': 'vacuum-trucks',
  'flatbed truck': 'flatbed-trucks',
  'fuel truck': 'fuel-trucks',
  'box truck': 'box-trucks',
  'mixer': 'medium-duty-trucks',
  'concrete': 'medium-duty-trucks',
  'bucket': 'bucket-trucks',
  'crane': 'boom-trucks',
  'grapple': 'service-trucks',
  'dry van': 'dry-van-trailers',
  'flatbed trailer': 'flatbed-trailers',
  'lowboy': 'lowboy-trailers',
  'end dump': 'end-dump-trailers',
  'reefer': 'reefer-trailers',
  'step deck': 'step-deck-trailers',
  'drop deck': 'step-deck-trailers',
  'tank trailer': 'tank-trailers',
  'dozer': 'bulldozers',
  'excavator': 'excavators',
  'forklift': 'forklifts',
  'loader': 'loaders',
  'backhoe': 'loaders',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getOrCreateDealer() {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', DEALER_INFO.name)
    .single();

  if (existing) {
    console.log('✓ Dealer exists:', DEALER_INFO.name);
    return existing.id;
  }

  const password = 'Baskin2024!';
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
    city: DEALER_INFO.city,
    state: DEALER_INFO.state,
    is_dealer: true,
    website: DEALER_INFO.website,
  }).eq('id', authUser.user.id);

  console.log('✓ Created dealer:', DEALER_INFO.name);
  return authUser.user.id;
}

async function getCategoryId(title, defaultType) {
  const titleLower = title.toLowerCase();
  let categorySlug = defaultType === 'trailers' ? 'flatbed-trailers' :
                     defaultType === 'equipment' ? 'loaders' : 'heavy-duty-trucks';

  const sortedKeywords = Object.entries(CATEGORY_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, slug] of sortedKeywords) {
    if (titleLower.includes(keyword)) {
      categorySlug = slug;
      break;
    }
  }

  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  return cat?.id;
}

async function main() {
  console.log('🚛 Scraping Don Baskin Truck Sales');
  console.log('   Direct from: baskintrucksales.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Override webdriver detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  let totalImported = 0;
  let allListings = [];

  for (const inv of INVENTORY_PAGES) {
    console.log(`\n📦 Scraping ${inv.type}...`);

    try {
      await page.goto(inv.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(5000);

      // Check for iframe with inventory
      const frames = page.frames();
      console.log(`   Found ${frames.length} frames`);

      for (const frame of frames) {
        const frameUrl = frame.url();
        if (frameUrl.includes('sandhills') || frameUrl.includes('truckpaper')) {
          console.log(`   Found Sandhills iframe`);

          // Wait for content to load in iframe
          await sleep(3000);

          const listings = await frame.evaluate(() => {
            const items = [];
            // Look for listing links
            document.querySelectorAll('a[href*="/listing/"], a[href*="/Listing/"]').forEach(el => {
              const href = el.getAttribute('href');
              if (href && !items.some(i => i.url === href)) {
                const row = el.closest('tr, .row, .listing, div');
                items.push({
                  url: href.startsWith('http') ? href : 'https://www.truckpaper.com' + href,
                  title: row?.textContent?.trim()?.substring(0, 200) || el.textContent?.trim() || ''
                });
              }
            });
            return items;
          });

          console.log(`   Found ${listings.length} in iframe`);

          for (const l of listings) {
            l.type = inv.type;
            if (!allListings.some(x => x.url === l.url)) {
              allListings.push(l);
            }
          }
        }
      }

      // Also check main page
      const mainListings = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('a[href*="/listing/"], a[href*="/Listing/"]').forEach(el => {
          const href = el.getAttribute('href');
          if (href && !items.some(i => i.url === href)) {
            items.push({
              url: href.startsWith('http') ? href : 'https://www.truckpaper.com' + href,
              title: el.textContent?.trim() || ''
            });
          }
        });
        return items;
      });

      if (mainListings.length > 0) {
        console.log(`   Found ${mainListings.length} on main page`);
        for (const l of mainListings) {
          l.type = inv.type;
          if (!allListings.some(x => x.url === l.url)) {
            allListings.push(l);
          }
        }
      }

    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
  }

  console.log(`\n📋 Total unique listings: ${allListings.length}\n`);

  if (allListings.length === 0) {
    console.log('No listings found. Taking screenshot...');
    await page.screenshot({ path: '/tmp/baskin-final.png', fullPage: true });
    await browser.close();
    return;
  }

  // Process each listing
  for (let i = 0; i < allListings.length; i++) {
    const listing = allListings[i];
    process.stdout.write(`[${i+1}/${allListings.length}] `);

    try {
      await sleep(2000 + Math.random() * 1000);
      await page.goto(listing.url, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      const details = await page.evaluate(() => {
        const images = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src &&
              (src.includes('sandhills') || src.includes('cloudinary')) &&
              !src.includes('logo') && !src.includes('icon') &&
              !src.includes('flag') && !src.includes('.gif')) {
            images.push(src);
          }
        });

        const title = document.querySelector('h1')?.textContent?.trim() || '';
        const priceMatch = document.body.textContent?.match(/\$([\d,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
        const yearMatch = title.match(/^(\d{4})/);
        const year = yearMatch ? parseInt(yearMatch[1]) : null;

        const makes = ['PETERBILT', 'KENWORTH', 'FREIGHTLINER', 'INTERNATIONAL', 'MACK', 'VOLVO'];
        let make = '';
        for (const m of makes) {
          if (title.toUpperCase().includes(m)) { make = m; break; }
        }

        return { images: [...new Set(images)], title, price, year, make };
      });

      process.stdout.write(`${details.title?.substring(0, 35)}...`);

      if (details.images.length === 0) {
        console.log(' no images');
        continue;
      }

      // Check duplicate
      const { data: exists } = await supabase
        .from('listings')
        .select('id')
        .eq('title', details.title)
        .eq('user_id', dealerId)
        .single();

      if (exists) {
        console.log(' duplicate');
        continue;
      }

      const categoryId = await getCategoryId(details.title, listing.type);

      const { data: newListing, error } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: details.title,
        description: details.title,
        price: details.price,
        price_type: details.price ? 'fixed' : 'contact',
        condition: 'used',
        year: details.year,
        make: details.make,
        city: DEALER_INFO.city,
        state: DEALER_INFO.state,
        country: 'USA',
        status: 'active',
        listing_type: 'sale',
      }).select('id').single();

      if (error) {
        console.log(` error: ${error.message}`);
        continue;
      }

      for (let j = 0; j < Math.min(details.images.length, 10); j++) {
        await supabase.from('listing_images').insert({
          listing_id: newListing.id,
          url: details.images[j],
          is_primary: j === 0,
          sort_order: j,
        });
      }

      totalImported++;
      console.log(` ✓ ${details.images.length} imgs`);

    } catch (e) {
      console.log(` error: ${e.message?.substring(0, 40)}`);
    }
  }

  await browser.close();

  console.log('\n==================================================');
  console.log('📊 Summary:');
  console.log(`   Dealer: ${DEALER_INFO.name}`);
  console.log(`   Imported: ${totalImported}`);
  console.log('==================================================\n');
}

main().catch(console.error);
