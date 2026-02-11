// @ts-nocheck
/**
 * Shared utilities for manufacturer product catalog scrapers.
 * Used by scripts/scrape-mfr-*.mjs to scrape manufacturer websites
 * and upsert products into the manufacturer_products table.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

puppeteer.use(StealthPlugin());

/**
 * Create a Puppeteer browser instance with stealth settings
 */
export async function createBrowser(headless = 'new') {
  const browser = await puppeteer.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ],
  });

  return browser;
}

/**
 * Create a new page with standard settings
 */
export async function createPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  return page;
}

/**
 * Get a Supabase client with service role key for write access
 */
export function getSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Get manufacturer ID by slug
 */
export async function getManufacturerId(supabase, slug) {
  const { data, error } = await supabase
    .from('manufacturers')
    .select('id')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    throw new Error(`Manufacturer not found: ${slug}`);
  }
  return data.id;
}

/**
 * Upsert a manufacturer product. Returns the product ID.
 */
export async function upsertProduct(supabase, manufacturerId, product) {
  const slug = slugify(product.name);

  const row = {
    manufacturer_id: manufacturerId,
    name: product.name,
    slug,
    series: product.series || null,
    model_number: product.model_number || null,
    tagline: product.tagline || null,
    description: product.description || null,
    short_description: product.short_description || null,
    product_type: product.product_type || 'lowboy',
    tonnage_min: product.tonnage_min || null,
    tonnage_max: product.tonnage_max || null,
    deck_height_inches: product.deck_height_inches || null,
    deck_length_feet: product.deck_length_feet || null,
    overall_length_feet: product.overall_length_feet || null,
    axle_count: product.axle_count || null,
    gooseneck_type: product.gooseneck_type || null,
    empty_weight_lbs: product.empty_weight_lbs || null,
    gvwr_lbs: product.gvwr_lbs || null,
    concentrated_capacity_lbs: product.concentrated_capacity_lbs || null,
    msrp_low: product.msrp_low || null,
    msrp_high: product.msrp_high || null,
    source_url: product.source_url || null,
    last_scraped_at: new Date().toISOString(),
    is_active: true,
  };

  const { data, error } = await supabase
    .from('manufacturer_products')
    .upsert(row, { onConflict: 'manufacturer_id,slug' })
    .select('id')
    .single();

  if (error) {
    console.error(`  Error upserting product "${product.name}":`, error.message);
    return null;
  }

  return data.id;
}

/**
 * Upsert product images. Deletes existing images and re-inserts.
 */
export async function upsertProductImages(supabase, productId, images) {
  if (!images || images.length === 0) return;

  // Delete existing images for this product
  await supabase
    .from('manufacturer_product_images')
    .delete()
    .eq('product_id', productId);

  // Insert new images
  const rows = images.map((img, i) => ({
    product_id: productId,
    url: img.url,
    alt_text: img.alt_text || null,
    sort_order: i,
    is_primary: i === 0,
    source_url: img.source_url || null,
  }));

  const { error } = await supabase
    .from('manufacturer_product_images')
    .insert(rows);

  if (error) {
    console.error(`  Error inserting images for product ${productId}:`, error.message);
  }
}

/**
 * Upsert product specs. Deletes existing specs and re-inserts.
 */
export async function upsertProductSpecs(supabase, productId, specs) {
  if (!specs || specs.length === 0) return;

  // Delete existing specs for this product
  await supabase
    .from('manufacturer_product_specs')
    .delete()
    .eq('product_id', productId);

  // Insert new specs
  const rows = specs.map((spec, i) => ({
    product_id: productId,
    spec_category: spec.category,
    spec_key: spec.key,
    spec_value: spec.value,
    spec_unit: spec.unit || null,
    sort_order: i,
  }));

  const { error } = await supabase
    .from('manufacturer_product_specs')
    .insert(rows);

  if (error) {
    console.error(`  Error inserting specs for product ${productId}:`, error.message);
  }
}

