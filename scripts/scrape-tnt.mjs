// @ts-nocheck
/**
 * Scrape TNT Trailer Sales
 * Sandhills Global platform - requires stealth mode
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
  name: 'TNT Trailer Sales',
  email: 'inventory@tntsales.biz',
  phone: '(636) 451-2100',
  city: 'Villa Ridge',
  state: 'MO',
  website: 'https://www.tntsales.biz'
};

const BASE_URL = 'https://www.tntsales.biz';

const CATEGORY_MAP = {
  'flatbed': 'flatbed-trailers',
  'drop deck': 'step-deck-trailers',
  'step deck': 'step-deck-trailers',
  'lowboy': 'lowboy-trailers',
  'double drop': 'lowboy-trailers',
  'rgn': 'lowboy-trailers',
  'stretch': 'extendable-trailers',
  'extendable': 'extendable-trailers',
  'dry van': 'dry-van-trailers',
  'reefer': 'reefer-trailers',
  'dump': 'end-dump-trailers',
  'curtain': 'curtain-side-trailers',
  'conestoga': 'curtain-side-trailers',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getOrCreateDealer() {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', DEALER_INFO.name)
    .single();

  if (existing) {
    console.log('Dealer exists:', DEALER_INFO.name);
    return existing.id;
  }

  const password = 'TNT2024!';
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

  console.log('Created dealer:', DEALER_INFO.name);
  console.log('  Email:', DEALER_INFO.email);
  console.log('  Password:', password);
  return authUser.user.id;
}

async function getCategoryId(title) {
  const titleLower = title.toLowerCase();
  let categorySlug = 'flatbed-trailers';

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

async function getAllListingUrls(page) {
  const allUrls = [];
  
  console.log('\nCollecting listings from inventory page...');
  await page.goto(BASE_URL + '/inventory/trailers-for-sale/', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(5000);
  
  // Scroll to load more listings
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await sleep(500);
  }
  
  const urls = await page.evaluate(() => {
    const links = [];
    document.querySelectorAll('a[href*="/listing/"]').forEach(a => {
      const href = a.href;
      if (href && href.includes('/listing/for-retail/') && !links.includes(href)) {
        links.push(href);
      }
    });
    return links;
  });
  
  console.log('  Found', urls.length, 'listings');
  return urls;
}

async function scrapeListing(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);
  
  const data = await page.evaluate(() => {
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    
    let price = null;
    const priceMatch = document.body.textContent.match(/\$[\d,]+/);
    if (priceMatch) {
      price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));
    }
    
    const images = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && 
          (src.includes('sandhills') || src.includes('cloudinary')) &&
          !src.includes('logo') && !src.includes('icon') &&
          !src.includes('.gif') && !src.includes('flag')) {
        images.push(src);
      }
    });
    
    const yearMatch = title.match(/^(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;
    
    const makes = ['FONTAINE', 'DORSEY', 'BENSON', 'DOONAN', 'EXTREME', 'WABASH', 'REITNOUER', 'MANAC', 'GREAT DANE'];
    let make = '';
    const titleUpper = title.toUpperCase();
    for (const m of makes) {
      if (titleUpper.includes(m)) {
        make = m;
        break;
      }
    }
    
    return {
      title,
      price,
      images: [...new Set(images)],
      year,
      make
    };
  });
  
  return data;
}

async function main() {
  console.log('Scraping TNT Trailer Sales');
  console.log('   Direct from: tntsales.biz');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const listingUrls = await getAllListingUrls(page);
  console.log('\nTotal listings to process:', listingUrls.length, '\n');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < listingUrls.length; i++) {
    const url = listingUrls[i];
    process.stdout.write('[' + (i + 1) + '/' + listingUrls.length + '] ');

    try {
      // Longer delays to avoid bot detection
      await sleep(3000 + Math.random() * 2000);

      // Every 5 listings, go back to inventory to reset session
      if (i > 0 && i % 5 === 0) {
        console.log('(resetting session...)');
        await page.goto(BASE_URL + '/inventory/trailers-for-sale/', { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(3000);
        process.stdout.write('[' + (i + 1) + '/' + listingUrls.length + '] ');
      }

      const listing = await scrapeListing(page, url);

      // If blocked, wait longer and retry once
      if (listing.title === 'Pardon Our Interruption' || !listing.title) {
        console.log('(blocked, waiting 10s and retrying...)');
        await sleep(10000);
        await page.goto(BASE_URL + '/inventory/trailers-for-sale/', { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(5000);
        const retryListing = await scrapeListing(page, url);
        if (retryListing.title && retryListing.title !== 'Pardon Our Interruption') {
          Object.assign(listing, retryListing);
        }
      }

      process.stdout.write((listing.title?.substring(0, 35) || 'Unknown') + '... ');

      if (!listing.title || listing.title.length < 5) {
        console.log('no title');
        skipped++;
        continue;
      }

      if (listing.images.length === 0) {
        console.log('no images');
        skipped++;
        continue;
      }

      const { data: exists } = await supabase
        .from('listings')
        .select('id')
        .eq('title', listing.title)
        .eq('user_id', dealerId)
        .single();

      if (exists) {
        console.log('duplicate');
        skipped++;
        continue;
      }

      const categoryId = await getCategoryId(listing.title);

      const { data: newListing, error } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: listing.title,
        description: listing.title,
        price: listing.price,
        price_type: listing.price ? 'fixed' : 'contact',
        condition: listing.year >= 2024 ? 'new' : 'used',
        year: listing.year,
        make: listing.make,
        city: DEALER_INFO.city,
        state: DEALER_INFO.state,
        country: 'USA',
        status: 'active',
        listing_type: 'sale',
      }).select('id').single();

      if (error) {
        console.log('error: ' + error.message);
        errors++;
        continue;
      }

      for (let j = 0; j < Math.min(listing.images.length, 10); j++) {
        await supabase.from('listing_images').insert({
          listing_id: newListing.id,
          url: listing.images[j],
          is_primary: j === 0,
          sort_order: j,
        });
      }

      imported++;
      console.log('OK ' + listing.images.length + ' imgs');
    } catch (e) {
      console.log('error: ' + (e.message?.substring(0, 40) || 'unknown'));
      errors++;
    }
  }

  await browser.close();

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
