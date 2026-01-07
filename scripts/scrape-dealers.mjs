/**
 * Dealer Inventory Scraper
 * Scrapes listings from Pinnacle Trailers and Hale Trailer
 *
 * Usage: node scripts/scrape-dealers.mjs [--pinnacle] [--hale] [--limit=N]
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROGRESS_FILE = join(__dirname, '.scrape-progress.json');
const RATE_LIMIT_MS = 300;

// Category mapping - comprehensive list matching TruckPaper categories
const CATEGORY_MAP = {
  // Flatbed types
  'flatbed': 'flatbed-trailers',
  'flatbed-trailers': 'flatbed-trailers',
  'flatbed trailers': 'flatbed-trailers',

  // Drop deck / step deck
  'drop-deck': 'drop-deck-trailers',
  'drop deck': 'drop-deck-trailers',
  'step-deck': 'step-deck-trailers',
  'step deck': 'step-deck-trailers',
  'stepdeck': 'step-deck-trailers',
  'double drop': 'double-drop-trailers',
  'double-drop': 'double-drop-trailers',

  // Lowboy
  'lowboy': 'lowboy-trailers',
  'lowboy-trailers': 'lowboy-trailers',
  'low boy': 'lowboy-trailers',
  'traveling axle': 'traveling-axle-trailers',

  // Dry van / enclosed
  'dry-van': 'dry-van-trailers',
  'dry van': 'dry-van-trailers',
  'enclosed': 'enclosed-trailers',
  'cargo trailer': 'cargo-trailers',
  'drop frame': 'drop-frame-trailers',

  // Reefer
  'reefer': 'reefer-trailers',
  'refrigerated': 'reefer-trailers',

  // Dump types
  'end dump': 'end-dump-trailers',
  'end-dump': 'end-dump-trailers',
  'side dump': 'side-dump-trailers',
  'side-dump': 'side-dump-trailers',
  'bottom dump': 'bottom-dump-trailers',
  'dump-trailers-end': 'end-dump-trailers',
  'dump-trailers-side': 'side-dump-trailers',
  'dump trailer': 'dump-trailers',
  'dump': 'dump-trailers',
  'belt trailer': 'belt-trailers',

  // Tank types
  'tank': 'tank-trailers',
  'tanker': 'tank-trailers',
  'pneumatic': 'pneumatic-trailers',
  'dry bulk': 'pneumatic-trailers',
  'fuel tank': 'fuel-tank-trailers',
  'petroleum': 'fuel-tank-trailers',
  'gasoline': 'fuel-tank-trailers',
  'food grade': 'food-tank-trailers',
  'sanitary': 'food-tank-trailers',
  'chemical': 'chemical-tank-trailers',
  'acid': 'chemical-tank-trailers',
  'water tank': 'water-tank-trailers',
  'vacuum': 'vacuum-tank-trailers',

  // Hopper / grain
  'hopper': 'hopper-trailers',
  'grain': 'grain-trailers',

  // Live floor / chip
  'live-floor': 'live-floor-trailers',
  'live floor': 'live-floor-trailers',
  'moving-floor': 'live-floor-trailers',
  'moving floor': 'live-floor-trailers',
  'chipper': 'chip-trailers',
  'chip': 'chip-trailers',
  'chipper-trailers': 'chip-trailers',

  // Livestock
  'livestock': 'livestock-trailers',
  'cattle': 'livestock-trailers',
  'horse': 'horse-trailers',

  // Car haulers
  'car hauler': 'car-hauler-trailers',
  'car carrier': 'car-hauler-trailers',
  'auto transport': 'car-hauler-trailers',

  // Curtain side
  'curtain': 'curtain-side-trailers',
  'curtain side': 'curtain-side-trailers',
  'tautliner': 'curtain-side-trailers',

  // Utility / light
  'utility': 'utility-trailers',
  'landscape': 'landscape-trailers',
  'tilt': 'tilt-trailers',
  'tilt deck': 'tilt-trailers',
  'gooseneck': 'gooseneck-trailers',
  'atv': 'atv-trailers',
  'motorcycle': 'atv-trailers',
  'boat': 'boat-trailers',

  // Logging / pole
  'log': 'log-trailers',
  'logging': 'log-trailers',
  'pole': 'pole-trailers',
  'tag': 'tag-trailers',

  // Other commercial
  'roll off': 'roll-off-trailers',
  'roll-off': 'roll-off-trailers',
  'refuse': 'refuse-trailers',
  'storage': 'storage-trailers',
  'intermodal': 'intermodal-containers',
  'container chassis': 'container-chassis',
  'chassis': 'container-chassis',
  'oilfield': 'oilfield-trailers',
  'oil field': 'oilfield-trailers',
  'frac': 'oilfield-trailers',

  // Yard tractors / spotters
  'yard-tractor': 'yard-spotter-trucks',
  'yard tractor': 'yard-spotter-trucks',
  'yard spotter': 'yard-spotter-trucks',
  'spotter': 'yard-spotter-trucks',

  // Default
  'default': 'specialty-trailers',
};

function getCategorySlug(text) {
  const normalized = text.toLowerCase().trim();
  for (const [key, slug] of Object.entries(CATEGORY_MAP)) {
    if (normalized.includes(key)) return slug;
  }
  return CATEGORY_MAP['default'];
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {
    pinnacle: { completed: [], imported: 0 },
    hale: { new: [], rental: [], used: [], imported: 0 },
  };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 30000,
    });
    return cheerio.load(response.data);
  } catch (error) {
    console.error(`  ✗ Failed: ${url} - ${error.message}`);
    return null;
  }
}

// ================== PINNACLE SCRAPER ==================

async function scrapePinnacleList(pageNum) {
  const url = pageNum === 1
    ? 'https://www.pinnacletrailers.com/trailers/'
    : `https://www.pinnacletrailers.com/trailers/page/${pageNum}/`;

  const $ = await fetchPage(url);
  if (!$) return [];

  const urls = [];
  $('a[href*="/trailers/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.match(/-pt\d+\/?$/i)) {
      const fullUrl = href.startsWith('http') ? href : `https://www.pinnacletrailers.com${href}`;
      if (!urls.includes(fullUrl)) urls.push(fullUrl);
    }
  });
  return urls;
}

async function scrapePinnacleDetail(url) {
  const $ = await fetchPage(url);
  if (!$) return null;

  try {
    const stockMatch = url.match(/pt(\d+)/i);
    const stockNumber = stockMatch ? `PT${stockMatch[1]}` : '';
    const title = $('h1').first().text().trim() || '';
    const parts = title.split('-');
    const year = parseInt(parts[0]) || null;
    const make = parts[1]?.trim() || 'Unknown';
    const model = parts.slice(2).join(' ').trim() || title;

    let vin = null;
    const vinMatch = $('body').text().match(/VIN[:#]?\s*([A-Z0-9]{17})/i);
    if (vinMatch) vin = vinMatch[1];

    const condition = $('body').text().toLowerCase().includes('used') ? 'used' : 'new';
    const categoryFromUrl = url.split('/').find(p => p.includes('-trailers')) || 'trailers';

    const images = [];
    // Look for product images - Pinnacle uses various patterns
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (!src) return;

      // Skip common non-product images
      if (src.includes('logo') || src.includes('icon') || src.includes('avatar') ||
          src.includes('placeholder') || src.includes('loading') || src.includes('spinner')) {
        return;
      }

      // Accept images from uploads folder or with product-like patterns
      if (src.includes('uploads/') || src.includes('wp-content/') ||
          src.toLowerCase().includes('pt') || src.includes('product') ||
          src.includes('gallery') || src.includes('trailer')) {
        const fullSrc = src.startsWith('http') ? src : `https://www.pinnacletrailers.com${src}`;
        if (!images.includes(fullSrc) && (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp'))) {
          images.push(fullSrc);
        }
      }
    });

    // Also check for gallery/slider images
    $('.gallery img, .slider img, .carousel img, .swiper img, .product-image img, [class*="gallery"] img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-large_image');
      if (src && !images.includes(src)) {
        const fullSrc = src.startsWith('http') ? src : `https://www.pinnacletrailers.com${src}`;
        images.push(fullSrc);
      }
    });

    // No fallback - we only want real images we can verify exist

    return {
      source: 'pinnacle',
      source_id: stockNumber,
      source_url: url,
      title: title.substring(0, 200),
      year, make, model, vin, condition,
      listing_type: 'sale',
      city: 'Marysville',
      state: 'WA',
      category_slug: getCategorySlug(categoryFromUrl),
      images: images.slice(0, 10),
    };
  } catch (e) {
    console.error(`  ✗ Parse error: ${url}`);
    return null;
  }
}

// ================== HALE SCRAPER ==================

async function scrapeHaleList(baseUrl, pageNum) {
  const url = pageNum === 1 ? baseUrl : `${baseUrl}page/${pageNum}/`;
  const $ = await fetchPage(url);
  if (!$) return [];

  const urls = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.match(/\/(trailer|rental|used)\/a\d+\/?$/i)) {
      const fullUrl = href.startsWith('http') ? href : `https://haletrailer.com${href}`;
      if (!urls.includes(fullUrl)) urls.push(fullUrl);
    }
  });
  return urls;
}

async function scrapeHaleDetail(url, listingType) {
  const $ = await fetchPage(url);
  if (!$) return null;

  try {
    const idMatch = url.match(/a(\d+)/i);
    const sourceId = idMatch ? `A${idMatch[1]}` : '';
    const title = $('h1').first().text().trim() || '';
    const parts = title.split(' ');
    const make = parts[0] || 'Unknown';
    const model = parts.slice(1).join(' ') || title;

    let year = null;
    const yearMatch = $('body').text().match(/Year[:\s]*(\d{4})/i);
    if (yearMatch) year = parseInt(yearMatch[1]);

    let vin = null;
    const vinMatch = $('body').text().match(/VIN[:#]?\s*([A-Z0-9]{17})/i);
    if (vinMatch) vin = vinMatch[1];

    let city = null, state = null;
    const locMatch = $('body').text().match(/([A-Za-z\s]+),\s*([A-Z]{2})\b/);
    if (locMatch) {
      city = locMatch[1].trim();
      state = locMatch[2];
    }

    const isUsed = url.includes('/used/');
    const condition = isUsed ? 'used' : 'new';

    const images = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && src.includes('trailerimages.haletrailer.com')) {
        if (!images.includes(src)) images.push(src);
      }
    });

    // No fallback - we only want real images we can verify exist

    return {
      source: 'hale',
      source_id: sourceId,
      source_url: url,
      title: title.substring(0, 200),
      year, make, model, vin, condition,
      listing_type: listingType,
      city, state,
      category_slug: getCategorySlug(title + ' ' + model),
      images: images.slice(0, 10),
    };
  } catch (e) {
    console.error(`  ✗ Parse error: ${url}`);
    return null;
  }
}

// ================== DATABASE ==================

async function getOrCreateDealer(name, email, phone, location) {
  // Check if exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', name)
    .single();

  if (existing) return existing.id;

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: Math.random().toString(36).slice(-16) + 'Aa1!',
    email_confirm: true,
  });

  if (authError) throw new Error(`Auth error: ${authError.message}`);

  // Update profile
  await supabase.from('profiles').update({
    company_name: name,
    phone,
    location,
    is_dealer: true,
  }).eq('id', authData.user.id);

  return authData.user.id;
}

const categoryCache = {};
async function getCategoryId(slug) {
  if (categoryCache[slug]) return categoryCache[slug];

  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single();

  if (data) categoryCache[slug] = data.id;
  return data?.id || null;
}

async function importListing(listing, dealerId) {
  // Skip listings without images - we only want listings where we captured images
  if (!listing.images || listing.images.length === 0) {
    console.log(`  ⏭ Skipping (no images): ${listing.title}`);
    return false;
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('listings')
    .select('id')
    .eq('vin', listing.source_id)
    .single();

  if (existing) return false;

  let categoryId = await getCategoryId(listing.category_slug);
  if (!categoryId) categoryId = await getCategoryId('specialty-trailers');
  if (!categoryId) {
    console.error(`  ✗ No category for: ${listing.category_slug}`);
    return false;
  }

  const { data: newListing, error } = await supabase
    .from('listings')
    .insert({
      user_id: dealerId,
      category_id: categoryId,
      title: listing.title,
      description: `${listing.year || ''} ${listing.make} ${listing.model}`.trim(),
      price: null,
      condition: listing.condition,
      listing_type: listing.listing_type,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      vin: listing.vin || listing.source_id,
      city: listing.city,
      state: listing.state,
      country: 'USA',
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  ✗ Insert error: ${error.message}`);
    return false;
  }

  // Add images
  if (listing.images.length > 0) {
    const imageInserts = listing.images.map((url, idx) => ({
      listing_id: newListing.id,
      url,
      thumbnail_url: url,
      sort_order: idx,
      is_primary: idx === 0,
    }));
    await supabase.from('listing_images').insert(imageInserts);
  }

  return true;
}

// ================== MAIN ==================

async function main() {
  const args = process.argv.slice(2);
  const doPinnacle = args.includes('--pinnacle') || (!args.includes('--hale'));
  const doHale = args.includes('--hale') || (!args.includes('--pinnacle'));

  const limitMatch = args.find(a => a.startsWith('--limit='));
  const pageLimit = limitMatch ? parseInt(limitMatch.split('=')[1]) : 50;

  console.log('🚀 Dealer Inventory Scraper');
  console.log(`   Page limit: ${pageLimit} pages per section`);
  console.log('='.repeat(50));

  const progress = loadProgress();

  // Setup dealers
  let pinnacleId, haleId;

  if (doPinnacle) {
    console.log('\n👤 Setting up Pinnacle Trailers dealer...');
    pinnacleId = await getOrCreateDealer(
      'Pinnacle Trailers',
      'inventory@pinnacletrailers.com',
      '(360) 659-1919',
      'Marysville, WA'
    );
    console.log(`   ✓ Dealer ID: ${pinnacleId}`);
  }

  if (doHale) {
    console.log('\n👤 Setting up Hale Trailer dealer...');
    haleId = await getOrCreateDealer(
      'Hale Trailer',
      'inventory@haletrailer.com',
      '(800) 274-4253',
      'Multiple Locations'
    );
    console.log(`   ✓ Dealer ID: ${haleId}`);
  }

  // Scrape Pinnacle
  if (doPinnacle && pinnacleId) {
    console.log('\n📦 Scraping Pinnacle Trailers...');
    let imported = 0;

    for (let page = 1; page <= pageLimit; page++) {
      if (progress.pinnacle.completed.includes(page)) {
        console.log(`   Page ${page}: skipped (done)`);
        continue;
      }

      console.log(`   Page ${page}/${pageLimit}...`);
      const urls = await scrapePinnacleList(page);

      if (urls.length === 0) {
        console.log(`   No more listings found, stopping.`);
        break;
      }

      for (const url of urls) {
        await sleep(RATE_LIMIT_MS);
        const listing = await scrapePinnacleDetail(url);
        if (listing) {
          const success = await importListing(listing, pinnacleId);
          if (success) {
            imported++;
            process.stdout.write(`\r   Imported: ${imported}`);
          }
        }
      }

      progress.pinnacle.completed.push(page);
      saveProgress(progress);
      console.log('');
    }

    progress.pinnacle.imported += imported;
    saveProgress(progress);
    console.log(`\n✅ Pinnacle: ${imported} new listings imported`);
  }

  // Scrape Hale
  if (doHale && haleId) {
    console.log('\n📦 Scraping Hale Trailer...');
    let imported = 0;

    const sections = [
      { name: 'New', url: 'https://haletrailer.com/trailer/', type: 'sale', progress: progress.hale.new },
      { name: 'Rental', url: 'https://haletrailer.com/rental/', type: 'rent', progress: progress.hale.rental },
      { name: 'Used', url: 'https://haletrailer.com/used/', type: 'sale', progress: progress.hale.used },
    ];

    for (const section of sections) {
      console.log(`\n   ${section.name} trailers...`);

      for (let page = 1; page <= pageLimit; page++) {
        if (section.progress.includes(page)) {
          console.log(`     Page ${page}: skipped (done)`);
          continue;
        }

        console.log(`     Page ${page}/${pageLimit}...`);
        const urls = await scrapeHaleList(section.url, page);

        if (urls.length === 0) {
          console.log(`     No more listings, stopping section.`);
          break;
        }

        for (const url of urls) {
          await sleep(RATE_LIMIT_MS);
          const listing = await scrapeHaleDetail(url, section.type);
          if (listing) {
            const success = await importListing(listing, haleId);
            if (success) {
              imported++;
              process.stdout.write(`\r     Imported: ${imported}`);
            }
          }
        }

        section.progress.push(page);
        saveProgress(progress);
        console.log('');
      }
    }

    progress.hale.imported += imported;
    saveProgress(progress);
    console.log(`\n✅ Hale: ${imported} new listings imported`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Pinnacle total: ${progress.pinnacle.imported}`);
  console.log(`   Hale total: ${progress.hale.imported}`);
  console.log('='.repeat(50));
}

main().catch(console.error);
