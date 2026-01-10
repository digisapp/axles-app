// @ts-nocheck
/**
 * Scrape Joseph Equipment Co
 * Manchester, NH - Trucks, trailers, heavy equipment
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
  name: 'Joseph Equipment Co',
  email: 'josephequipment@aol.com',
  phone: '(603) 641-8608',
  address: '300 Gay St.',
  city: 'Manchester',
  state: 'NH',
  zip: '03103',
  website: 'https://www.josephequipment.com',
  about: 'Joseph Equipment is an authorized Terex dealer specializing in off-road trucks and heavy equipment. We are also an authorized distributor for Fontaine Specialized heavy equipment lowbed trailers, Rogers heavy equipment lowbed trailers, Ravens steel and aluminum dump trailers, and Kruz aluminum and steel dump trailers. We specialize in the sale of construction, mining, heavy haul and transportation equipment with a large inventory of used construction equipment. Services include financing, equipment storage, and worldwide freight.',
};

const BASE_URL = 'https://www.josephequipment.com';

const CATEGORY_MAP = {
  'lowboy': 'lowboy-trailers',
  'lowbed': 'lowboy-trailers',
  'dump': 'dump-trucks',
  'dump trailer': 'end-dump-trailers',
  'flatbed': 'flatbed-trailers',
  'crane': 'cranes',
  'loader': 'loaders',
  'excavator': 'excavators',
  'dozer': 'dozers',
  'truck': 'trucks',
  'tractor': 'trucks',
  'trailer': 'trailers',
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

  const password = 'Joseph2024!';
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
  let categorySlug = 'trucks'; // default

  // Check for trailer first
  if (titleLower.includes('trailer')) {
    if (titleLower.includes('dump')) {
      categorySlug = 'end-dump-trailers';
    } else if (titleLower.includes('lowboy') || titleLower.includes('lowbed')) {
      categorySlug = 'lowboy-trailers';
    } else if (titleLower.includes('flatbed')) {
      categorySlug = 'flatbed-trailers';
    } else {
      categorySlug = 'trailers';
    }
  } else {
    const sortedKeywords = Object.entries(CATEGORY_MAP).sort((a, b) => b[0].length - a[0].length);
    for (const [keyword, slug] of sortedKeywords) {
      if (titleLower.includes(keyword)) {
        categorySlug = slug;
        break;
      }
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
      .eq('slug', 'trucks')
      .single();
    return fallback?.id;
  }

  return cat.id;
}

async function scrapeSandhillsPage(page, url, type) {
  console.log(`\nScraping ${type}...`);
  const listings = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    // Scroll to load lazy images
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await sleep(300);
    }
    await sleep(2000);

    // Extract listings from Sandhills grid
    const items = await page.evaluate(() => {
      const results = [];

      // Find listing cards/containers
      document.querySelectorAll('[class*="listing"], [class*="result"], [class*="item"], [class*="card"]').forEach(card => {
        const linkEl = card.querySelector('a[href*="/listing/"]');
        const imgEl = card.querySelector('img');
        const titleEl = card.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');
        const priceEl = card.querySelector('[class*="price"]');

        if (linkEl || titleEl) {
          const title = titleEl?.textContent?.trim() || '';
          const href = linkEl?.href || '';

          // Get image
          let image = '';
          if (imgEl) {
            image = imgEl.currentSrc || imgEl.src || imgEl.getAttribute('data-src') || '';
          }

          // Skip logos and icons
          if (image && (image.includes('logo') || image.includes('icon') || image.includes('placeholder'))) {
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

          // Only keep titles that have a type suffix (Trucks, Trailers, etc) to avoid duplicates
          const hasTypeSuffix = title.includes(' Trucks') || title.includes(' Trailers') ||
                                title.includes(' Attachments') || title.includes(' Loaders') ||
                                title.includes(' Excavators') || title.includes(' Dozers') ||
                                title.includes(' Cranes') || title.includes(' Equipment');

          if (title && title.length > 10 && hasTypeSuffix) {
            results.push({
              title,
              href,
              images: image ? [image] : [],
              price,
            });
          }
        }
      });

      return results;
    });

    console.log(`  Found ${items.length} items`);
    listings.push(...items);

  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }

  return listings;
}

async function scrapeInventoryPage(page, url, type) {
  console.log(`\nScraping ${type} from ${url}...`);
  const listings = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    // Scroll to load content
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await sleep(300);
    }
    await sleep(2000);

    // Extract listings from the page
    const items = await page.evaluate(() => {
      const results = [];

      // Look for table rows or listing containers
      // This site likely uses tables or simple HTML
      const tables = document.querySelectorAll('table');

      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          const text = row.textContent || '';

          // Look for rows that contain equipment info (year, price patterns)
          if (text.match(/\d{4}/) && (text.match(/\$[\d,]+/) || text.toLowerCase().includes('call'))) {
            const images = [];
            row.querySelectorAll('img').forEach(img => {
              const src = img.src || img.getAttribute('data-src');
              if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('spacer')) {
                images.push(src);
              }
            });

            // Try to find a link
            const link = row.querySelector('a[href]');
            const href = link?.href || '';

            // Extract title from first meaningful cell or link
            let title = link?.textContent?.trim() || '';
            if (!title) {
              for (const cell of cells) {
                const cellText = cell.textContent?.trim();
                if (cellText && cellText.length > 10 && cellText.match(/\d{4}/)) {
                  title = cellText;
                  break;
                }
              }
            }

            // Extract price
            const priceMatch = text.match(/\$[\d,]+/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : null;

            if (title && title.length > 5) {
              results.push({ title, price, images, href });
            }
          }
        });
      });

      // Also look for div-based listings
      document.querySelectorAll('[class*="listing"], [class*="product"], [class*="item"], article').forEach(el => {
        const title = el.querySelector('h2, h3, h4, [class*="title"]')?.textContent?.trim() || '';
        const priceEl = el.querySelector('[class*="price"]');
        const priceMatch = priceEl?.textContent?.match(/\$[\d,]+/);
        const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : null;

        const images = [];
        el.querySelectorAll('img').forEach(img => {
          const src = img.src;
          if (src && !src.includes('logo') && !src.includes('icon')) {
            images.push(src);
          }
        });

        const link = el.querySelector('a[href]');

        if (title && title.length > 5) {
          results.push({ title, price, images, href: link?.href || '' });
        }
      });

      return results;
    });

    console.log(`  Found ${items.length} items on page`);
    listings.push(...items);

  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }

  return listings;
}

async function scrapeListingPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Scroll to load images
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await sleep(200);
    }

    const data = await page.evaluate(() => {
      // Get title
      let title = document.querySelector('h1, h2, [class*="title"]')?.textContent?.trim() || '';

      // Get all images
      const images = [];
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src');
        if (src &&
            !src.includes('logo') &&
            !src.includes('icon') &&
            !src.includes('spacer') &&
            !src.includes('button') &&
            (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.gif'))) {
          // Get full size image if thumbnail
          const fullSrc = src.replace(/thumb|small|medium/gi, 'large');
          if (!images.includes(fullSrc) && !images.includes(src)) {
            images.push(src);
          }
        }
      });

      // Get price
      const priceMatch = document.body.textContent?.match(/\$[\d,]+/);
      const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : null;

      // Get description
      const descEl = document.querySelector('[class*="description"], [class*="details"], p');
      const description = descEl?.textContent?.trim().substring(0, 2000) || '';

      // Parse year
      const yearMatch = title.match(/(19|20)\d{2}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;

      // Parse make
      const makes = ['TEREX', 'FONTAINE', 'ROGERS', 'RAVENS', 'KRUZ', 'CATERPILLAR', 'CAT',
                     'KOMATSU', 'VOLVO', 'PETERBILT', 'KENWORTH', 'MACK', 'FREIGHTLINER',
                     'INTERNATIONAL', 'WESTERN STAR'];
      let make = '';
      const titleUpper = title.toUpperCase();
      for (const m of makes) {
        if (titleUpper.includes(m)) {
          make = m;
          break;
        }
      }

      return { title, price, images, description, year, make };
    });

    return data;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('Scraping Joseph Equipment Co');
  console.log('   Website: josephequipment.com');
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

  // Sandhills-based inventory URLs
  const inventoryPages = [
    { url: BASE_URL + '/inventory/?/listings/for-sale/trucks/27?AccountCRMID=363065&settingscrmid=363065&dlr=1', type: 'trucks' },
    { url: BASE_URL + '/inventory/?/listings/for-sale/trailers/28?AccountCRMID=363065&settingscrmid=363065&dlr=1', type: 'trailers' },
    { url: BASE_URL + '/inventory/?/listings/for-sale/construction-equipment/all?AccountCRMID=363065&settingscrmid=363065&dlr=1', type: 'construction' },
    { url: BASE_URL + '/inventory/?/listings/for-sale/attachments/all?AccountCRMID=363065&settingscrmid=363065&dlr=1', type: 'attachments' },
  ];

  let allListings = [];

  for (const inv of inventoryPages) {
    const listings = await scrapeSandhillsPage(page, inv.url, inv.type);
    allListings.push(...listings.map(l => ({ ...l, type: inv.type })));
  }

  // Dedupe by title
  const seen = new Set();
  allListings = allListings.filter(l => {
    if (seen.has(l.title)) return false;
    seen.add(l.title);
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
      // If there's a detail page link, try to get more images
      if (listing.href && listing.href.includes('josephequipment.com')) {
        await sleep(1500);
        const details = await scrapeListingPage(page, listing.href);
        if (details && details.images.length > listing.images.length) {
          listing.images = details.images;
        }
        if (details?.description) {
          listing.description = details.description;
        }
        if (details?.year) listing.year = details.year;
        if (details?.make) listing.make = details.make;
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

      // Parse year from title if not set
      if (!listing.year) {
        const yearMatch = listing.title.match(/(19|20)\d{2}/);
        listing.year = yearMatch ? parseInt(yearMatch[0]) : null;
      }

      // Parse make from title if not set
      if (!listing.make) {
        const makes = ['TEREX', 'FONTAINE', 'ROGERS', 'RAVENS', 'KRUZ', 'CAT', 'CATERPILLAR',
                       'KOMATSU', 'VOLVO', 'PETERBILT', 'KENWORTH', 'MACK', 'FREIGHTLINER'];
        const titleUpper = listing.title.toUpperCase();
        for (const m of makes) {
          if (titleUpper.includes(m)) {
            listing.make = m;
            break;
          }
        }
      }

      const categoryId = await getCategoryId(listing.title);
      const condition = listing.year && listing.year >= 2023 ? 'new' : 'used';

      const { data: newListing, error } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: listing.title,
        description: listing.description || listing.title,
        price: listing.price,
        price_type: listing.price ? 'fixed' : 'contact',
        condition: condition,
        year: listing.year,
        make: listing.make,
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
