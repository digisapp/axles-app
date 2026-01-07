// @ts-nocheck
/**
 * Scrape Midco Sales - Trucks & Trailers
 * WordPress site - straightforward scraping
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Midco Sales',
  email: 'inventory@midcosales.com',
  phone: '(480) 999-0607',
  city: 'Chandler',
  state: 'AZ',
  website: 'https://midcosales.com'
};

const BASE_URL = 'https://midcosales.com';

// Category pages to scrape
const SITE_CATEGORIES = [
  { path: '/vehicle-category/trailer/', defaultSlug: 'flatbed-trailers' },
  { path: '/vehicle-category/tow-truck/', defaultSlug: 'wrecker-trucks' },
];

// Map keywords to our category slugs
const CATEGORY_MAP = {
  'lowboy': 'lowboy-trailers',
  'double drop': 'lowboy-trailers',
  'rgn': 'lowboy-trailers',
  'flatbed': 'flatbed-trailers',
  'step deck': 'step-deck-trailers',
  'drop deck': 'step-deck-trailers',
  'end dump': 'end-dump-trailers',
  'belly dump': 'bottom-dump-trailers',
  'bottom dump': 'bottom-dump-trailers',
  'live floor': 'walking-floor-trailers',
  'walking floor': 'walking-floor-trailers',
  'tag trailer': 'tag-trailers',
  'tilt deck': 'tilt-trailers',
  'traveling axle': 'lowboy-trailers',
  'traveling tail': 'lowboy-trailers',
  'gooseneck': 'equipment-trailers',
  'utility': 'utility-trailers',
  'rollback': 'rollback-trucks',
  'wrecker': 'wrecker-trucks',
  'rotator': 'wrecker-trucks',
  'carrier': 'rollback-trucks',
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

  const password = 'Midco2024!';
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

async function getCategoryId(title, defaultSlug) {
  const titleLower = title.toLowerCase();
  let categorySlug = defaultSlug;

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

async function getAllProductUrls(page) {
  const allProducts = [];
  const seenUrls = new Set();

  for (const siteCat of SITE_CATEGORIES) {
    console.log('\nCategory:', siteCat.path);
    let pageNum = 1;
    const maxPages = 10;

    while (pageNum <= maxPages) {
      const url = pageNum === 1
        ? BASE_URL + siteCat.path
        : BASE_URL + siteCat.path + 'page/' + pageNum + '/';

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(1500);

        const urls = await page.evaluate(() => {
          const links = [];
          document.querySelectorAll('a[href*="/vehicles/"]').forEach(a => {
            const href = a.getAttribute('href');
            if (href && href.includes('/vehicles/') && !links.includes(href)) {
              links.push(href);
            }
          });
          return links;
        });

        if (urls.length === 0) {
          break;
        }

        let newCount = 0;
        for (const u of urls) {
          if (!seenUrls.has(u)) {
            seenUrls.add(u);
            allProducts.push({ url: u, defaultSlug: siteCat.defaultSlug });
            newCount++;
          }
        }

        if (newCount === 0) {
          break;
        }

        console.log('  Page ' + pageNum + ': ' + newCount + ' new (' + allProducts.length + ' total)');
        pageNum++;
        await sleep(500);
      } catch (e) {
        console.log('  Page ' + pageNum + ' error: ' + e.message.substring(0, 30));
        break;
      }
    }
  }

  return allProducts;
}

async function scrapeProduct(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1000);

  const data = await page.evaluate(() => {
    const title = document.querySelector('h1')?.textContent?.trim() || '';

    let price = null;
    const priceEl = document.querySelector('.car-price, .price, [class*="price"]');
    if (priceEl) {
      const priceMatch = priceEl.textContent.match(/[\d,]+/);
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(/,/g, ''));
      }
    }

    const images = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src &&
          src.includes('wp-content/uploads') &&
          !src.includes('logo') &&
          !src.includes('icon') &&
          !src.includes('placeholder') &&
          !src.includes('-150x') &&
          !src.includes('-300x') &&
          !images.includes(src)) {
        images.push(src);
      }
    });

    // Also check gallery thumbnails for full-size versions
    document.querySelectorAll('[data-src], [data-large]').forEach(el => {
      const src = el.getAttribute('data-src') || el.getAttribute('data-large');
      if (src && src.includes('wp-content/uploads') && !images.includes(src)) {
        images.push(src);
      }
    });

    const yearMatch = title.match(/(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    const makes = ['PETERBILT', 'INTERNATIONAL', 'MACK', 'KENWORTH', 'FREIGHTLINER', 'XL SPECIALIZED', 
                   'FONTAINE', 'LANDOLL', 'ALPHA', 'PRESTIGE', 'INTERSTATE', 'ARMOR LITE', 'JERR-DAN'];
    let make = '';
    const titleUpper = title.toUpperCase();
    for (const m of makes) {
      if (titleUpper.includes(m)) {
        make = m;
        break;
      }
    }

    // Get condition
    let condition = 'used';
    if (document.body.textContent.toLowerCase().includes('new') && 
        !document.body.textContent.toLowerCase().includes('used')) {
      condition = 'new';
    }
    const conditionEl = document.querySelector('[class*="condition"], .badge');
    if (conditionEl) {
      const condText = conditionEl.textContent.toLowerCase();
      if (condText.includes('new')) condition = 'new';
      if (condText.includes('used')) condition = 'used';
    }

    const descEl = document.querySelector('.car-description, .vehicle-description, .entry-content, article');
    const description = descEl?.textContent?.trim()?.substring(0, 2000) || title;

    return {
      title,
      price,
      images: [...new Set(images)],
      year,
      make,
      condition,
      description
    };
  });

  return data;
}

async function main() {
  console.log('Scraping Midco Sales');
  console.log('   Direct from: midcosales.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Collecting product URLs...');
  const products = await getAllProductUrls(page);
  console.log('\nFound ' + products.length + ' unique products\n');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i++) {
    const { url, defaultSlug } = products[i];
    process.stdout.write('[' + (i + 1) + '/' + products.length + '] ');

    try {
      const product = await scrapeProduct(page, url);
      process.stdout.write((product.title?.substring(0, 40) || 'Unknown') + '... ');

      if (!product.title || product.title.length < 5) {
        console.log('no title');
        skipped++;
        continue;
      }

      if (product.images.length === 0) {
        console.log('no images');
        skipped++;
        continue;
      }

      const { data: exists } = await supabase
        .from('listings')
        .select('id')
        .eq('title', product.title)
        .eq('user_id', dealerId)
        .single();

      if (exists) {
        console.log('duplicate');
        skipped++;
        continue;
      }

      const categoryId = await getCategoryId(product.title, defaultSlug);

      const { data: newListing, error } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: product.title,
        description: product.description,
        price: product.price,
        price_type: product.price ? 'fixed' : 'contact',
        condition: product.condition,
        year: product.year,
        make: product.make,
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

      for (let j = 0; j < Math.min(product.images.length, 10); j++) {
        await supabase.from('listing_images').insert({
          listing_id: newListing.id,
          url: product.images[j],
          is_primary: j === 0,
          sort_order: j,
        });
      }

      imported++;
      console.log('OK ' + product.images.length + ' imgs');

      await sleep(300);
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
