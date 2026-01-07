// @ts-nocheck
/**
 * Blackburn Truck Equipment Scraper
 * Scrapes tow trucks from blackburntruckequipment.com (BigCommerce)
 *
 * Usage: node scripts/scrape-blackburn.mjs
 */

import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DEALER_INFO = {
  name: 'Blackburn Truck Equipment',
  email: 'sales@blackburntruckequipment.com',
  phone: '(704) 225-7400',
  website: 'https://blackburntruckequipment.com',
  city: 'Charlotte',
  state: 'NC',
  country: 'USA',
};

const CATEGORIES = [
  { url: 'https://blackburntruckequipment.com/trucks/new-trucks/', condition: 'new' },
  { url: 'https://blackburntruckequipment.com/tow-trucks/used-tow-trucks/', condition: 'used' },
];

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
  // Check if dealer exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', DEALER_INFO.name)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new dealer profile
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
    // User exists, find their ID
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', DEALER_INFO.email)
      .single();
    return existingUser?.id;
  }

  // Update profile
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

async function getCategoryId(name) {
  // Map truck types to categories
  const categoryMap = {
    'tow truck': 'tow-trucks',
    'wrecker': 'wreckers',
    'flatbed': 'flatbed-trucks',
    'carrier': 'car-carriers',
    'rollback': 'rollback-trucks',
  };

  const slug = categoryMap[name.toLowerCase()] || 'tow-trucks';

  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single();

  if (data) return data.id;

  // Fallback to trucks category
  const { data: fallback } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'trucks')
    .single();

  return fallback?.id;
}

function parseProductCard($, card) {
  const $card = $(card);

  const title = $card.find('.card-title a').text().trim();
  const detailUrl = $card.find('.card-title a').attr('href');
  const brand = $card.find('[data-test-info-type="brandName"]').text().trim();
  const priceText = $card.find('[data-product-price-without-tax]').text().trim();
  const price = priceText ? parseFloat(priceText.replace(/[$,]/g, '')) : null;

  // Get primary image
  const imgSrc = $card.find('.card-image').attr('src') ||
                 $card.find('.card-image').attr('data-src') ||
                 $card.find('.card-img-container img').attr('src');

  // Parse year from title (e.g., "2023 Chevy 6500...")
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Parse make/model from title
  let make = brand || '';
  let model = title;

  if (yearMatch) {
    model = title.replace(/^\d{4}\s+/, '');
  }

  // Try to split make from model
  const parts = model.split(/\s+/);
  if (parts.length > 1 && !make) {
    make = parts[0];
    model = parts.slice(1).join(' ');
  }

  return {
    title,
    detailUrl,
    make,
    model,
    year,
    price: price > 0 ? price : null,
    imageUrl: imgSrc,
  };
}

async function scrapeProductDetail(url) {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const images = [];
    $('.productView-thumbnail img, .productView-image img').each((i, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src');
      if (src && !images.includes(src)) {
        images.push(src.replace('/80w/', '/1280w/').replace('/160w/', '/1280w/'));
      }
    });

    const description = $('.productView-description').text().trim();
    const sku = $('[data-product-sku]').text().trim();

    // Try to find VIN in description
    const vinMatch = description.match(/VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i);
    const vin = vinMatch ? vinMatch[1] : null;

    return { images, description, sku, vin };
  } catch (error) {
    console.error(`Error fetching detail: ${error.message}`);
    return { images: [], description: '', sku: null, vin: null };
  }
}

async function importListing(dealerId, product, condition) {
  // Check for duplicate by title
  const { data: existing } = await supabase
    .from('listings')
    .select('id')
    .eq('user_id', dealerId)
    .eq('title', product.title)
    .single();

  if (existing) {
    return { action: 'skipped', id: existing.id };
  }

  const categoryId = await getCategoryId('tow truck');

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      user_id: dealerId,
      category_id: categoryId,
      title: product.title,
      description: product.description || `${product.year || ''} ${product.make} ${product.model}`.trim(),
      price: product.price,
      price_type: 'contact',
      condition,
      year: product.year,
      make: product.make,
      model: product.model,
      vin: product.vin,
      stock_number: product.sku,
      city: DEALER_INFO.city,
      state: DEALER_INFO.state,
      country: DEALER_INFO.country,
      status: 'active',
      listing_type: 'sale',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error inserting listing: ${error.message}`);
    return { action: 'error', error };
  }

  // Import images
  const images = product.images?.length ? product.images : (product.imageUrl ? [product.imageUrl] : []);
  for (let i = 0; i < images.length; i++) {
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

async function scrapeCategory(url, condition) {
  console.log(`\n   Scraping ${condition} trucks from ${url}...`);

  const products = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const pageUrl = page === 1 ? url : `${url}?page=${page}`;

    try {
      const html = await fetchPage(pageUrl);
      const $ = cheerio.load(html);

      const cards = $('.product article.card');

      if (cards.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`     Page ${page}: Found ${cards.length} products`);

      cards.each((i, card) => {
        const product = parseProductCard($, card);
        if (product.title) {
          products.push({ ...product, condition });
        }
      });

      // Check for next page
      const nextLink = $('.pagination-item--next a').attr('href');
      hasMore = !!nextLink;
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
  console.log('🚚 Blackburn Truck Equipment Scraper');
  console.log('==================================================\n');

  // Setup dealer
  console.log('👤 Setting up dealer...');
  const dealerId = await getOrCreateDealer();
  console.log(`   ✓ Dealer ID: ${dealerId}\n`);

  let totalImported = 0;
  let totalSkipped = 0;

  for (const category of CATEGORIES) {
    const products = await scrapeCategory(category.url, category.condition);
    console.log(`   Found ${products.length} ${category.condition} products total`);

    // Import each product
    for (const product of products) {
      // Get detailed info
      if (product.detailUrl) {
        const details = await scrapeProductDetail(product.detailUrl);
        Object.assign(product, details);
        await sleep(1000);
      }

      const result = await importListing(dealerId, product, category.condition);
      if (result.action === 'imported') {
        totalImported++;
        process.stdout.write(`   Imported: ${totalImported}\r`);
      } else {
        totalSkipped++;
      }
    }
    console.log();
  }

  console.log('\n==================================================');
  console.log(`📊 Summary:`);
  console.log(`   Imported: ${totalImported}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log('==================================================\n');
}

main().catch(console.error);