/**
 * Update the product_count on the manufacturers table
 */
export async function updateProductCount(supabase, manufacturerId) {
  const { count } = await supabase
    .from('manufacturer_products')
    .select('*', { count: 'exact', head: true })
    .eq('manufacturer_id', manufacturerId)
    .eq('is_active', true);

  await supabase
    .from('manufacturers')
    .update({ product_count: count || 0 })
    .eq('id', manufacturerId);

  return count || 0;
}

/**
 * Sleep for a given number of milliseconds (default 300ms)
 */
export function sleep(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean up text - trim whitespace, normalize spaces, remove excessive newlines
 */
export function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

/**
 * Parse a weight string like "19,560 lbs" or "20,100 lb" into a number
 */
export function parseWeight(str) {
  if (!str) return null;
  const match = str.replace(/,/g, '').match(/([\d.]+)\s*(lbs?|pounds?|kg)?/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (match[2] && /kg/i.test(match[2])) {
    return Math.round(val * 2.20462); // Convert kg to lbs
  }
  return Math.round(val);
}

/**
 * Parse a tonnage string like "55 Ton" or "35-55 ton" into min/max
 */
export function parseTonnage(str) {
  if (!str) return { min: null, max: null };
  const cleaned = str.replace(/,/g, '').toLowerCase();

  // Range: "35-55 ton"
  const rangeMatch = cleaned.match(/([\d.]+)\s*[-–to]+\s*([\d.]+)\s*ton/i);
  if (rangeMatch) {
    return { min: Math.round(parseFloat(rangeMatch[1])), max: Math.round(parseFloat(rangeMatch[2])) };
  }

  // Single: "55 ton"
  const singleMatch = cleaned.match(/([\d.]+)\s*ton/i);
  if (singleMatch) {
    const val = Math.round(parseFloat(singleMatch[1]));
    return { min: val, max: val };
  }

  // Capacity in lbs: "110,000 lbs"
  const lbsMatch = cleaned.match(/([\d,]+)\s*lbs?/i);
  if (lbsMatch) {
    const lbs = parseFloat(lbsMatch[1].replace(/,/g, ''));
    const tons = Math.round(lbs / 2000);
    return { min: tons, max: tons };
  }

  return { min: null, max: null };
}

/**
 * Parse deck height from a string like "18 inches" or '22"' into a number
 */
export function parseDeckHeight(str) {
  if (!str) return null;
  const match = str.replace(/,/g, '').match(/([\d.]+)\s*("|in|inch|inches)?/i);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Parse a length string like "26' " or "52'8\"" into feet (decimal)
 */
export function parseLength(str) {
  if (!str) return null;
  // Handle feet and inches: 52'8"
  const ftInMatch = str.match(/([\d.]+)['']\s*([\d.]+)/);
  if (ftInMatch) {
    return parseFloat(ftInMatch[1]) + parseFloat(ftInMatch[2]) / 12;
  }
  // Handle feet only: 26'
  const ftMatch = str.match(/([\d.]+)\s*[''ft]/i);
  if (ftMatch) {
    return parseFloat(ftMatch[1]);
  }
  // Handle plain number
  const numMatch = str.match(/([\d.]+)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }
  return null;
}

/**
 * Create a URL-friendly slug from a string
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * Print a header banner for a scraper
 */
export function printBanner(manufacturerName, website) {
  console.log(`\n🏭 Scraping ${manufacturerName} Product Catalog`);
  console.log(`   Source: ${website}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Print a summary after scraping
 */
export function printSummary(manufacturerName, stats) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Manufacturer: ${manufacturerName}`);
  console.log(`   Products scraped: ${stats.scraped || 0}`);
  console.log(`   Products upserted: ${stats.upserted || 0}`);
  console.log(`   Errors: ${stats.errors || 0}`);
  console.log('='.repeat(60) + '\n');
}
