// @ts-nocheck
/**
 * Dealer Inventory Scraper
 * Scrapes listings from Pinnacle Trailers and Hale Trailer
 *
 * Usage: npx tsx scripts/scrape-dealers.ts [--pinnacle] [--hale] [--resume]
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
import 'dotenv/config';

// Supabase client - initialized lazily
let supabase: ReturnType<typeof createClient>;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
}

const PROGRESS_FILE = path.join(__dirname, '.scrape-progress.json');
const RATE_LIMIT_MS = 500; // 500ms between requests
const CONCURRENT_LIMIT = 3;

interface ScrapedListing {
  source: 'pinnacle' | 'hale';
  source_url: string;
  source_id: string;
  title: string;
  year: number | null;
  make: string;
  model: string;
  vin: string | null;
  condition: 'new' | 'used';
  listing_type: 'sale' | 'rent';
  price: number | null;
  rental_rate_daily: number | null;
  rental_rate_weekly: number | null;
  rental_rate_monthly: number | null;
  description: string | null;
  specs: Record<string, string | number>;
  images: string[];
  city: string | null;
  state: string | null;
  category_slug: string;
}

interface Progress {
  pinnacle: {
    completed_pages: number[];
    listings_imported: number;
  };
  hale: {
    new_completed_pages: number[];
    rental_completed_pages: number[];
    used_completed_pages: number[];
    listings_imported: number;
  };
}

// Category mapping from scraped data to our slugs
const CATEGORY_MAP: Record<string, string> = {
  // Pinnacle categories
  'chipper-trailers': 'chip-trailers',
  'chip trailers': 'chip-trailers',
  'flatbed-trailers': 'flatbed-trailers',
  'flatbed trailers': 'flatbed-trailers',
  'live-floor-trailers': 'live-floor-trailers',
  'live floor trailers': 'live-floor-trailers',
  'dump-trailers-end': 'end-dump-trailers',
  'end dump trailers': 'end-dump-trailers',
  'dump-trailers-side': 'side-dump-trailers',
  'side dump trailers': 'side-dump-trailers',
  'lowboy-trailers': 'lowboy-trailers',
  'lowboy trailers': 'lowboy-trailers',
  'drop-deck-trailers': 'step-deck-trailers',
  'step deck trailers': 'step-deck-trailers',

  // Hale categories
  'dry-van': 'dry-van-trailers',
  'dry van': 'dry-van-trailers',
  'reefer': 'reefer-trailers',
  'refrigerated': 'reefer-trailers',
  'flatbed': 'flatbed-trailers',
  'lowboy': 'lowboy-trailers',
  'dump': 'dump-trailers',
  'hopper-bottom': 'dump-trailers',
  'tank': 'tank-trailers',
  'tanker': 'tank-trailers',
  'moving-floor': 'live-floor-trailers',
  'tipper': 'tipper-trailers',
  'yard-tractor': 'yard-tractors',
  'container chassis': 'container-chassis',
  'container-chassis': 'container-chassis',
  'intermodal chassis': 'intermodal-chassis',
  'storage': 'storage-containers',
  'office': 'office-trailers',

  // Default
  'default': 'specialty-trailers',
};

function getCategorySlug(categoryText: string): string {
  const normalized = categoryText.toLowerCase().trim();

  for (const [key, slug] of Object.entries(CATEGORY_MAP)) {
    if (normalized.includes(key)) {
      return slug;
    }
  }

  return CATEGORY_MAP['default'];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.log('Could not load progress file, starting fresh');
  }

  return {
    pinnacle: { completed_pages: [], listings_imported: 0 },
    hale: { new_completed_pages: [], rental_completed_pages: [], used_completed_pages: [], listings_imported: 0 },
  };
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function fetchPage(url: string): Promise<cheerio.CheerioAPI | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 30000,
    });
    return cheerio.load(response.data);
  } catch (error: any) {
    console.error(`Failed to fetch ${url}:`, error.message);
    return null;
  }
}

// ============================================
// PINNACLE TRAILERS SCRAPER
// ============================================

async function scrapePinnacleListingPage(url: string): Promise<string[]> {
  const $ = await fetchPage(url);
  if (!$) return [];

  const listingUrls: string[] = [];

  // Find all listing links
  $('a[href*="/trailers/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('-pt') && !listingUrls.includes(href)) {
      const fullUrl = href.startsWith('http') ? href : `https://www.pinnacletrailers.com${href}`;
      listingUrls.push(fullUrl);
    }
  });

  return [...new Set(listingUrls)]; // Remove duplicates
}

async function scrapePinnacleDetail(url: string): Promise<ScrapedListing | null> {
  const $ = await fetchPage(url);
  if (!$) return null;

  try {
    // Extract stock number from URL
    const stockMatch = url.match(/pt\d+/i);
    const stockNumber = stockMatch ? stockMatch[0].toUpperCase() : '';

    // Extract title
    const title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();

    // Parse year, make from title
    const titleParts = title.split('-');
    const year = parseInt(titleParts[0]) || null;
    const make = titleParts[1]?.trim() || 'Unknown';
    const model = titleParts.slice(2).join(' ').trim() || title;

    // Extract VIN
    let vin: string | null = null;
    $('*').each((_, el) => {
      const text = $(el).text();
      if (text.includes('VIN:') || text.includes('VIN #')) {
        const vinMatch = text.match(/VIN[:#]?\s*([A-Z0-9]{17})/i);
        if (vinMatch) vin = vinMatch[1];
      }
    });

    // Extract specs
    const specs: Record<string, string | number> = {};
    $('li, tr, .spec-item, .detail-item').each((_, el) => {
      const text = $(el).text().trim();
      const colonMatch = text.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        specs[colonMatch[1].trim().toLowerCase()] = colonMatch[2].trim();
      }
    });

    // Determine condition
    const pageText = $('body').text().toLowerCase();
    const condition: 'new' | 'used' = pageText.includes('used') ? 'used' : 'new';

    // Extract images
    const images: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && (src.includes('PT') || src.includes('pt')) && src.includes('.jpg')) {
        const fullSrc = src.startsWith('http') ? src : `https://www.pinnacletrailers.com${src}`;
        if (!images.includes(fullSrc)) {
          images.push(fullSrc);
        }
      }
    });

    // Also check for image pattern
    if (images.length === 0 && stockNumber) {
      for (let i = 1; i <= 10; i++) {
        images.push(`https://www.pinnacletrailers.com/wp-content/uploads/${stockNumber}-${i}.jpg`);
      }
    }

    // Extract category from URL
    const urlParts = url.split('/');
    const categoryFromUrl = urlParts.find(p => p.includes('-trailers')) || 'trailers';

    return {
      source: 'pinnacle',
      source_url: url,
      source_id: stockNumber,
      title,
      year,
      make,
      model,
      vin,
      condition,
      listing_type: 'sale',
      price: null, // Pinnacle shows "Call for pricing"
      rental_rate_daily: null,
      rental_rate_weekly: null,
      rental_rate_monthly: null,
      description: specs['description'] as string || null,
      specs,
      images: images.slice(0, 10), // Limit to 10 images
      city: 'Marysville',
      state: 'WA',
      category_slug: getCategorySlug(categoryFromUrl),
    };
  } catch (error: any) {
    console.error(`Error parsing Pinnacle listing ${url}:`, error.message);
    return null;
  }
}

async function scrapePinnacleTrailers(progress: Progress): Promise<ScrapedListing[]> {
  console.log('\n📦 Scraping Pinnacle Trailers...');
  const listings: ScrapedListing[] = [];

  const baseUrl = 'https://www.pinnacletrailers.com/trailers/';
  const totalPages = 73;

  for (let page = 1; page <= totalPages; page++) {
    if (progress.pinnacle.completed_pages.includes(page)) {
      console.log(`  Skipping page ${page} (already completed)`);
      continue;
    }

    const pageUrl = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
    console.log(`  Fetching page ${page}/${totalPages}: ${pageUrl}`);

    const listingUrls = await scrapePinnacleListingPage(pageUrl);
    console.log(`    Found ${listingUrls.length} listings`);

    for (const url of listingUrls) {
      await sleep(RATE_LIMIT_MS);
      const listing = await scrapePinnacleDetail(url);
      if (listing) {
        listings.push(listing);
        console.log(`    ✓ Scraped: ${listing.title.substring(0, 50)}...`);
      }
    }

    progress.pinnacle.completed_pages.push(page);
    saveProgress(progress);

    await sleep(RATE_LIMIT_MS);
  }

  return listings;
}

// ============================================
// HALE TRAILER SCRAPER
// ============================================

async function scrapeHaleListingPage(url: string): Promise<string[]> {
  const $ = await fetchPage(url);
  if (!$) return [];

  const listingUrls: string[] = [];

  // Find listing links - Hale uses /trailer/AXXXXXX/ pattern
  $('a[href*="/trailer/a"], a[href*="/rental/a"], a[href*="/used/a"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /\/a\d+\/?$/.test(href)) {
      const fullUrl = href.startsWith('http') ? href : `https://haletrailer.com${href}`;
      if (!listingUrls.includes(fullUrl)) {
        listingUrls.push(fullUrl);
      }
    }
  });

  return [...new Set(listingUrls)];
}

async function scrapeHaleDetail(url: string, listingType: 'sale' | 'rent'): Promise<ScrapedListing | null> {
  const $ = await fetchPage(url);
  if (!$) return null;

  try {
    // Extract ID from URL
    const idMatch = url.match(/a(\d+)/i);
    const sourceId = idMatch ? `A${idMatch[1]}` : '';

    // Extract title
    const title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();

    // Extract make/brand (usually first word in title)
    const titleParts = title.split(' ');
    const make = titleParts[0] || 'Unknown';
    const model = titleParts.slice(1).join(' ') || title;

    // Extract year
    let year: number | null = null;
    $('*').each((_, el) => {
      const text = $(el).text();
      const yearMatch = text.match(/Year[:\s]*(\d{4})/i);
      if (yearMatch) year = parseInt(yearMatch[1]);
    });

    // Extract VIN
    let vin: string | null = null;
    $('*').each((_, el) => {
      const text = $(el).text();
      const vinMatch = text.match(/VIN[:#]?\s*([A-Z0-9]{17})/i);
      if (vinMatch) vin = vinMatch[1];
    });

    // Extract location
    let city: string | null = null;
    let state: string | null = null;
    $('*').each((_, el) => {
      const text = $(el).text().trim();
      // Match patterns like "Baltimore, MD" or "Des Moines, IA"
      const locMatch = text.match(/([A-Za-z\s]+),\s*([A-Z]{2})\b/);
      if (locMatch && !city) {
        city = locMatch[1].trim();
        state = locMatch[2];
      }
    });

    // Extract specs
    const specs: Record<string, string | number> = {};
    $('li, tr, .spec-item, .detail-item, .specification').each((_, el) => {
      const text = $(el).text().trim();
      const colonMatch = text.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        specs[colonMatch[1].trim().toLowerCase()] = colonMatch[2].trim();
      }
    });

    // Determine condition
    const isUsed = url.includes('/used/') || $('body').text().toLowerCase().includes('used');
    const condition: 'new' | 'used' = isUsed ? 'used' : 'new';

    // Extract images - Hale uses trailerimages.haletrailer.com
    const images: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && src.includes('trailerimages.haletrailer.com')) {
        if (!images.includes(src)) {
          images.push(src);
        }
      }
    });

    // Default image pattern
    if (images.length === 0 && sourceId) {
      images.push(`https://trailerimages.haletrailer.com/inv/imgs/trailer/${sourceId}-1.jpg`);
    }

    // Determine category from title/model
    const categorySlug = getCategorySlug(title + ' ' + model);

    return {
      source: 'hale',
      source_url: url,
      source_id: sourceId,
      title,
      year,
      make,
      model,
      vin,
      condition,
      listing_type: listingType,
      price: null,
      rental_rate_daily: null,
      rental_rate_weekly: null,
      rental_rate_monthly: null,
      description: null,
      specs,
      images: images.slice(0, 10),
      city,
      state,
      category_slug: categorySlug,
    };
  } catch (error: any) {
    console.error(`Error parsing Hale listing ${url}:`, error.message);
    return null;
  }
}

async function scrapeHaleSection(
  baseUrl: string,
  totalPages: number,
  listingType: 'sale' | 'rent',
  completedPages: number[],
  sectionName: string
): Promise<ScrapedListing[]> {
  console.log(`\n  📦 Scraping Hale ${sectionName}...`);
  const listings: ScrapedListing[] = [];

  for (let page = 1; page <= Math.min(totalPages, 50); page++) { // Limit to first 50 pages for speed
    if (completedPages.includes(page)) {
      console.log(`    Skipping page ${page} (already completed)`);
      continue;
    }

    const pageUrl = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
    console.log(`    Fetching page ${page}/${totalPages}: ${pageUrl}`);

    const listingUrls = await scrapeHaleListingPage(pageUrl);
    console.log(`      Found ${listingUrls.length} listings`);

    for (const url of listingUrls) {
      await sleep(RATE_LIMIT_MS);
      const listing = await scrapeHaleDetail(url, listingType);
      if (listing) {
        listings.push(listing);
        console.log(`      ✓ Scraped: ${listing.title.substring(0, 40)}...`);
      }
    }

    completedPages.push(page);
    await sleep(RATE_LIMIT_MS);
  }

  return listings;
}

async function scrapeHaleTrailer(progress: Progress): Promise<ScrapedListing[]> {
  console.log('\n📦 Scraping Hale Trailer...');
  const allListings: ScrapedListing[] = [];

  // Scrape New Trailers (limited to first 50 pages = ~600 listings)
  const newListings = await scrapeHaleSection(
    'https://haletrailer.com/trailer/',
    413,
    'sale',
    progress.hale.new_completed_pages,
    'New Trailers'
  );
  allListings.push(...newListings);
  saveProgress(progress);

  // Scrape Rentals (limited to first 50 pages = ~600 listings)
  const rentalListings = await scrapeHaleSection(
    'https://haletrailer.com/rental/',
    343,
    'rent',
    progress.hale.rental_completed_pages,
    'Rentals'
  );
  allListings.push(...rentalListings);
  saveProgress(progress);

  // Scrape Used (all 42 pages = ~500 listings)
  const usedListings = await scrapeHaleSection(
    'https://haletrailer.com/used/',
    42,
    'sale',
    progress.hale.used_completed_pages,
    'Used Trailers'
  );
  allListings.push(...usedListings);
  saveProgress(progress);

  return allListings;
}

// ============================================
// DATABASE IMPORT
// ============================================

async function getOrCreateDealerProfile(
  name: string,
  email: string,
  phone: string,
  location: string
): Promise<string> {
  // Check if dealer exists
  const { data: existing } = await getSupabase()
    .from('profiles')
    .select('id')
    .eq('company_name', name)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create dealer profile using auth admin
  const { data: authData, error: authError } = await getSupabase().auth.admin.createUser({
    email,
    password: Math.random().toString(36).slice(-16) + 'Aa1!',
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create dealer auth: ${authError?.message}`);
  }

  // Update profile
  const { error: profileError } = await getSupabase()
    .from('profiles')
    .update({
      company_name: name,
      phone,
      location,
      is_dealer: true,
    })
    .eq('id', authData.user.id);

  if (profileError) {
    throw new Error(`Failed to update dealer profile: ${profileError.message}`);
  }

  return authData.user.id;
}

async function getCategoryId(slug: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single();

  return data?.id || null;
}

async function importListing(listing: ScrapedListing, dealerId: string): Promise<boolean> {
  try {
    // Check if already imported
    const { data: existing } = await getSupabase()
      .from('listings')
      .select('id')
      .eq('vin', listing.source_id)
      .single();

    if (existing) {
      console.log(`    Skipping ${listing.source_id} (already exists)`);
      return false;
    }

    // Get category ID
    let categoryId = await getCategoryId(listing.category_slug);
    if (!categoryId) {
      categoryId = await getCategoryId('specialty-trailers');
    }

    if (!categoryId) {
      console.error(`    No category found for ${listing.category_slug}`);
      return false;
    }

    // Insert listing
    const { data: newListing, error } = await getSupabase()
      .from('listings')
      .insert({
        user_id: dealerId,
        category_id: categoryId,
        title: listing.title.substring(0, 200),
        description: listing.description || `${listing.year || ''} ${listing.make} ${listing.model}`.trim(),
        price: listing.price,
        condition: listing.condition,
        listing_type: listing.listing_type,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        vin: listing.vin || listing.source_id, // Use source_id as fallback
        city: listing.city,
        state: listing.state,
        country: 'USA',
        specs: listing.specs,
        rental_rate_daily: listing.rental_rate_daily,
        rental_rate_weekly: listing.rental_rate_weekly,
        rental_rate_monthly: listing.rental_rate_monthly,
        status: 'active',
        is_featured: false,
      })
      .select('id')
      .single();

    if (error || !newListing) {
      console.error(`    Failed to insert listing: ${error?.message}`);
      return false;
    }

    // Insert images
    if (listing.images.length > 0) {
      const imageInserts = listing.images.map((url, idx) => ({
        listing_id: newListing.id,
        url,
        thumbnail_url: url,
        sort_order: idx,
        is_primary: idx === 0,
      }));

      await getSupabase().from('listing_images').insert(imageInserts);
    }

    return true;
  } catch (error: any) {
    console.error(`    Import error: ${error.message}`);
    return false;
  }
}

async function importListings(listings: ScrapedListing[], dealerId: string, source: string): Promise<number> {
  console.log(`\n📥 Importing ${listings.length} ${source} listings...`);
  let imported = 0;

  for (const listing of listings) {
    const success = await importListing(listing, dealerId);
    if (success) {
      imported++;
      if (imported % 10 === 0) {
        console.log(`  Imported ${imported}/${listings.length}`);
      }
    }
  }

  return imported;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const scrapePinnacle = args.includes('--pinnacle') || args.length === 0;
  const scrapeHaleArg = args.includes('--hale') || args.length === 0;
  const resume = args.includes('--resume');

  console.log('🚀 Dealer Inventory Scraper');
  console.log('='.repeat(50));

  const progress = resume ? loadProgress() : {
    pinnacle: { completed_pages: [], listings_imported: 0 },
    hale: { new_completed_pages: [], rental_completed_pages: [], used_completed_pages: [], listings_imported: 0 },
  };

  // Create dealer profiles
  console.log('\n👤 Setting up dealer profiles...');

  let pinnacleId: string | null = null;
  let haleId: string | null = null;

  if (scrapePinnacle) {
    pinnacleId = await getOrCreateDealerProfile(
      'Pinnacle Trailers',
      'inventory@pinnacletrailers.com',
      '(360) 659-1919',
      'Marysville, WA'
    );
    console.log(`  ✓ Pinnacle Trailers dealer ID: ${pinnacleId}`);
  }

  if (scrapeHaleArg) {
    haleId = await getOrCreateDealerProfile(
      'Hale Trailer',
      'inventory@haletrailer.com',
      '(800) 274-4253',
      'Multiple Locations'
    );
    console.log(`  ✓ Hale Trailer dealer ID: ${haleId}`);
  }

  // Scrape and import Pinnacle
  if (scrapePinnacle && pinnacleId) {
    const pinnacleListings = await scrapePinnacleTrailers(progress);
    const imported = await importListings(pinnacleListings, pinnacleId, 'Pinnacle');
    progress.pinnacle.listings_imported += imported;
    saveProgress(progress);
    console.log(`\n✅ Pinnacle: Imported ${imported} listings`);
  }

  // Scrape and import Hale
  if (scrapeHaleArg && haleId) {
    const haleListings = await scrapeHaleTrailer(progress);
    const imported = await importListings(haleListings, haleId, 'Hale');
    progress.hale.listings_imported += imported;
    saveProgress(progress);
    console.log(`\n✅ Hale: Imported ${imported} listings`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Final Summary:');
  console.log(`  Pinnacle: ${progress.pinnacle.listings_imported} listings`);
  console.log(`  Hale: ${progress.hale.listings_imported} listings`);
  console.log('='.repeat(50));
}

main().catch(console.error);
