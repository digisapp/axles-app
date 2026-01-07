// @ts-nocheck
/**
 * Royal Truck & Utility Trailer Scraper
 * Scrapes trailers from royaltrailersales.com (WooCommerce)
 *
 * Usage: node scripts/scrape-royal.mjs
 */

import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Royal Truck & Utility Trailer',
  email: 'sales@royaltrailersales.com',
  phone: '(313) 584-4600',
  website: 'https://royaltrailersales.com',
  city: 'Dearborn',
  state: 'MI',
  country: 'USA',
};

const BASE_URL = 'https://royaltrailersales.com';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// Category mapping
const CATEGORY_MAP = {
  'flatbed': 'flatbed-trailers',
  'dump': 'dump-trailers',
  'reefer': 'reefer-trailers',
  'dry van': 'dry-van-trailers',
  'lowboy': 'lowboy-trailers',
  'hopper': 'hopper-trailers',
  'tank': 'tank-trailers',
  'livestock': 'livestock-trailers',
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
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

  // Fallback
  const { data: fallback } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'trailers')
    .single();

  return fallback?.id;
}

function parseProductFromPage($) {
  const products = [];

  // Find all product links in the listing
  $('h2 a[href*="/product/"]').each((i, el) => {
    const $el = $(el);
    const title = $el.text().trim();
    const detailUrl = $el.attr('href');

    if (!title || !detailUrl) return;

    // Parse year from title (e.g., "2025 MAC Flatbed...")
    const yearMatch = title.match(/^(\d{4})\s/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

    // Parse make from title (second word usually)
    const parts = title.split(/\s+/);
    const make = parts.length > 1 ? parts[1] : '';

    // Get location from nearby element
    const $parent = $el.closest('.product-main, .product-item, div');
    const location = $parent.find('.product-location, .product-main__info__details__location').text().trim();

    // Parse city/state from location
    let city = DEALER_INFO.city;
    let state = DEALER_INFO.state;
    const locationMatch = location.match(/([^,]+),\s*(\w{2})/);
    if (locationMatch) {
      city = locationMatch[1].trim();
      state = locationMatch[2].trim();
    }

    products.push({
      title,
      detailUrl: detailUrl.startsWith('http') ? detailUrl : `${BASE_URL}${detailUrl}`,
      year,
      make,
      city,
      state,
    });
  });

  return products;
}

async function scrapeProductDetail(url) {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const images = [];
    // WooCommerce product gallery images
    $('img[src*="uploads"], .woocommerce-product-gallery img, .product-gallery img').each((i, el) => {
      let src = $(el).attr('data-large_image') || $(el).attr('data-src') || $(el).attr('src');
      if (src && !images.includes(src) && src.includes('uploads')) {
        // Get full size image
        src = src.replace(/-\d+x\d+\./, '.');
        images.push(src);
      }
    });

    // Get description
    const description = $('.woocommerce-product-details__short-description, .product-description, .entry-content').first().text().trim();

    // Try to extract price
    const priceText = $('.price, .woocommerce-Price-amount').first().text().trim();
    const price = priceText ? parseFloat(priceText.replace(/[$,]/g, '')) : null;

    // Try to find stock number in title or content
    const pageText = $('body').text();
    const stockMatch = pageText.match(/Stock[:\s#]*(\d+)/i) ||
                       url.match(/(\d{6})(?:\/)?$/);
    const stockNumber = stockMatch ? stockMatch[1] : null;

    // Try to find VIN
    const vinMatch = pageText.match(/VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i);
    const vin = vinMatch ? vinMatch[1] : null;

    // Condition - check for "used" or "pre-owned"
    const condition = pageText.toLowerCase().includes('used') || pageText.toLowerCase().includes('pre-owned')
      ? 'used' : 'new';

    return { images, description, price, stockNumber, vin, condition };
  } catch (error) {
    console.error(`Error fetching detail: ${error.message}`);
    return { images: [], description: '', price: null, stockNumber: null, vin: null, condition: 'new' };
  }
}

async function importListing(dealerId, product) {
  // Skip listings without images - we only want listings where we captured images
  const images = product.images || [];
  if (images.length === 0) {
    console.log(`  ⏭ Skipping (no images): ${product.title}`);
    return { action: 'skipped_no_images' };
  }

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
      model: '',
      vin: product.vin,
      stock_number: product.stockNumber,
      city: product.city,
      state: product.state,
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

async function scrapeInventory() {
  console.log('\n   Scraping inventory...');

  const products = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 30) {
    const url = page === 1
      ? `${BASE_URL}/inventory/`
      : `${BASE_URL}/inventory/page/${page}/`;

    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      const pageProducts = parseProductFromPage($);

      if (pageProducts.length === 0) {
        hasMore = false;
        break;
      }

      products.push(...pageProducts);
      console.log(`     Page ${page}: Found ${pageProducts.length} products`);

      // Check for next page link
      const nextLink = $('a.next, a[rel="next"], .pagination a:contains("Next")').attr('href');
      hasMore = !!nextLink && page < 30;
      page++;

      await sleep(1500);
    } catch (error) {
      console.error(`     Error on page ${page}: ${error.message}`);
      hasMore = false;
    }
  }

  return products;
}

async function main() {
  console.log('🚛 Royal Truck & Utility Trailer Scraper');
  console.log('==================================================\n');

  console.log('👤 Setting up dealer...');
  const dealerId = await getOrCreateDealer();
  console.log(`   ✓ Dealer ID: ${dealerId}`);

  const products = await scrapeInventory();
  console.log(`   Found ${products.length} products total\n`);

  let totalImported = 0;
  let totalSkipped = 0;

  for (const product of products) {
    // Get detailed info
    if (product.detailUrl) {
      try {
        const details = await scrapeProductDetail(product.detailUrl);
        Object.assign(product, details);
        await sleep(800);
      } catch (e) {
        // Continue without details
      }
    }

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
