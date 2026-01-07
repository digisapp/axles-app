// @ts-nocheck
/**
 * Midco Sales Scraper
 * Scrapes trailers and tow trucks from midcosales.com (Car Dealer theme)
 *
 * Usage: node scripts/scrape-midco.mjs
 */

import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Midco Sales',
  email: 'sales@midcosales.com',
  phone: '(480) 633-9910',
  website: 'https://midcosales.com',
  city: 'Mesa',
  state: 'AZ',
  country: 'USA',
};

const BASE_URL = 'https://midcosales.com';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// Category URLs to scrape
const CATEGORIES = [
  { url: `${BASE_URL}/vehicle-category/trailer/`, type: 'trailer' },
  { url: `${BASE_URL}/vehicle-category/tow-truck/`, type: 'tow-truck' },
];

// Category mapping
const CATEGORY_MAP = {
  'flatbed': 'flatbed-trailers',
  'lowboy': 'lowboy-trailers',
  'dump': 'dump-trailers',
  'drop deck': 'drop-deck-trailers',
  'double drop': 'double-drop-trailers',
  'end dump': 'dump-trailers',
  'belly dump': 'dump-trailers',
  'tow truck': 'tow-trucks',
  'wrecker': 'wreckers',
  'rollback': 'rollback-trucks',
  'tag trailer': 'tag-trailers',
  'tilt deck': 'tilt-trailers',
  'traveling axle': 'lowboy-trailers',
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

async function getCategoryId(title, type) {
  const titleLower = title.toLowerCase();
  let slug = type === 'tow-truck' ? 'tow-trucks' : 'trailers';

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
    .eq('slug', type === 'tow-truck' ? 'trucks' : 'trailers')
    .single();

  return fallback?.id;
}

function parseProductCard($, card) {
  const $card = $(card);

  // Get title and URL
  const $titleLink = $card.find('.car-content > a').first();
  const title = $titleLink.text().trim();
  const detailUrl = $titleLink.attr('href');

  if (!title || !detailUrl) return null;

  // Get image
  const imgSrc = $card.find('.car-image img').attr('src');

  // Get price
  const priceText = $card.find('.car-price .new-price').text().trim() ||
                    $card.find('.car-price .old-price').text().trim();
  const price = priceText ? parseFloat(priceText.replace(/[$,]/g, '')) : null;

  // Get condition
  const conditionEl = $card.find('.car-condition').text().trim().toLowerCase();
  const condition = conditionEl.includes('used') ? 'used' : 'new';

  // Parse year from title (e.g., "2023 XL Specialized...")
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  // Parse make from title
  const parts = title.replace(/^\d{4}\s+/, '').split(/\s+/);
  const make = parts.length > 0 ? parts[0] : '';

  return {
    title,
    detailUrl: detailUrl.startsWith('http') ? detailUrl : `${BASE_URL}${detailUrl}`,
    imageUrl: imgSrc,
    price: price > 0 ? price : null,
    condition,
    year,
    make,
  };
}

async function scrapeProductDetail(url) {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const images = [];
    // Get all gallery images
    $('.car-details img, .slider-for img, .vehicle-gallery img').each((i, el) => {
      let src = $(el).attr('data-large_image') || $(el).attr('data-src') || $(el).attr('src');
      if (src && !images.includes(src) && src.includes('uploads')) {
        // Get full size image
        src = src.replace(/-\d+x\d+\./, '.');
        if (!images.includes(src)) images.push(src);
      }
    });

    // Get description
    const description = $('.vehicle-overview, .car-description, .entry-content').first().text().trim();

    // Try to find stock number
    const pageText = $('body').text();
    const stockMatch = pageText.match(/Stock[:\s#]*(\w+)/i);
    const stockNumber = stockMatch ? stockMatch[1] : null;

    // Try to find VIN
    const vinMatch = pageText.match(/VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i);
    const vin = vinMatch ? vinMatch[1] : null;

    return { images, description, stockNumber, vin };
  } catch (error) {
    console.error(`Error fetching detail: ${error.message}`);
    return { images: [], description: '', stockNumber: null, vin: null };
  }
}

async function importListing(dealerId, product, type) {
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

  const categoryId = await getCategoryId(product.title, type);

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
      city: DEALER_INFO.city,
      state: DEALER_INFO.state,
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
  const images = product.images?.length ? product.images : (product.imageUrl ? [product.imageUrl] : []);
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

async function scrapeCategory(categoryUrl, type) {
  console.log(`\n   Scraping ${type}s from ${categoryUrl}...`);

  const products = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const url = page === 1 ? categoryUrl : `${categoryUrl}page/${page}/`;

    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      const cards = $('.car-item');

      if (cards.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`     Page ${page}: Found ${cards.length} products`);

      cards.each((i, card) => {
        const product = parseProductCard($, card);
        if (product) {
          products.push({ ...product, type });
        }
      });

      // Check for next page
      const nextLink = $('a.next, .pagination a[rel="next"], .pagination li:last-child a').attr('href');
      hasMore = !!nextLink && page < 20;
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
  console.log('🚛 Midco Sales Scraper');
  console.log('==================================================\n');

  console.log('👤 Setting up dealer...');
  const dealerId = await getOrCreateDealer();
  console.log(`   ✓ Dealer ID: ${dealerId}`);

  let allProducts = [];

  for (const category of CATEGORIES) {
    const products = await scrapeCategory(category.url, category.type);
    allProducts.push(...products);
    console.log(`   Found ${products.length} ${category.type}s`);
  }

  console.log(`\n   Total: ${allProducts.length} products\n`);

  let totalImported = 0;
  let totalSkipped = 0;

  for (const product of allProducts) {
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

    const result = await importListing(dealerId, product, product.type);
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
