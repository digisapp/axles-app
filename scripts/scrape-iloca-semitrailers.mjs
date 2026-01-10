// @ts-nocheck
/**
 * Scrape ILoca Semitrailers
 * Aurora, IL (HQ) + Davenport, IA + Caledonia, WI
 * Fontaine, Kalyn Siebert, MAC Trailer, Dorsey, Vanguard, Manac, Talbert dealer
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
  name: 'ILoca Semitrailers',
  email: 'info@semitrailers.net',
  phone: '(855) 707-2910',
  address: '9S104 S Frontenac St',
  city: 'Aurora',
  state: 'IL',
  zip: '60504',
  website: 'https://semitrailers.net',
  about: 'ILoca Semitrailers is your full service semi-trailer dealer and Your Partner For The Long Haul. We offer a fleet of over 4,500 rental trailers for long-term lease or short-term rent. ILoca is a leading dealer for Vanguard Refrigerated, Dorsey, Fontaine, Fontaine Specialized, Kalyn Siebert, MAC Trailer, Manac, Talbert, Stoughton Chassis, and Vanguard. We have full-service locations in Aurora IL, Davenport IA, and Caledonia WI.',
};

const BASE_URL = 'https://semitrailers.net';

const CATEGORY_MAP = {
  'lowboy': 'lowboy-trailers',
  'heavy haul': 'lowboy-trailers',
  'double drop': 'lowboy-trailers',
  'drop deck': 'step-deck-trailers',
  'step deck': 'step-deck-trailers',
  'flatbed': 'flatbed-trailers',
  'reefer': 'reefer-trailers',
  'refrigerated': 'reefer-trailers',
  'dry van': 'dry-van-trailers',
  'dump': 'dump-trailers',
  'curtain': 'curtain-side-trailers',
  'extendable': 'extendable-trailers',
  'container': 'container-trailers',
  'intermodal': 'container-trailers',
  'chassis': 'chassis',
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

  const password = 'ILoca2024!';
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
  let categorySlug = 'trailers';

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

async function scrapeAllListings(page) {
  const allListings = [];

  console.log('\nLoading sales page with Algolia...');

  try {
    await page.goto(`${BASE_URL}/for-sale/`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(8000);  // Wait longer for Algolia to load

    // Scroll extensively to load all Algolia results
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await sleep(400);
    }
    await sleep(5000);

    // Extract listings from shop links (more reliable than Algolia hits)
    const listings = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Get all shop links with text content
      document.querySelectorAll('a[href*="/shop/"]').forEach(a => {
        const href = a.href;
        let title = a.textContent?.trim() || '';

        // Skip empty titles, "Add to Quote", or duplicates
        if (!title || title.length < 5 || title === 'Add to Quote' || seen.has(title)) return;

        // Skip if title doesn't look like a trailer listing
        if (!title.match(/\d{4}|FONTAINE|KALYN|DORSEY|MAC|MANAC|TALBERT|EAST|VANGUARD|ETNYRE|CIMC|FLATBED|LOWBOY|DROP|DECK|VAN|REEFER|DUMP/i)) return;

        seen.add(title);

        // Try to get image from parent container
        const parent = a.closest('.ais-Hits-item, .ais-hit, .link-container')?.parentElement;
        const imgEl = parent?.querySelector('img') || a.querySelector('img');
        let image = imgEl?.src || '';
        if (image && (image.includes('placeholder') || image.includes('woocommerce-placeholder'))) {
          image = '';
        }

        results.push({ title, href, images: image ? [image] : [], price: null });
      });

      return results;
    });

    console.log(`  Found ${listings.length} listings`);
    allListings.push(...listings);

  } catch (err) {
    console.log(`  Error: ${err.message.substring(0, 50)}`);
  }

  return allListings;
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
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-large_image');
        if (src &&
            !src.includes('logo') &&
            !src.includes('placeholder') &&
            !src.includes('woocommerce') &&
            !src.includes('icon') &&
            (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp'))) {
          const fullSrc = src.replace(/-\d+x\d+\./, '.');
          if (!images.includes(fullSrc) && !images.includes(src)) {
            images.push(fullSrc);
          }
        }
      });

      // Get description
      const descEl = document.querySelector('.description, .product-description, [class*="description"], .entry-content');
      const description = descEl?.textContent?.trim().substring(0, 2000) || '';

      // Get specs
      const specs = {};
      document.querySelectorAll('tr, .spec-row, [class*="attribute"]').forEach(row => {
        const label = row.querySelector('th, .label, td:first-child')?.textContent?.trim();
        const value = row.querySelector('td:last-child, .value')?.textContent?.trim();
        if (label && value && label !== value) {
          specs[label] = value;
        }
      });

      return { images, description, specs };
    });

    return data;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('Scraping ILoca Semitrailers');
  console.log('   Website: semitrailers.net');
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

  let allListings = await scrapeAllListings(page);

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
    process.stdout.write(`[${i + 1}/${allListings.length}] ${(listing.title?.substring(0, 40) || 'Unknown')}... `);

    try {
      // Get more details from detail page if we have a URL
      if (listing.href && listing.href.includes('/shop/')) {
        await sleep(1500);
        const details = await scrapeDetailPage(page, listing.href);
        if (details) {
          if (details.images.length > listing.images.length) {
            listing.images = details.images;
          }
          if (details.description) listing.description = details.description;
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
      const yearMatch = listing.title.match(/^(20\d{2})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;

      // Parse make from title
      const makes = ['FONTAINE', 'KALYN SIEBERT', 'MAC TRAILER', 'DORSEY', 'VANGUARD', 'MANAC',
                     'TALBERT', 'CIMC', 'EAST', 'ETNYRE', 'STOUGHTON'];
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
      console.log(`OK ${listing.images?.length || 0} imgs`);
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
