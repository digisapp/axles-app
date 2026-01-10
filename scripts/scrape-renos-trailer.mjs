// @ts-nocheck
/**
 * Scrape Reno's Trailer Sales
 * Belle Vernon, PA - Flatbeds, drop decks, lowboys, RGNs
 * Custom WordPress/WooCommerce site
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

puppeteer.use(StealthPlugin());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: "Reno's Trailer Sales",
  email: 'sales@renostrailer.com',
  phone: '(724) 929-7360',
  address: '102 Unity Lane',
  city: 'Belle Vernon',
  state: 'PA',
  zip: '15012',
  website: 'https://www.renostrailer.com',
  about: "Reno's Trailer Sales & Rental is a commercial semi-trailer dealership specializing in the open deck market - flatbeds, drop decks, lowboys, RGN's, and heavy haul trailers. Founded by Reno Luchini with 60+ years selling semi trailers, we've provided premium sales and service since 1991. We represent Fontaine, Transcraft, Benson and Talbert, stocking hundreds of new and used trailers with nationwide delivery available.",
};

const BASE_URL = 'https://www.renostrailer.com';

const CATEGORY_MAP = {
  'lowboy': 'lowboy-trailers',
  'rgn': 'lowboy-trailers',
  'double drop': 'lowboy-trailers',
  'drop deck': 'step-deck-trailers',
  'step deck': 'step-deck-trailers',
  'flatbed': 'flatbed-trailers',
  'tag': 'tag-trailers',
  'heavy haul': 'lowboy-trailers',
  'extendable': 'extendable-trailers',
  'stretch': 'extendable-trailers',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getOrCreateDealer() {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', DEALER_INFO.name)
    .single();

  if (existing) {
    console.log('Dealer exists:', DEALER_INFO.name);
    await supabase.from('profiles').update({
      phone: DEALER_INFO.phone,
      address: DEALER_INFO.address,
      city: DEALER_INFO.city,
      state: DEALER_INFO.state,
      zip_code: DEALER_INFO.zip,
      website: DEALER_INFO.website,
      about: DEALER_INFO.about,
      is_dealer: true,
    }).eq('id', existing.id);
    return existing.id;
  }

  const password = 'Renos2024!';
  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email: DEALER_INFO.email,
    email_confirm: true,
    password: password,
  });

  if (error) {
    console.error('Error creating dealer:', error.message);
    return null;
  }

  await supabase.from('profiles').update({
    company_name: DEALER_INFO.name,
    phone: DEALER_INFO.phone,
    address: DEALER_INFO.address,
    city: DEALER_INFO.city,
    state: DEALER_INFO.state,
    zip_code: DEALER_INFO.zip,
    website: DEALER_INFO.website,
    about: DEALER_INFO.about,
    is_dealer: true,
  }).eq('id', authUser.user.id);

  console.log('Created dealer:', DEALER_INFO.name);
  console.log('  Email:', DEALER_INFO.email);
  console.log('  Password:', password);
  return authUser.user.id;
}

async function getCategoryId(title) {
  const titleLower = title.toLowerCase();
  let categorySlug = 'flatbed-trailers'; // default for this dealer

  const sortedKeywords = Object.entries(CATEGORY_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, slug] of sortedKeywords) {
    if (titleLower.includes(keyword)) {
      categorySlug = slug;
      break;
    }
  }

  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (!cat) {
    const { data: fallback } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'trailers')
      .single();
    return fallback?.id;
  }

  return cat.id;
}

async function scrapeInventoryPage(page, url) {
  console.log(`\nScraping ${url}...`);
  const listings = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    // Scroll to load lazy images
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await sleep(300);
    }
    await sleep(2000);

    // Extract listings from Renos inventory grid
    const items = await page.evaluate(() => {
      const results = [];

      // Look for inventory trailer elements
      document.querySelectorAll('.inventory.trailer, .card-item, .item').forEach(el => {
        const linkEl = el.querySelector('a') || el.closest('a');
        const imgEl = el.querySelector('img');
        const titleEl = el.querySelector('h2, h3, h4, .title, [class*="title"], [class*="name"]');
        const priceEl = el.querySelector('.price, [class*="price"]');

        const href = linkEl?.href || '';
        if (!href || !href.includes('/product/')) return;

        const title = titleEl?.textContent?.trim() || '';

        // Get image
        let image = '';
        if (imgEl) {
          image = imgEl.currentSrc || imgEl.src || imgEl.getAttribute('data-src') ||
                  imgEl.getAttribute('data-lazy-src') || '';
        }

        // Skip logos and icons
        if (image && (image.includes('logo') || image.includes('icon') || image.includes('placeholder') || image.includes('svg'))) {
          image = '';
        }

        // Get price
        let price = null;
        if (priceEl) {
          const priceMatch = priceEl.textContent?.match(/\$([\d,]+)/);
          if (priceMatch) {
            price = parseFloat(priceMatch[1].replace(/,/g, ''));
          }
        }

        if (title && title.length > 5) {
          results.push({
            title,
            href,
            images: image ? [image] : [],
            price,
          });
        }
      });

      // Also try looking at all links to product pages
      if (results.length === 0) {
        document.querySelectorAll('a[href*="/product/"]').forEach(a => {
          const href = a.href;
          const title = a.textContent?.trim() || a.getAttribute('title') || '';
          const img = a.querySelector('img');
          let image = img?.src || img?.currentSrc || '';

          if (title && title.length > 5 && href.includes('/product/')) {
            results.push({
              title,
              href,
              images: image && !image.includes('svg') ? [image] : [],
              price: null,
            });
          }
        });
      }

      return results;
    });

    console.log(`  Found ${items.length} items`);
    listings.push(...items);

    // Check for pagination
    const hasNextPage = await page.evaluate(() => {
      const nextLink = document.querySelector('.next, [class*="next"], a[rel="next"]');
      return nextLink ? nextLink.href : null;
    });

    if (hasNextPage) {
      console.log('  Found next page, continuing...');
      await sleep(2000);
      const moreListings = await scrapeInventoryPage(page, hasNextPage);
      listings.push(...moreListings);
    }

  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }

  return listings;
}

async function scrapeDetailPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Scroll to load images
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await sleep(200);
    }

    const data = await page.evaluate(() => {
      // Get all images
      const images = [];
      document.querySelectorAll('img').forEach(img => {
        const src = img.currentSrc || img.src || img.getAttribute('data-src');
        if (src &&
            !src.includes('logo') &&
            !src.includes('icon') &&
            !src.includes('placeholder') &&
            !src.includes('avatar') &&
            (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp'))) {
          // Get full size
          const fullSrc = src.replace(/-\d+x\d+\./, '.').replace(/\?.*$/, '');
          if (!images.includes(fullSrc) && !images.includes(src)) {
            images.push(fullSrc);
          }
        }
      });

      // Get description
      const descEl = document.querySelector('.description, .product-description, [class*="description"], .entry-content');
      const description = descEl?.textContent?.trim().substring(0, 2000) || '';

      // Get price
      const priceEl = document.querySelector('.price, [class*="price"]');
      const priceMatch = priceEl?.textContent?.match(/\$([\d,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

      // Get specs
      const specs = {};
      document.querySelectorAll('tr, .spec-row, [class*="spec"]').forEach(row => {
        const cells = row.querySelectorAll('td, th, span');
        if (cells.length >= 2) {
          const key = cells[0].textContent?.trim();
          const val = cells[1].textContent?.trim();
          if (key && val) specs[key] = val;
        }
      });

      return { images, description, price, specs };
    });

    return data;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log("Scraping Reno's Trailer Sales");
  console.log('   Website: renostrailer.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Inventory pages to scrape
  const inventoryUrls = [
    BASE_URL + '/all-inventory/trailers/',
  ];

  let allListings = [];

  for (const url of inventoryUrls) {
    const listings = await scrapeInventoryPage(page, url);
    allListings.push(...listings);
  }

  // Dedupe by title
  const seen = new Set();
  allListings = allListings.filter(l => {
    const key = l.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\nTotal unique listings: ${allListings.length}\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < allListings.length; i++) {
    const listing = allListings[i];
    process.stdout.write(`[${i + 1}/${allListings.length}] `);
    process.stdout.write((listing.title?.substring(0, 35) || 'Unknown') + '... ');

    try {
      // Get more details from detail page
      if (listing.href) {
        await sleep(1500);
        const details = await scrapeDetailPage(page, listing.href);
        if (details) {
          if (details.images.length > listing.images.length) {
            listing.images = details.images;
          }
          if (details.description) listing.description = details.description;
          if (details.price) listing.price = details.price;
        }
      }

      if (!listing.title || listing.title.length < 5) {
        console.log('no title');
        skipped++;
        continue;
      }

      // Check for existing
      const { data: exists } = await supabase
        .from('listings')
        .select('id')
        .eq('title', listing.title)
        .eq('user_id', dealerId)
        .single();

      if (exists) {
        console.log('duplicate');
        skipped++;
        continue;
      }

      // Parse year from title
      const yearMatch = listing.title.match(/(19|20)\d{2}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;

      // Parse make from title
      const makes = ['FONTAINE', 'TRANSCRAFT', 'BENSON', 'TALBERT', 'DOONAN', 'WABASH',
                     'GREAT DANE', 'UTILITY', 'HYUNDAI', 'MANAC', 'EAST', 'XL SPECIALIZED'];
      let make = '';
      const titleUpper = listing.title.toUpperCase();
      for (const m of makes) {
        if (titleUpper.includes(m)) {
          make = m;
          break;
        }
      }

      const categoryId = await getCategoryId(listing.title);
      const condition = year && year >= 2024 ? 'new' : 'used';

      const { data: newListing, error } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: listing.title,
        description: listing.description || listing.title,
        price: listing.price,
        price_type: listing.price ? 'fixed' : 'contact',
        condition: condition,
        year: year,
        make: make,
        city: DEALER_INFO.city,
        state: DEALER_INFO.state,
        country: 'USA',
        status: 'active',
        listing_type: 'sale',
      }).select('id').single();

      if (error) {
        console.log('error: ' + error.message);
        errors++;
        continue;
      }

      // Insert images (max 10)
      if (listing.images && listing.images.length > 0) {
        for (let j = 0; j < Math.min(listing.images.length, 10); j++) {
          await supabase.from('listing_images').insert({
            listing_id: newListing.id,
            url: listing.images[j],
            is_primary: j === 0,
            sort_order: j,
          });
        }
      }

      imported++;
      const priceStr = listing.price ? `$${listing.price.toLocaleString()}` : 'Contact';
      console.log(`OK ${listing.images?.length || 0} imgs ${priceStr}`);
    } catch (e) {
      console.log('error: ' + (e.message?.substring(0, 40) || 'unknown'));
      errors++;
    }
  }

  await browser.close();

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Location: ' + DEALER_INFO.city + ', ' + DEALER_INFO.state);
  console.log('   Imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
