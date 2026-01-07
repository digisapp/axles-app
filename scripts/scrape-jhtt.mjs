// @ts-nocheck
/**
 * Jim Hawk Truck Trailers Scraper (Puppeteer)
 * Scrapes trailers from jhtt.com (Soarr platform - requires JS rendering)
 *
 * Usage: node scripts/scrape-jhtt.mjs
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Jim Hawk Truck Trailers',
  email: 'sales@jhtt.com',
  phone: '(712) 366-2241',
  website: 'https://www.jhtt.com',
  city: 'Council Bluffs',
  state: 'IA',
  country: 'USA',
};

const BASE_URL = 'https://www.jhtt.com';

// Category mapping
const CATEGORY_MAP = {
  'flatbed': 'flatbed-trailers',
  'lowboy': 'lowboy-trailers',
  'dump': 'dump-trailers',
  'drop deck': 'drop-deck-trailers',
  'stepdeck': 'drop-deck-trailers',
  'reefer': 'reefer-trailers',
  'dry van': 'dry-van-trailers',
  'grain': 'grain-trailers',
  'livestock': 'livestock-trailers',
  'tank': 'tank-trailers',
  'hopper': 'hopper-trailers',
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOrCreateDealer() {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', DEALER_INFO.name)
    .single();

  if (existing) return existing.id;

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: DEALER_INFO.email,
    email_confirm: true,
    password: Math.random().toString(36).slice(-12) + 'Aa1!',
  });

  if (authError && !authError.message.includes('already been registered')) {
    throw authError;
  }

  const userId = authUser?.user?.id;
  if (!userId) {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', DEALER_INFO.email)
      .single();
    return existingUser?.id;
  }

  await supabase
    .from('profiles')
    .update({
      company_name: DEALER_INFO.name,
      phone: DEALER_INFO.phone,
      website: DEALER_INFO.website,
      city: DEALER_INFO.city,
      state: DEALER_INFO.state,
      country: DEALER_INFO.country,
      is_dealer: true,
      is_verified: true,
    })
    .eq('id', userId);

  return userId;
}

async function getCategoryId(title) {
  const titleLower = title.toLowerCase();
  let slug = 'trailers';

  for (const [keyword, categorySlug] of Object.entries(CATEGORY_MAP)) {
    if (titleLower.includes(keyword)) {
      slug = categorySlug;
      break;
    }
  }

  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single();

  if (data) return data.id;

  const { data: fallback } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'trailers')
    .single();

  return fallback?.id;
}

async function importListing(dealerId, product) {
  // Check for duplicate
  const { data: existing } = await supabase
    .from('listings')
    .select('id')
    .eq('user_id', dealerId)
    .eq('title', product.title)
    .single();

  if (existing) {
    return { action: 'skipped', id: existing.id };
  }

  const categoryId = await getCategoryId(product.title);

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      user_id: dealerId,
      category_id: categoryId,
      title: product.title,
      description: product.description || product.title,
      price: product.price,
      price_type: product.price ? 'fixed' : 'contact',
      condition: product.condition || 'new',
      year: product.year,
      make: product.make || '',
      model: product.model || '',
      vin: product.vin,
      stock_number: product.stockNumber,
      city: product.city || DEALER_INFO.city,
      state: product.state || DEALER_INFO.state,
      country: DEALER_INFO.country,
      status: 'active',
      listing_type: 'sale',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error inserting: ${error.message}`);
    return { action: 'error', error };
  }

  // Import images
  const images = product.images || [];
  for (let i = 0; i < Math.min(images.length, 10); i++) {
    await supabase.from('listing_images').insert({
      listing_id: listing.id,
      url: images[i],
      thumbnail_url: images[i],
      is_primary: i === 0,
      sort_order: i,
    });
  }

  return { action: 'imported', id: listing.id };
}

async function scrapeWithPuppeteer() {
  console.log('   Launching browser...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const products = [];
  let pageNum = 1;
  let hasMore = true;

  while (hasMore && pageNum <= 20) {
    const url = pageNum === 1
      ? `${BASE_URL}/inventory`
      : `${BASE_URL}/inventory?page=${pageNum}`;

    console.log(`   Loading page ${pageNum}...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for inventory to load
      await page.waitForSelector('.listing, .inventory-item, [class*="listing"]', { timeout: 10000 })
        .catch(() => console.log('     Waiting for content...'));

      // Additional wait for dynamic content
      await sleep(2000);

      // Extract listings from the page
      const pageProducts = await page.evaluate((baseUrl) => {
        const items = [];

        // Try multiple selectors for listings
        const listings = document.querySelectorAll('.listing, .inventory-item, [class*="listing-card"], .item');

        listings.forEach(listing => {
          // Get title
          const titleEl = listing.querySelector('h2, h3, .title, [class*="title"], a[href*="/inventory/"]');
          const title = titleEl?.textContent?.trim() || '';

          if (!title) return;

          // Get URL
          const linkEl = listing.querySelector('a[href*="/inventory/"]');
          const detailUrl = linkEl?.getAttribute('href') || '';

          // Get image
          const imgEl = listing.querySelector('img');
          const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

          // Get price
          const priceEl = listing.querySelector('[class*="price"], .price');
          const priceText = priceEl?.textContent?.trim() || '';
          const price = priceText ? parseFloat(priceText.replace(/[$,]/g, '')) : null;

          // Get condition
          const conditionEl = listing.querySelector('[class*="condition"], .condition, .badge');
          const conditionText = conditionEl?.textContent?.toLowerCase() || '';
          const condition = conditionText.includes('used') ? 'used' : 'new';

          // Get stock number
          const stockEl = listing.querySelector('[class*="stock"], .stock');
          const stockNumber = stockEl?.textContent?.replace(/Stock[:#\s]*/i, '').trim() || null;

          // Parse year from title
          const yearMatch = title.match(/^(\d{4})\s/);
          const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

          // Parse make from title
          const parts = title.replace(/^\d{4}\s+/, '').split(/\s+/);
          const make = parts.length > 0 ? parts[0] : '';

          items.push({
            title,
            detailUrl: detailUrl.startsWith('http') ? detailUrl : `${baseUrl}${detailUrl}`,
            imageUrl: imageUrl.startsWith('http') ? imageUrl : (imageUrl ? `${baseUrl}${imageUrl}` : ''),
            price: price > 0 ? price : null,
            condition,
            stockNumber,
            year,
            make,
          });
        });

        return items;
      }, BASE_URL);

      if (pageProducts.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`     Found ${pageProducts.length} listings`);
      products.push(...pageProducts);

      // Check for next page
      const hasNextPage = await page.evaluate(() => {
        const nextBtn = document.querySelector('a[class*="next"], .pagination a:last-child, [class*="page"]:last-child a');
        return !!nextBtn && !nextBtn.classList.contains('disabled');
      });

      hasMore = hasNextPage && pageNum < 20;
      pageNum++;

      await sleep(1500);
    } catch (error) {
      console.error(`     Error on page ${pageNum}: ${error.message}`);
      hasMore = false;
    }
  }

  // Get detail pages for more info
  console.log('\n   Fetching details...');
  for (let i = 0; i < Math.min(products.length, 100); i++) {
    const product = products[i];
    if (!product.detailUrl) continue;

    try {
      await page.goto(product.detailUrl, { waitUntil: 'networkidle2', timeout: 20000 });
      await sleep(1000);

      const details = await page.evaluate(() => {
        const images = [];
        document.querySelectorAll('img[src*="photo"], img[src*="image"], .gallery img, .slider img').forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src && !images.includes(src)) {
            images.push(src);
          }
        });

        const description = document.querySelector('.description, [class*="description"], .details')?.textContent?.trim() || '';

        // Try to find VIN
        const pageText = document.body.textContent || '';
        const vinMatch = pageText.match(/VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i);
        const vin = vinMatch ? vinMatch[1] : null;

        // Try to find location
        const locationEl = document.querySelector('[class*="location"], .location');
        const location = locationEl?.textContent?.trim() || '';

        return { images, description, vin, location };
      });

      Object.assign(product, details);
      if (details.images.length > 0) {
        product.images = details.images;
      } else if (product.imageUrl) {
        product.images = [product.imageUrl];
      }

      process.stdout.write(`   Details: ${i + 1}/${Math.min(products.length, 100)}\r`);
    } catch (e) {
      // Continue without details
    }
  }

  await browser.close();
  return products;
}

async function main() {
  console.log('🚛 Jim Hawk Truck Trailers Scraper (Puppeteer)');
  console.log('==================================================\n');

  console.log('👤 Setting up dealer...');
  const dealerId = await getOrCreateDealer();
  console.log(`   ✓ Dealer ID: ${dealerId}\n`);

  const products = await scrapeWithPuppeteer();
  console.log(`\n   Found ${products.length} products total\n`);

  let totalImported = 0;
  let totalSkipped = 0;

  for (const product of products) {
    const result = await importListing(dealerId, product);
    if (result.action === 'imported') {
      totalImported++;
      process.stdout.write(`   Imported: ${totalImported}\r`);
    } else {
      totalSkipped++;
    }
  }

  console.log('\n\n==================================================');
  console.log(`📊 Summary:`);
  console.log(`   Imported: ${totalImported}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log('==================================================\n');
}

main().catch(console.error);
