// @ts-nocheck
/**
 * Scrape Royal Truck & Utility Trailer Sales
 * WordPress/WooCommerce site - straightforward scraping
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Royal Truck & Utility Trailer',
  email: 'inventory@royaltrailersales.com',
  phone: '(313) 524-2529',
  city: 'Northville',
  state: 'MI',
  website: 'https://royaltrailersales.com'
};

const BASE_URL = 'https://royaltrailersales.com';

// Website product categories mapped to our category slugs
const SITE_CATEGORIES = [
  { cat: 'dump-trailer', slug: 'end-dump-trailers' },
  { cat: 'flatbed-trailer', slug: 'flatbed-trailers' },
  { cat: 'dry-van-trailer', slug: 'dry-van-trailers' },
  { cat: 'reefer-trailer', slug: 'reefer-trailers' },
  { cat: 'hopper-trailer', slug: 'hopper-trailers' },
  { cat: 'lowboy-trailer', slug: 'lowboy-trailers' },
  { cat: 'step-deck-trailer', slug: 'step-deck-trailers' },
  { cat: 'tank-trailer', slug: 'tank-trailers' },
  { cat: 'livestock-trailer', slug: 'livestock-trailers' },
  { cat: 'curtain-side-trailer', slug: 'curtain-side-trailers' },
];

const CATEGORY_MAP = {
  'flatbed': 'flatbed-trailers',
  'dry van': 'dry-van-trailers',
  'reefer': 'reefer-trailers',
  'refrigerated': 'reefer-trailers',
  'dump': 'end-dump-trailers',
  'lowboy': 'lowboy-trailers',
  'drop deck': 'step-deck-trailers',
  'step deck': 'step-deck-trailers',
  'hopper': 'hopper-trailers',
  'grain': 'hopper-trailers',
  'tank': 'tank-trailers',
  'tanker': 'tank-trailers',
  'curtain': 'curtain-side-trailers',
  'curtainside': 'curtain-side-trailers',
  'livestock': 'livestock-trailers',
  'car hauler': 'car-hauler-trailers',
  'auto transport': 'car-hauler-trailers',
  'log': 'logging-trailers',
  'logging': 'logging-trailers',
  'container': 'container-trailers',
  'chassis': 'container-trailers',
  'dolly': 'converter-dollies',
  'converter': 'converter-dollies',
  'bottom dump': 'bottom-dump-trailers',
  'belly dump': 'bottom-dump-trailers',
  'side dump': 'side-dump-trailers',
  'pneumatic': 'pneumatic-trailers',
  'walking floor': 'walking-floor-trailers',
  'moving floor': 'walking-floor-trailers',
  'tag': 'tag-trailers',
  'equipment': 'equipment-trailers',
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

  const password = 'Royal2024!';
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

async function getAllProductUrls(page) {
  const allProducts = []; // { url, categorySlug }
  const seenUrls = new Set();

  for (const siteCat of SITE_CATEGORIES) {
    console.log('\n  Category: ' + siteCat.cat);
    let pageNum = 1;
    const maxPages = 20;

    while (pageNum <= maxPages) {
      const url = BASE_URL + '/inventory/page/' + pageNum + '/?product_cat=' + siteCat.cat;

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(1500);

        const urls = await page.evaluate(() => {
          const links = [];
          document.querySelectorAll('a[href*="/product/"]').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !links.includes(href)) {
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
            allProducts.push({ url: u, categorySlug: siteCat.slug });
            newCount++;
          }
        }

        if (newCount === 0) {
          break; // No new products, stop pagination
        }

        console.log('    Page ' + pageNum + ': ' + newCount + ' new (' + allProducts.length + ' total)');
        pageNum++;
        await sleep(500);
      } catch (e) {
        console.log('    Page ' + pageNum + ' error: ' + e.message.substring(0, 30));
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
    const title = document.querySelector('h1')?.textContent?.trim() ||
                  document.querySelector('.product_title')?.textContent?.trim() || '';

    let price = null;
    const priceEl = document.querySelector('.price, .woocommerce-Price-amount');
    if (priceEl) {
      const priceMatch = priceEl.textContent.match(/[\d,]+/);
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(/,/g, ''));
      }
    }

    const images = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-large_image');
      if (src &&
          src.includes('wp-content/uploads') &&
          !src.includes('logo') &&
          !src.includes('icon') &&
          !src.includes('placeholder') &&
          !images.includes(src)) {
        images.push(src);
      }
    });

    document.querySelectorAll('[data-large_image]').forEach(el => {
      const src = el.getAttribute('data-large_image');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });

    const yearMatch = title.match(/^(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    const makes = ['MAC', 'UTILITY', 'TITAN', 'GREAT DANE', 'WABASH', 'VANGUARD', 'HYUNDAI', 'STOUGHTON'];
    let make = '';
    for (const m of makes) {
      if (title.toUpperCase().includes(m)) {
        make = m;
        break;
      }
    }

    const descEl = document.querySelector('.woocommerce-product-details__short-description, .product-description, .entry-content');
    const description = descEl?.textContent?.trim()?.substring(0, 2000) || title;

    let location = '';
    const bodyText = document.body.textContent || '';
    const locMatch = bodyText.match(/Location[:\s]+([^,\n]+,?\s*[A-Z]{2})/i);
    if (locMatch) {
      location = locMatch[1].trim();
    }

    return {
      title,
      price,
      images: [...new Set(images)],
      year,
      make,
      description,
      location
    };
  });

  return data;
}

async function main() {
  console.log('Scraping Royal Truck & Utility Trailer');
  console.log('   Direct from: royaltrailersales.com');
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

  console.log('Collecting product URLs...\n');
  const products = await getAllProductUrls(page);
  console.log('\nFound ' + products.length + ' unique products\n');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i++) {
    const { url, categorySlug } = products[i];
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

      // Use category from site navigation, fallback to title detection
      let categoryId;
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .single();
      categoryId = cat?.id || await getCategoryId(product.title);

      let city = DEALER_INFO.city;
      let state = DEALER_INFO.state;
      if (product.location) {
        const locMatch = product.location.match(/([^,]+),?\s*([A-Z]{2})/i);
        if (locMatch) {
          city = locMatch[1].trim();
          state = locMatch[2].toUpperCase();
        }
      }

      const { data: newListing, error } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: product.title,
        description: product.description,
        price: product.price,
        price_type: product.price ? 'fixed' : 'contact',
        condition: product.year >= 2024 ? 'new' : 'used',
        year: product.year,
        make: product.make,
        city: city,
        state: state,
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
