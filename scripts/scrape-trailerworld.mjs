// @ts-nocheck
/**
 * Trailer World Scraper
 * Scrapes trailers from trailerworld.com
 *
 * Usage: node scripts/scrape-trailerworld.mjs
 */

import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Trailer World Inc',
  email: 'sales@trailerworld.com',
  phone: '(270) 843-4587',
  website: 'https://www.trailerworld.com',
  city: 'Bowling Green',
  state: 'KY',
  country: 'USA',
};

const BASE_URL = 'https://www.trailerworld.com';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// Category mapping from Trailer World types to our slugs
const CATEGORY_MAP = {
  'car hauler trailer': 'car-carriers',
  'cargo trailer': 'enclosed-trailers',
  'cattle/livestock trailer': 'livestock-trailers',
  'concession/vending trailer': 'concession-trailers',
  'dump trailer': 'dump-trailers',
  'equipment trailer': 'equipment-trailers',
  'horse trailer': 'horse-trailers',
  'utility trailer': 'utility-trailers',
  'travel trailer': 'travel-trailers',
  'stacker trailer': 'specialty-trailers',
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

async function getCategoryId(typeName) {
  const slug = CATEGORY_MAP[typeName.toLowerCase()] || 'trailers';

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

function parseListingCard($, card) {
  const $card = $(card);

  // Trailer World uses SiteSource platform with specific selectors
  const title = $card.find('p.anchor__text').text().trim() ||
                $card.find('.inventory-unit__title').text().trim();
  const linkEl = $card.find('a.listPages__imageLink, a[href*="-i"]').first();
  const detailUrl = linkEl.attr('href');

  // Price - look for price element
  const priceText = $card.find('.inventory-unit__price, .price').text().trim();
  const price = priceText ? parseFloat(priceText.replace(/[$,]/g, '')) : null;

  // Image - CloudFront URLs start with //
  let imgSrc = $card.find('img').attr('src') || $card.find('img').attr('data-src');
  if (imgSrc && imgSrc.startsWith('//')) {
    imgSrc = 'https:' + imgSrc;
  }

  // Stock number from .list-stock element
  const stockText = $card.find('.list-stock').text().trim();
  const stockNumber = stockText.replace(/Stock[:\s#]*/i, '').trim() || null;

  // Parse year/make/model from title
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  return {
    title,
    detailUrl: detailUrl?.startsWith('http') ? detailUrl : (detailUrl ? `${BASE_URL}${detailUrl}` : null),
    price: price > 0 ? price : null,
    year,
    imageUrl: imgSrc?.startsWith('http') ? imgSrc : (imgSrc ? `${BASE_URL}${imgSrc}` : null),
    stockNumber,
  };
}

async function scrapeDetailPage(url) {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const images = [];
    $('img[src*="inventory"], .gallery img, .carousel img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !images.includes(src)) {
        const fullUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        images.push(fullUrl);
      }
    });

    const description = $('.description, .details, #description').text().trim();

    // Extract specs
    const specs = {};
    $('.spec-row, .specs tr, .details-list li').each((i, el) => {
      const text = $(el).text();
      if (text.includes('Stock')) specs.stockNumber = text.replace(/Stock[:\s#]*/i, '').trim();
      if (text.includes('VIN')) specs.vin = text.replace(/VIN[:\s]*/i, '').trim();
      if (text.includes('GVWR')) specs.gvwr = text.replace(/GVWR[:\s]*/i, '').trim();
      if (text.includes('Length')) specs.length = text.replace(/Length[:\s]*/i, '').trim();
      if (text.includes('Width')) specs.width = text.replace(/Width[:\s]*/i, '').trim();
      if (text.includes('Condition')) specs.condition = text.replace(/Condition[:\s]*/i, '').trim().toLowerCase();
    });

    // Try to extract make from title or content
    const make = $('h1, .title').text().match(/(?:aluma|sure-trac|midsota|sundowner|better built|cargo mate)/i)?.[0] || '';

    return { images, description, ...specs, make };
  } catch (error) {
    console.error(`Error fetching detail: ${error.message}`);
    return { images: [], description: '' };
  }
}

async function importListing(dealerId, product, typeName) {
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

  const categoryId = await getCategoryId(typeName);
  const condition = product.condition === 'used' ? 'used' : 'new';

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      user_id: dealerId,
      category_id: categoryId,
      title: product.title,
      description: product.description || product.title,
      price: product.price,
      price_type: product.price ? 'fixed' : 'contact',
      condition,
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

async function scrapeInventory() {
  console.log('\n   Scraping inventory...');

  const products = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const url = page === 1
      ? `${BASE_URL}/inventory`
      : `${BASE_URL}/inventory?page=${page}`;

    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // Find listing cards - Trailer World uses .inventory-unit containers
      const cards = $('.inventory-unit');

      if (cards.length === 0) {
        console.log(`     Page ${page}: No products found, stopping`);
        hasMore = false;
        break;
      }

      cards.each((i, card) => {
        const product = parseListingCard($, card);
        if (product.title && product.detailUrl) {
          products.push(product);
        }
      });

      console.log(`     Page ${page}: Found ${cards.length} products`);

      // Check for next page
      const nextLink = $('a[href*="page="]:contains("Next"), .pagination a:last-child').attr('href');
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
  console.log('🚛 Trailer World Scraper');
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
        const details = await scrapeDetailPage(product.detailUrl);
        Object.assign(product, details);
        await sleep(800);
      } catch (e) {
        // Continue without details
      }
    }

    const result = await importListing(dealerId, product, 'trailer');
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
