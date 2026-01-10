// @ts-nocheck
/**
 * Scrape Preferred Lowboys
 * Texas trailer dealer - Houston, Dallas, Austin
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
  name: 'Preferred Lowboys',
  email: 'sales@preferredlowboys.com',
  phone: '888-281-3383',
  address: '5733 Ransom St',
  city: 'Houston',
  state: 'TX',
  zip: '77087',
  website: 'https://www.preferredlowboys.com',
  about: 'Preferred Lowboys specializes in trailer sales, service, and parts with locations in Houston, Dallas/Fort Worth, and Austin, Texas. We represent major manufacturers including Trail King, Liddell, Talbert, and Eager Beaver. Our staff includes veterans of the oilfield and heavy hauling industry, providing superior service and selection.',
  locations: [
    { name: 'Houston', address: '5733 Ransom St', city: 'Houston', state: 'TX', zip: '77087', phone: '888-281-3383' },
    { name: 'Dallas/Fort Worth', address: '3251 V.V. Jones Rd.', city: 'Venus', state: 'TX', zip: '76084', phone: '972-848-2060' },
    { name: 'Austin', address: '23999 IH 35', city: 'Kyle', state: 'TX', zip: '78640', phone: '' },
  ]
};

const BASE_URL = 'https://www.preferredlowboys.com';

const CATEGORY_MAP = {
  'lowboy': 'lowboy-trailers',
  'double drop': 'lowboy-trailers',
  'rgn': 'lowboy-trailers',
  'drop deck': 'step-deck-trailers',
  'step deck': 'step-deck-trailers',
  'flatbed': 'flatbed-trailers',
  'end dump': 'end-dump-trailers',
  'dump': 'end-dump-trailers',
  'tank': 'tank-trailers',
  'pneumatic': 'tank-trailers',
  'dry bulk': 'tank-trailers',
  'belt': 'belt-trailers',
  'hopper': 'hopper-trailers',
  'grain': 'hopper-trailers',
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
    // Update profile with latest info
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

  const password = 'Preferred2024!';
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

async function getCategoryId(title) {
  const titleLower = title.toLowerCase();
  let categorySlug = 'lowboy-trailers'; // default for this dealer

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

  if (!cat) {
    // Fallback to trailers parent
    const { data: trailers } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'trailers')
      .single();
    return trailers?.id;
  }

  return cat.id;
}

async function getAllListingUrls(page) {
  const allUrls = new Set();

  // Main inventory page
  console.log('\nCollecting from /all-equipment...');

  try {
    await page.goto(BASE_URL + '/all-equipment', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    // Scroll to load all content
    for (let i = 0; i < 25; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await sleep(300);
    }
    await sleep(2000);

    // Look for /for-sale/ links which are the product detail pages
    const urls = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="/for-sale/"]').forEach(a => {
        const href = a.href;
        if (href && href.includes('/for-sale/') && !links.includes(href)) {
          links.push(href);
        }
      });
      return links;
    });

    urls.forEach(url => allUrls.add(url));
    console.log(`  Found ${urls.length} listings`);

  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }

  // Also try paginated results
  for (let pageNum = 2; pageNum <= 5; pageNum++) {
    try {
      console.log(`Checking page ${pageNum}...`);
      await page.goto(BASE_URL + `/all-equipment?p=${pageNum}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await sleep(200);
      }

      const moreUrls = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href*="/for-sale/"]').forEach(a => {
          const href = a.href;
          if (href && href.includes('/for-sale/') && !links.includes(href)) {
            links.push(href);
          }
        });
        return links;
      });

      if (moreUrls.length === 0) break;
      moreUrls.forEach(url => allUrls.add(url));
      console.log(`  Found ${moreUrls.length} more listings`);
    } catch (err) {
      break;
    }
  }

  return [...allUrls];
}

async function scrapeListing(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);

  // Scroll to load lazy images
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(200);
  }
  await sleep(1000);

  const data = await page.evaluate(() => {
    // Get title - look for h1 that contains a year (trailer titles start with year)
    let title = '';
    const h1Elements = document.querySelectorAll('h1');
    for (const h1 of h1Elements) {
      const text = h1.textContent?.trim() || '';
      // Valid title should start with a year like 2024, 2025, 2026
      if (text.match(/^20\d{2}\s/)) {
        title = text;
        break;
      }
    }
    // Fallback to first h1 if no year-prefixed title found
    if (!title) {
      title = document.querySelector('h1')?.textContent?.trim() || '';
    }

    // Get price
    let price = null;
    const priceEl = document.querySelector('[class*="price"]');
    if (priceEl) {
      const match = priceEl.textContent?.match(/\$([\d,]+)/);
      if (match) {
        price = parseFloat(match[1].replace(/,/g, ''));
      }
    }

    // Get images - look for cloudfront CDN images
    const images = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy');
      if (src &&
          (src.includes('cloudfront') || src.includes('d2uhsaoc6ysewq')) &&
          !src.includes('logo') &&
          !src.includes('icon') &&
          (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp'))) {
        if (!images.includes(src)) {
          images.push(src);
        }
      }
    });

    // Also check for other image sources
    if (images.length === 0) {
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src');
        if (src &&
            !src.includes('logo') &&
            !src.includes('icon') &&
            !src.includes('placeholder') &&
            !src.includes('.gif') &&
            !src.includes('flag') &&
            !src.includes('social') &&
            !src.includes('avatar') &&
            (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp'))) {
          if (!images.includes(src)) {
            images.push(src);
          }
        }
      });
    }

    // Get description
    const descEl = document.querySelector('.product-description') ||
                   document.querySelector('[class*="description"]') ||
                   document.querySelector('.details');
    const description = descEl?.textContent?.trim().substring(0, 2000) || '';

    // Parse year from title
    const yearMatch = title.match(/^(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    // Parse make from title
    const makes = ['TRAIL KING', 'TRAILKING', 'TALBERT', 'LIDDELL', 'EAGER BEAVER', 'FONTAINE',
                   'LANDOLL', 'XL SPECIALIZED', 'LOAD KING', 'KALYN SIEBERT', 'MANAC', 'RAVENS',
                   'MAC', 'EBY', 'RETESA'];
    let make = '';
    const titleUpper = title.toUpperCase();
    for (const m of makes) {
      if (titleUpper.includes(m)) {
        make = m;
        break;
      }
    }

    // Determine condition
    const isNew = title.toLowerCase().includes('new') ||
                  (year && year >= 2024) ||
                  window.location.href.includes('/new-');

    return {
      title,
      price,
      images: [...new Set(images)],
      description,
      year,
      make,
      condition: isNew ? 'new' : 'used'
    };
  });

  return data;
}

async function main() {
  console.log('Scraping Preferred Lowboys');
  console.log('   Website: preferredlowboys.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const listingUrls = await getAllListingUrls(page);
  console.log('\nTotal unique listings to process:', listingUrls.length, '\n');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < listingUrls.length; i++) {
    const url = listingUrls[i];
    process.stdout.write('[' + (i + 1) + '/' + listingUrls.length + '] ');

    try {
      await sleep(2000 + Math.random() * 1500);

      const listing = await scrapeListing(page, url);

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
        description: listing.description || listing.title,
        price: listing.price,
        price_type: listing.price ? 'fixed' : 'contact',
        condition: listing.condition,
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

      // Insert images (max 10)
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
  console.log('   Location: ' + DEALER_INFO.city + ', ' + DEALER_INFO.state);
  console.log('   Imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
