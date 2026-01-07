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

// Category mapping
const CATEGORY_MAP = {
  'flatbed': 'flatbed-trailers',
  'lowboy': 'lowboy-trailers',
  'dump': 'dump-trailers',
  'drop deck': 'drop-deck-trailers',
  'stepdeck': 'drop-deck-trailers',
  'reefer': 'reefer-trailers',
  'refrigerated': 'reefer-trailers',
  'dry van': 'dry-van-trailers',
  'van': 'dry-van-trailers',
  'grain': 'grain-trailers',
  'livestock': 'livestock-trailers',
  'tank': 'tank-trailers',
  'hopper': 'hopper-trailers',
  'curtain': 'curtain-side-trailers',
  'car hauler': 'car-carriers',
  'auto transport': 'car-carriers',
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const dealerCache = new Map();
const dealerCredentials = []; // Store credentials for outreach

async function getOrCreateDealer(dealerInfo) {
  const cacheKey = dealerInfo.name || 'TruckPaper Listing';

  if (dealerCache.has(cacheKey)) {
    return dealerCache.get(cacheKey);
  }

  // Try to find existing dealer
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('company_name', cacheKey)
    .single();

  if (existing) {
    dealerCache.set(cacheKey, existing.id);
    return existing.id;
  }

  // Create a real email-style login based on dealer name
  const cleanName = cacheKey.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  const email = `${cleanName}@dealers.axles.ai`;

  // Generate a memorable password
  const password = generatePassword();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (authError && !authError.message.includes('already been registered')) {
    // Use a default dealer for TruckPaper listings
    const { data: defaultDealer } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_name', 'TruckPaper Listings')
      .single();

    if (defaultDealer) {
      dealerCache.set(cacheKey, defaultDealer.id);
      return defaultDealer.id;
    }
    throw authError;
  }

  const userId = authUser?.user?.id;
  if (!userId) {
    throw new Error('Could not create dealer');
  }

  await supabase
    .from('profiles')
    .update({
      company_name: cacheKey,
      phone: dealerInfo.phone || '',
      website: dealerInfo.website || '',
      city: dealerInfo.city || '',
      state: dealerInfo.state || '',
      country: 'USA',
      is_dealer: true,
      is_verified: false,
    })
    .eq('id', userId);

  // Save credentials for outreach
  dealerCredentials.push({
    dealerName: cacheKey,
    contactPerson: dealerInfo.contactPerson || '',
    loginEmail: email,
    password,
    realEmail: dealerInfo.realEmail || '',
    phone: dealerInfo.phone || '',
    city: dealerInfo.city || '',
    state: dealerInfo.state || '',
    createdAt: new Date().toISOString(),
  });

  dealerCache.set(cacheKey, userId);
  return userId;
}

function generatePassword() {
  const adjectives = ['Fast', 'Strong', 'Blue', 'Red', 'Big', 'Smart', 'Cool', 'Pro'];
  const nouns = ['Truck', 'Trailer', 'Haul', 'Road', 'Fleet', 'Rig', 'Axle', 'Load'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}!`;
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

async function importListing(product) {
  const dealerId = await getOrCreateDealer({
    name: product.dealerName || 'TruckPaper Listing',
    contactPerson: product.contactPerson,
    city: product.city,
    state: product.state,
    phone: product.dealerPhone,
    realEmail: product.dealerEmail,
  });

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

async function scrapeListings(browser, page, startPage = 1) {
  const products = [];
  let pageNum = startPage;
  const maxPages = startPage + Math.ceil(MAX_LISTINGS / 25); // ~25 per page

  console.log(`   Starting from page ${startPage}, delay ${DELAY_MS}ms between pages`);

  while (products.length < MAX_LISTINGS && pageNum <= maxPages) {
    // Use the trailers-only URL
    const url = `${BASE_URL}/listings/trailers?page=${pageNum}`;

    console.log(`   Page ${pageNum}...`);

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
        console.log('     No more listings found');
        break;
      }

      console.log(`     Found ${pageProducts.length} listings`);
      products.push(...pageProducts);
      pageNum++;

      await sleep(1500);
    } catch (error) {
      console.error(`     Error: ${error.message}`);
      break;
    }
  }

  return products.slice(0, MAX_LISTINGS);
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
  console.log('🚛 TruckPaper TRAILER Scraper (Stealth)');
  console.log(`   Target: ~14,000 trailers on TruckPaper`);
  console.log(`   Limit: ${MAX_LISTINGS} listings this run`);
  console.log('==================================================\n');

  // Load progress from previous runs
  const progress = loadProgress();
  const startPage = START_PAGE > 1 ? START_PAGE : (progress.lastPage + 1) || 1;

  console.log(`📊 Progress: ${progress.totalScraped} listings scraped so far`);
  console.log(`   ${progress.dealers.length} unique dealers found`);
  console.log(`   Resuming from page ${startPage}\n`);

  console.log('   Launching stealth browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('   Scraping trailer listings...\n');
  let products = await scrapeListings(browser, page, startPage);

  console.log(`\n   Found ${products.length} listings this run`);

  // Check for rate limiting
  if (products.length === 0) {
    console.log('\n⚠️  No listings found - may be rate limited. Try again in 1 hour.');
    console.log('   Or increase delay: --delay=5000');
    await browser.close();
    return;
  }

  // Fetch dealer details from each listing page
  products = await fetchDealerDetails(page, products);

  await browser.close();

  // Calculate last page scraped
  const pagesScraped = Math.ceil(products.length / 28);
  const lastPageScraped = startPage + pagesScraped - 1;

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const product of products) {
    try {
      const result = await importListing(product);
      if (result.action === 'imported') {
        totalImported++;
        process.stdout.write(`   Imported: ${totalImported}\r`);
      } else if (result.action === 'skipped') {
        totalSkipped++;
      } else {
        totalErrors++;
      }
    } catch (e) {
      totalErrors++;
    }
  }

  console.log('\n\n==================================================');
  console.log(`📊 This Run:`);
  console.log(`   Imported: ${totalImported}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log(`   Errors: ${totalErrors}`);

  // Update and save progress
  const newProgress = {
    lastPage: lastPageScraped,
    totalScraped: progress.totalScraped + products.length,
    dealers: [...new Set([...progress.dealers, ...dealerCredentials.map(d => d.dealerName)])],
    lastRun: new Date().toISOString(),
  };
  saveProgress(newProgress);

  console.log('\n📈 Overall Progress:');
  console.log(`   Total scraped: ${newProgress.totalScraped} / ~14,000 trailers`);
  console.log(`   Unique dealers: ${newProgress.dealers.length}`);
  console.log(`   Last page: ${lastPageScraped}`);
  console.log(`   Progress: ${Math.round((newProgress.totalScraped / 14000) * 100)}%`);
  console.log('==================================================\n');

  // Save dealer credentials to CSV for outreach (append mode)
  if (dealerCredentials.length > 0) {
    const csvHeader = 'Dealer Name,Contact Person,Real Email,Phone,City,State,AxlesAI Login,Password\n';
    const csvRows = dealerCredentials.map(d =>
      `"${d.dealerName}","${d.contactPerson}","${d.realEmail}","${d.phone}","${d.city}","${d.state}","${d.loginEmail}","${d.password}"`
    ).join('\n');

    const filename = `truckpaper-dealers-${new Date().toISOString().split('T')[0]}.csv`;

    // Append to existing file or create new
    let existingContent = '';
    if (existsSync(filename)) {
      existingContent = readFileSync(filename, 'utf-8');
      // Remove header if appending
      writeFileSync(filename, existingContent + '\n' + csvRows);
    } else {
      writeFileSync(filename, csvHeader + csvRows);
    }

    console.log(`📧 Saved ${dealerCredentials.length} new dealer credentials to ${filename}`);

    // Count stats
    const withPhone = dealerCredentials.filter(d => d.phone).length;
    console.log(`   ${withPhone} have phone numbers`);
  }

  // Estimate remaining
  const remaining = 14000 - newProgress.totalScraped;
  const runsNeeded = Math.ceil(remaining / MAX_LISTINGS);
  if (remaining > 0) {
    console.log(`\n⏭️  Next: Run again in ~1 hour to continue (${runsNeeded} more runs needed)`);
  } else {
    console.log('\n✅ All trailers scraped!');
  }
}

main().catch(console.error);
