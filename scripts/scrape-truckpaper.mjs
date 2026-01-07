// @ts-nocheck
/**
 * TruckPaper Trailer Scraper (Puppeteer Stealth)
 * Scrapes TRAILERS ONLY from truckpaper.com - major marketplace (~14,000 trailers)
 *
 * Usage:
 *   node scripts/scrape-truckpaper.mjs [--limit=200] [--start=1] [--delay=3000]
 *
 * Options:
 *   --limit=N    Max listings to scrape (default: 200)
 *   --start=N    Start from page N (default: 1, or resume from progress file)
 *   --delay=N    Delay between requests in ms (default: 3000, increase if rate limited)
 *
 * Progress is saved to truckpaper-progress.json - run again to continue
 * Dealer credentials saved to truckpaper-dealers-YYYY-MM-DD.csv
 *
 * To scrape all ~14,000 trailers, run in batches:
 *   Run 1: node scripts/scrape-truckpaper.mjs --limit=500
 *   (wait 1 hour)
 *   Run 2: node scripts/scrape-truckpaper.mjs --limit=500
 *   ... repeat until done
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import 'dotenv/config';

puppeteer.use(StealthPlugin());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = 'https://www.truckpaper.com';
const MAX_LISTINGS = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '200');
const START_PAGE = parseInt(process.argv.find(a => a.startsWith('--start='))?.split('=')[1] || '1');
const DELAY_MS = parseInt(process.argv.find(a => a.startsWith('--delay='))?.split('=')[1] || '3000');
const PROGRESS_FILE = 'truckpaper-progress.json';

// TruckPaper category URLs mapped to our category slugs
const TRUCKPAPER_CATEGORIES = [
  // Semi-Trailers (commercial)
  { url: '/listings/trailers/semi-trailers/dump-trailers', slug: 'dump-trailers', name: 'Dump Semi-Trailers' },
  { url: '/listings/trailers/semi-trailers/dry-van-trailers', slug: 'dry-van-trailers', name: 'Dry Van Trailers' },
  { url: '/listings/trailers/semi-trailers/reefer-trailers', slug: 'reefer-trailers', name: 'Reefer Trailers' },
  { url: '/listings/trailers/semi-trailers/flatbed-trailers', slug: 'flatbed-trailers', name: 'Flatbed Trailers' },
  { url: '/listings/trailers/semi-trailers/lowboy-trailers', slug: 'lowboy-trailers', name: 'Lowboy Trailers' },
  { url: '/listings/trailers/semi-trailers/drop-deck-trailers', slug: 'drop-deck-trailers', name: 'Drop Deck Trailers' },
  { url: '/listings/trailers/semi-trailers/tank-trailers', slug: 'tank-trailers', name: 'Tank Trailers' },
  { url: '/listings/trailers/semi-trailers/hopper-grain-trailers', slug: 'hopper-trailers', name: 'Hopper/Grain Trailers' },
  { url: '/listings/trailers/semi-trailers/livestock-trailers', slug: 'livestock-trailers', name: 'Livestock Trailers' },
  { url: '/listings/trailers/semi-trailers/car-carrier-trailers', slug: 'car-hauler-trailers', name: 'Car Carrier Trailers' },
  { url: '/listings/trailers/semi-trailers/curtain-side-roll-tarp-trailers', slug: 'curtain-side-trailers', name: 'Curtain Side Trailers' },
  { url: '/listings/trailers/semi-trailers/double-drop-trailers', slug: 'double-drop-trailers', name: 'Double Drop Trailers' },
  { url: '/listings/trailers/semi-trailers/live-floor-trailers', slug: 'live-floor-trailers', name: 'Live Floor Trailers' },
  { url: '/listings/trailers/semi-trailers/log-trailers', slug: 'log-trailers', name: 'Log Trailers' },
  { url: '/listings/trailers/semi-trailers/belt-trailers', slug: 'belt-trailers', name: 'Belt Trailers' },
  { url: '/listings/trailers/semi-trailers/chipper-trailers', slug: 'chip-trailers', name: 'Chipper Trailers' },
  { url: '/listings/trailers/semi-trailers/tag-trailers', slug: 'tag-trailers', name: 'Tag Trailers' },
  { url: '/listings/trailers/semi-trailers/traveling-axle-trailers', slug: 'traveling-axle-trailers', name: 'Traveling Axle Trailers' },
  { url: '/listings/trailers/semi-trailers/intermodal-container-chassis-only', slug: 'container-chassis', name: 'Container Chassis' },
  { url: '/listings/trailers/semi-trailers/storage-trailers', slug: 'storage-trailers', name: 'Storage Trailers' },
  { url: '/listings/trailers/semi-trailers/oil-field-trailers', slug: 'oilfield-trailers', name: 'Oil Field Trailers' },

  // Light Trailers
  { url: '/listings/trailers/trailers/flatbed-tag-trailers', slug: 'tag-trailers', name: 'Flatbed/Tag Trailers' },
  { url: '/listings/trailers/trailers/utility-trailers', slug: 'utility-trailers', name: 'Utility Trailers' },
  { url: '/listings/trailers/trailers/cargo-enclosed-trailers', slug: 'enclosed-trailers', name: 'Enclosed Trailers' },
  { url: '/listings/trailers/trailers/dump-trailers', slug: 'dump-trailers', name: 'Dump Trailers' },
  { url: '/listings/trailers/trailers/car-hauler-trailers', slug: 'car-hauler-trailers', name: 'Car Hauler Trailers' },
  { url: '/listings/trailers/trailers/horse-trailers', slug: 'horse-trailers', name: 'Horse Trailers' },
  { url: '/listings/trailers/trailers/tilt-trailers', slug: 'tilt-trailers', name: 'Tilt Trailers' },
  { url: '/listings/trailers/trailers/landscaping-trailers', slug: 'landscape-trailers', name: 'Landscape Trailers' },

  // Trucks
  { url: '/listings/trucks/sleeper-trucks', slug: 'sleeper-trucks', name: 'Sleeper Trucks' },
  { url: '/listings/trucks/day-cab-trucks', slug: 'day-cab-trucks', name: 'Day Cab Trucks' },
  { url: '/listings/trucks/dump-trucks', slug: 'dump-trucks', name: 'Dump Trucks' },
  { url: '/listings/trucks/box-trucks', slug: 'box-trucks', name: 'Box Trucks' },
  { url: '/listings/trucks/tow-trucks', slug: 'tow-trucks', name: 'Tow Trucks' },
  { url: '/listings/trucks/cab-chassis-trucks', slug: 'cab-chassis', name: 'Cab & Chassis' },
  { url: '/listings/trucks/service-trucks-utility-trucks-mechanic-trucks', slug: 'service-trucks', name: 'Service/Utility Trucks' },
  { url: '/listings/trucks/flatbed-trucks', slug: 'flatbed-trucks', name: 'Flatbed Trucks' },
  { url: '/listings/trucks/tanker-trucks', slug: 'tanker-trucks', name: 'Tanker Trucks' },
  { url: '/listings/trucks/garbage-trucks', slug: 'garbage-trucks', name: 'Garbage Trucks' },
  { url: '/listings/trucks/concrete-mixer-trucks', slug: 'concrete-trucks', name: 'Mixer Trucks' },
  { url: '/listings/trucks/bucket-trucks-service-trucks', slug: 'bucket-trucks', name: 'Bucket Trucks' },
  { url: '/listings/trucks/yard-spotter-trucks', slug: 'yard-spotter-trucks', name: 'Yard Spotter Trucks' },
  { url: '/listings/trucks/winch-oil-field-trucks', slug: 'winch-trucks', name: 'Winch/Oil Field Trucks' },
];

// Load existing progress
function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch (e) {
      return { lastPage: 0, totalScraped: 0, dealers: [] };
    }
  }
  return { lastPage: 0, totalScraped: 0, dealers: [] };
}

// Save progress
function saveProgress(data) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let truckpaperDealerId = null;

async function getOrCreateTruckPaperDealer() {
  if (truckpaperDealerId) return truckpaperDealerId;

  // Try to find existing TruckPaper dealer
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', 'TruckPaper Listings')
    .single();

  if (existing) {
    truckpaperDealerId = existing.id;
    return truckpaperDealerId;
  }

  // Create the TruckPaper dealer account
  const email = 'truckpaper@dealers.axles.ai';
  const password = 'TruckPaper2024!';

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (authError && !authError.message.includes('already been registered')) {
    throw new Error(`Could not create TruckPaper dealer: ${authError.message}`);
  }

  const userId = authUser?.user?.id;
  if (userId) {
    await supabase
      .from('profiles')
      .update({
        company_name: 'TruckPaper Listings',
        phone: '',
        website: 'https://www.truckpaper.com',
        city: '',
        state: '',
        country: 'USA',
        is_dealer: true,
        is_verified: false,
      })
      .eq('id', userId);

    truckpaperDealerId = userId;
    return truckpaperDealerId;
  }

  // If user exists but we couldn't get their ID, look them up
  const { data: existingByEmail } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (existingByEmail) {
    truckpaperDealerId = existingByEmail.id;
    return truckpaperDealerId;
  }

  throw new Error('Could not create TruckPaper dealer');
}


// Cache for category IDs
const categoryIdCache = new Map();

async function getCategoryId(slug) {
  if (categoryIdCache.has(slug)) {
    return categoryIdCache.get(slug);
  }

  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single();

  if (data) {
    categoryIdCache.set(slug, data.id);
    return data.id;
  }

  // Fallback to trailers or specialty-trailers
  const { data: fallback } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'specialty-trailers')
    .single();

  if (fallback) {
    categoryIdCache.set(slug, fallback.id);
    return fallback.id;
  }

  const { data: trailers } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'trailers')
    .single();

  categoryIdCache.set(slug, trailers?.id);
  return trailers?.id;
}

async function importListing(product) {
  // Skip listings without images - we only want listings where we captured images
  const hasImages = (product.images && product.images.length > 0) || product.imageUrl;
  if (!hasImages) {
    console.log(`  ⏭ Skipping (no images): ${product.title}`);
    return { action: 'skipped_no_images' };
  }

  const dealerId = await getOrCreateTruckPaperDealer();

  // Check for duplicate by title and dealer
  const { data: existing } = await supabase
    .from('listings')
    .select('id')
    .eq('user_id', dealerId)
    .eq('title', product.title)
    .single();

  if (existing) {
    return { action: 'skipped', id: existing.id };
  }

  const categoryId = await getCategoryId(product.categorySlug || 'specialty-trailers');

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      user_id: dealerId,
      category_id: categoryId,
      title: product.title,
      description: product.description || product.title,
      price: product.price,
      price_type: product.price ? 'fixed' : 'contact',
      condition: product.condition || 'used',
      year: product.year,
      make: product.make || '',
      model: product.model || '',
      stock_number: product.stockNumber,
      city: product.city || '',
      state: product.state || '',
      country: 'USA',
      status: 'active',
      listing_type: 'sale',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error inserting: ${error.message}`);
    return { action: 'error', error };
  }

  // Import images - use detail page images, fall back to listing page thumbnail
  let images = product.images || [];
  if (images.length === 0 && product.imageUrl) {
    images = [product.imageUrl];
  }

  for (let i = 0; i < Math.min(images.length, 10); i++) {
    // Skip invalid URLs
    if (!images[i] || !images[i].startsWith('http')) continue;

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

async function scrapeListings(browser, page, categoryUrl, categorySlug, categoryName) {
  const products = [];
  let pageNum = 1;
  const maxPages = 5; // Limit pages per category to avoid rate limiting

  console.log(`\n   📦 ${categoryName}...`);

  while (products.length < 50 && pageNum <= maxPages) { // Max 50 per category
    const url = `${BASE_URL}${categoryUrl}?page=${pageNum}`;

    console.log(`      Page ${pageNum}...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(DELAY_MS); // Use configurable delay

      const pageProducts = await page.evaluate((baseUrl) => {
        const items = [];

        // TruckPaper listing cards
        const listings = document.querySelectorAll('[data-listing-id], .listing-card, .search-result-item, [class*="ListingCard"]');

        listings.forEach(listing => {
          try {
            // Title
            const titleEl = listing.querySelector('h2 a, h3 a, [class*="title"] a, a[href*="/listing/"]');
            const title = titleEl?.textContent?.trim() || '';
            if (!title) return;

            // URL
            const detailUrl = titleEl?.getAttribute('href') || '';

            // Image - TruckPaper uses media.sandhills.com
            const imgEl = listing.querySelector('img[src*="sandhills"], img[src*="media."], img');
            const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy') || '';

            // Price
            const priceEl = listing.querySelector('[class*="price"], .price');
            const priceText = priceEl?.textContent?.trim() || '';
            const priceMatch = priceText.match(/[\d,]+/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : null;

            // Location
            const locationEl = listing.querySelector('[class*="location"], .location');
            const locationText = locationEl?.textContent?.trim() || '';
            const locationParts = locationText.split(',').map(s => s.trim());
            const city = locationParts[0] || '';
            const state = locationParts[1]?.substring(0, 2) || '';

            // Dealer
            const dealerEl = listing.querySelector('[class*="dealer"], .dealer-name, [class*="seller"]');
            const dealerName = dealerEl?.textContent?.trim() || '';

            // Year/Make/Model from title
            const yearMatch = title.match(/^(\d{4})\s/);
            const year = yearMatch ? parseInt(yearMatch[1]) : null;

            const titleParts = title.replace(/^\d{4}\s+/, '').split(/\s+/);
            const make = titleParts[0] || '';
            const model = titleParts.slice(1).join(' ') || '';

            // Condition
            const condition = title.toLowerCase().includes('new') ? 'new' : 'used';

            items.push({
              title,
              detailUrl: detailUrl.startsWith('http') ? detailUrl : `${baseUrl}${detailUrl}`,
              imageUrl,
              price: price > 100 ? price : null,
              city,
              state,
              dealerName,
              year,
              make,
              model,
              condition,
            });
          } catch (e) {
            // Skip problematic listing
          }
        });

        return items;
      }, BASE_URL);

      if (pageProducts.length === 0) {
        console.log('        No more listings found');
        break;
      }

      // Add category slug to each product
      pageProducts.forEach(p => p.categorySlug = categorySlug);

      console.log(`        Found ${pageProducts.length} listings`);
      products.push(...pageProducts);
      pageNum++;

      await sleep(1500);
    } catch (error) {
      console.error(`        Error: ${error.message}`);
      break;
    }
  }

  console.log(`      ✓ ${products.length} listings from ${categoryName}`);
  return products;
}

async function fetchDealerDetails(page, products) {
  console.log('\n   Fetching dealer details from listing pages...');

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (!product.detailUrl) continue;

    try {
      await page.goto(product.detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(1500);

      const details = await page.evaluate(() => {
        // Get all images - TruckPaper uses media.sandhills.com for images
        const images = [];
        document.querySelectorAll('img[src*="sandhills"], img[src*="media."], img[src*="photo"], img[src*="image"], .gallery img, [class*="carousel"] img, [class*="slider"] img, [class*="photo"] img').forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy');
          if (src && !images.includes(src) && !src.includes('logo') && !src.includes('icon') && !src.includes('placeholder') && src.includes('http')) {
            images.push(src);
          }
        });

        let dealerName = '';
        let dealerPhone = '';
        let dealerEmail = '';
        let contactPerson = '';
        let dealerCity = '';
        let dealerState = '';

        // Get page text as lines for pattern matching
        const pageText = document.body.innerText || '';
        const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);

        // Find seller info section - look for pattern:
        // "Seller Information" -> "View Seller Information" -> "Company Name" -> "Contact:Name"
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === 'Seller Information' || lines[i].includes('View Seller Information')) {
            // Next non-empty lines should have company name and contact
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
              const line = lines[j];

              // Skip navigation/button text
              if (line.includes('View Seller') || line === 'Seller Information') continue;

              // Contact person
              if (line.startsWith('Contact:')) {
                contactPerson = line.replace('Contact:', '').trim();
                continue;
              }

              // Phone line (just "Phone:" text, actual number is in link)
              if (line === 'Phone:') continue;

              // Company name - should be a short line that looks like a business name
              if (!dealerName && line.length > 3 && line.length < 100 &&
                  !line.includes('Phone') && !line.includes('Contact') &&
                  !line.includes('Email') && !line.includes('View') &&
                  !line.includes('Location') && !line.includes('USD')) {
                dealerName = line;
              }
            }
            break;
          }
        }

        // Get phone from tel: links
        const phoneLink = document.querySelector('a[href^="tel:"]');
        if (phoneLink) {
          const href = phoneLink.getAttribute('href') || '';
          const phoneNum = href.replace('tel:', '').replace('+1', '');
          if (phoneNum.length >= 10) {
            const digits = phoneNum.replace(/\D/g, '');
            if (digits.length === 10) {
              dealerPhone = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
            } else if (digits.length === 11 && digits.startsWith('1')) {
              dealerPhone = `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
            }
          }
        }

        // Get email from mailto: links
        const emailLink = document.querySelector('a[href^="mailto:"]');
        if (emailLink) {
          dealerEmail = emailLink.getAttribute('href')?.replace('mailto:', '') || '';
        }

        // Get location from "Truck Location:" text
        const locationMatch = pageText.match(/(?:Truck |Equipment )?Location[:\s]*([^,]+),\s*([A-Za-z]+)\s+(\d{5})/);
        if (locationMatch) {
          // Extract city from address (last word before comma)
          const addressPart = locationMatch[1].trim();
          const addressWords = addressPart.split(/\s+/);
          dealerCity = addressWords[addressWords.length - 1] || '';
          dealerState = locationMatch[2].substring(0, 2).toUpperCase();
        }

        // Get VIN
        const vinMatch = pageText.match(/VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i);
        const vin = vinMatch ? vinMatch[1] : '';

        // Get stock number
        const stockMatch = pageText.match(/Stock[#:\s]*([A-Z0-9-]+)/i);
        const stockNumber = stockMatch ? stockMatch[1] : '';

        return {
          images,
          dealerName,
          dealerPhone,
          dealerEmail,
          contactPerson,
          dealerCity,
          dealerState,
          vin,
          stockNumber,
        };
      });

      // Update product with details
      if (details.dealerName) product.dealerName = details.dealerName;
      if (details.dealerPhone) product.dealerPhone = details.dealerPhone;
      if (details.dealerEmail) product.dealerEmail = details.dealerEmail;
      if (details.contactPerson) product.contactPerson = details.contactPerson;
      if (details.dealerCity) product.city = details.dealerCity;
      if (details.dealerState) product.state = details.dealerState;
      if (details.vin) product.vin = details.vin;
      if (details.stockNumber) product.stockNumber = details.stockNumber;
      if (details.images.length > 0) product.images = details.images;

      process.stdout.write(`   Details: ${i + 1}/${products.length} - ${product.dealerName || 'Unknown'}                    \r`);

    } catch (e) {
      // Continue on error
    }
  }

  console.log('\n');
  return products;
}

async function main() {
  console.log('🚛 TruckPaper Category Scraper (Stealth)');
  console.log(`   Categories: ${TRUCKPAPER_CATEGORIES.length} categories to scrape`);
  console.log(`   Max per category: 50 listings, ${MAX_LISTINGS} total`);
  console.log('==================================================\n');

  // Load progress from previous runs
  const progress = loadProgress();

  console.log(`📊 Progress: ${progress.totalScraped || 0} listings scraped so far`);
  console.log(`   ${progress.dealers?.length || 0} unique dealers found\n`);

  console.log('   Launching stealth browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let allProducts = [];
  const completedCategories = progress.completedCategories || [];

  console.log('\n   Scraping by category...');

  for (const category of TRUCKPAPER_CATEGORIES) {
    // Skip already completed categories
    if (completedCategories.includes(category.slug)) {
      console.log(`   ⏭ Skipping ${category.name} (already done)`);
      continue;
    }

    // Stop if we have enough
    if (allProducts.length >= MAX_LISTINGS) {
      console.log(`\n   ⏸ Reached limit of ${MAX_LISTINGS} listings`);
      break;
    }

    try {
      const categoryProducts = await scrapeListings(browser, page, category.url, category.slug, category.name);
      allProducts.push(...categoryProducts);

      // Mark category as completed
      completedCategories.push(category.slug);

      // Wait between categories to avoid rate limiting
      await sleep(2000);
    } catch (error) {
      console.error(`   ✗ Error scraping ${category.name}: ${error.message}`);
    }
  }

  console.log(`\n   Found ${allProducts.length} total listings across categories`);

  // Check for rate limiting
  if (allProducts.length === 0) {
    console.log('\n⚠️  No listings found - may be rate limited. Try again in 1 hour.');
    console.log('   Or increase delay: --delay=5000');
    await browser.close();
    return;
  }

  // Fetch dealer details (limit to first 100 to avoid rate limiting)
  const productsToFetch = allProducts.slice(0, 100);
  let products = await fetchDealerDetails(page, productsToFetch);

  await browser.close();

  let totalImported = 0;
  let totalSkipped = 0;
  let totalSkippedNoImages = 0;
  let totalErrors = 0;

  console.log('\n   Importing listings...');
  for (const product of products) {
    try {
      const result = await importListing(product);
      if (result.action === 'imported') {
        totalImported++;
        process.stdout.write(`   Imported: ${totalImported}\r`);
      } else if (result.action === 'skipped') {
        totalSkipped++;
      } else if (result.action === 'skipped_no_images') {
        totalSkippedNoImages++;
      } else if (result.action === 'error') {
        totalErrors++;
        console.error(`   ✗ Error: ${result.error?.message || 'Unknown'}`);
      } else {
        totalErrors++;
      }
    } catch (e) {
      totalErrors++;
      console.error(`   ✗ Exception: ${e.message}`);
    }
  }

  console.log('\n\n==================================================');
  console.log(`📊 This Run:`);
  console.log(`   Imported: ${totalImported}`);
  console.log(`   Skipped (duplicates): ${totalSkipped}`);
  console.log(`   Skipped (no images): ${totalSkippedNoImages}`);
  console.log(`   Errors: ${totalErrors}`);

  // Update and save progress
  const newProgress = {
    completedCategories,
    totalScraped: (progress.totalScraped || 0) + products.length,
    totalImported: (progress.totalImported || 0) + totalImported,
    lastRun: new Date().toISOString(),
  };
  saveProgress(newProgress);

  console.log('\n📈 Overall Progress:');
  console.log(`   Categories completed: ${completedCategories.length}/${TRUCKPAPER_CATEGORIES.length}`);
  console.log(`   Total scraped: ${newProgress.totalScraped}`);
  console.log(`   Total imported: ${newProgress.totalImported}`);
  console.log('==================================================\n');

  // Show remaining categories
  const remainingCategories = TRUCKPAPER_CATEGORIES.length - completedCategories.length;
  if (remainingCategories > 0) {
    console.log(`\n⏭️  ${remainingCategories} categories remaining. Run again to continue.`);
  } else {
    console.log('\n✅ All categories scraped!');
  }
}

main().catch(console.error);
