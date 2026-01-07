// @ts-nocheck
/**
 * Scrape TEC Equipment - Heavy Duty Trucks
 * Next.js site with sitemap
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_NAME = 'TEC Equipment';

// Map truck types to our category slugs
const CATEGORY_MAP = {
  'day cab': 'day-cab-trucks',
  'daycab': 'day-cab-trucks',
  'sleeper': 'sleeper-trucks',
  'dump truck': 'dump-trucks',
  'dump': 'dump-trucks',
  'flatbed truck': 'flatbed-trucks',
  'box truck': 'box-trucks',
  'refuse': 'refuse-trucks',
  'garbage': 'refuse-trucks',
  'vacuum': 'vacuum-trucks',
  'water truck': 'water-trucks',
  'fuel truck': 'fuel-trucks',
  'service truck': 'service-trucks',
  'utility': 'service-trucks',
  'tractor': 'heavy-duty-trucks',
  'semi-truck': 'heavy-duty-trucks',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getDealerId() {
  const { data: dealer } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', DEALER_NAME)
    .single();

  if (!dealer) {
    console.log('Dealer not found:', DEALER_NAME);
    return null;
  }
  return dealer.id;
}

async function getCategoryId(title, html) {
  const combined = (title + ' ' + html).toLowerCase();
  let categorySlug = 'heavy-duty-trucks'; // Default for trucks

  for (const [keyword, slug] of Object.entries(CATEGORY_MAP)) {
    if (combined.includes(keyword)) {
      categorySlug = slug;
      break;
    }
  }

  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  return cat?.id;
}

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });
  return response.text();
}

async function getInventoryUrls() {
  console.log('Fetching sitemap...');
  const sitemap = await fetchHTML('https://www.tecequipment.com/sitemap.xml');

  const urls = [];
  const regex = /https:\/\/www\.tecequipment\.com\/inventory\/(\d+)\//g;
  let match;

  while ((match = regex.exec(sitemap)) !== null) {
    urls.push({
      url: match[0],
      id: match[1]
    });
  }

  console.log(`Found ${urls.length} inventory items in sitemap`);
  return urls;
}

async function fetchListingDetails(url) {
  const html = await fetchHTML(url);

  // Check if this is a TRUCK (not a trailer)
  const isTruck = html.includes('Semi-Trucks') ||
                  html.includes('category":"truck') ||
                  html.includes('Day Cab') ||
                  html.includes('Sleeper') ||
                  html.includes('Tractor');

  const isTrailer = html.includes('Semi-Trailers') ||
                    html.includes('category":"trailer');

  if (!isTruck || isTrailer) {
    return { isTruck: false };
  }

  // Extract title
  let title = '';
  const ogTitleMatch = html.match(/og:title" content="([^"]+)"/i);
  if (ogTitleMatch) {
    title = ogTitleMatch[1].trim();
  } else {
    const titleMatch = html.match(/<title>([^<]+)</i);
    if (titleMatch) {
      title = titleMatch[1].replace(/\s*[|\-].*$/, '').trim();
    }
  }

  // Must be a truck make
  const truckMakes = ['VOLVO', 'MACK', 'FREIGHTLINER', 'KENWORTH', 'PETERBILT',
                      'INTERNATIONAL', 'WESTERN STAR', 'HINO', 'ISUZU'];
  const titleUpper = title.toUpperCase();
  let isTruckMake = truckMakes.some(make => titleUpper.includes(make));

  if (!isTruckMake) {
    return { isTruck: false };
  }

  // Extract year
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Extract make
  let make = '';
  for (const m of truckMakes) {
    if (titleUpper.includes(m)) {
      make = m.charAt(0) + m.slice(1).toLowerCase();
      break;
    }
  }

  // Extract price
  let price = null;
  const priceMatch = html.match(/\$([0-9,]+)(?:\.\d{2})?/);
  if (priceMatch) {
    const parsed = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (parsed > 10000 && parsed < 500000) {
      price = parsed;
    }
  }

  // Extract images
  const images = [];
  const imgRegex = /https:\/\/admin\.tecequipment\.com\/wp-content\/uploads\/[^"'\s]+\.(?:jpg|jpeg|png)/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const imgUrl = imgMatch[0];
    if (!images.includes(imgUrl)) {
      images.push(imgUrl);
    }
  }

  // Extract description
  const descMatch = html.match(/description" content="([^"]+)"/i);
  const description = descMatch ? descMatch[1] : title;

  // Determine condition
  const isNew = html.toLowerCase().includes('"new"') ||
                html.toLowerCase().includes('condition":"new') ||
                (year && year >= 2025);

  return {
    isTruck: true,
    title,
    year,
    make,
    price,
    images: [...new Set(images)],
    description,
    condition: isNew ? 'new' : 'used',
    html
  };
}

async function main() {
  console.log('Scraping TEC Equipment - Heavy Duty Trucks');
  console.log('==================================================\n');

  const dealerId = await getDealerId();
  if (!dealerId) return;

  const allUrls = await getInventoryUrls();

  let imported = 0;
  let skipped = 0;
  let notTruck = 0;
  let errors = 0;

  const MAX_TRUCKS = 150;

  for (let i = 0; i < allUrls.length && imported < MAX_TRUCKS; i++) {
    const item = allUrls[i];

    if (i % 50 === 0) {
      console.log(`\nProcessing ${i + 1}-${Math.min(i + 50, allUrls.length)} of ${allUrls.length}...`);
    }

    try {
      await sleep(300 + Math.random() * 200);

      const details = await fetchListingDetails(item.url);

      if (!details.isTruck) {
        notTruck++;
        continue;
      }

      process.stdout.write(`[${imported + 1}] ${(details.title?.substring(0, 35) || 'Unknown')}... `);

      if (!details.title) {
        console.log('no title');
        errors++;
        continue;
      }

      if (details.images.length === 0) {
        console.log('no images');
        skipped++;
        continue;
      }

      // Check for duplicate
      const { data: exists } = await supabase
        .from('listings')
        .select('id')
        .eq('title', details.title)
        .eq('user_id', dealerId)
        .single();

      if (exists) {
        console.log('duplicate');
        skipped++;
        continue;
      }

      const categoryId = await getCategoryId(details.title, details.html);

      const { data: newListing, error } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: details.title,
        description: details.description,
        price: details.price,
        price_type: details.price ? 'fixed' : 'contact',
        condition: details.condition,
        year: details.year,
        make: details.make,
        city: 'Portland',
        state: 'OR',
        country: 'USA',
        status: 'active',
        listing_type: 'sale',
      }).select('id').single();

      if (error) {
        console.log('error: ' + error.message);
        errors++;
        continue;
      }

      // Insert images (max 15)
      for (let j = 0; j < Math.min(details.images.length, 15); j++) {
        await supabase.from('listing_images').insert({
          listing_id: newListing.id,
          url: details.images[j],
          is_primary: j === 0,
          sort_order: j,
        });
      }

      imported++;
      const priceStr = details.price ? `$${details.price.toLocaleString()}` : 'Contact';
      console.log(`OK ${details.images.length} imgs ${priceStr}`);
    } catch (e) {
      errors++;
    }
  }

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_NAME);
  console.log('   Trucks imported: ' + imported);
  console.log('   Not trucks: ' + notTruck);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
