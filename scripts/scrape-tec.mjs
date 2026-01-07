// @ts-nocheck
/**
 * Scrape TEC Equipment
 * Next.js site with sitemap - large inventory
 * Portland, OR headquarters with 30+ locations
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'TEC Equipment',
  email: 'sales@tecequipment.com',
  phone: '(503) 285-7667',
  city: 'Portland',
  state: 'OR',
  website: 'https://www.tecequipment.com'
};

// Map their categories to our category slugs
const CATEGORY_MAP = {
  'dry van': 'dry-van-trailers',
  'flatbed': 'flatbed-trailers',
  'reefer': 'reefer-trailers',
  'refrigerated': 'reefer-trailers',
  'car carrier': 'car-hauler-trailers',
  'auto transport': 'car-hauler-trailers',
  'tank': 'tank-trailers',
  'lowboy': 'lowboy-trailers',
  'drop deck': 'drop-deck-trailers',
  'step deck': 'step-deck-trailers',
  'curtain': 'curtain-side-trailers',
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
    return existing.id;
  }

  const password = 'TEC2024!';
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
    city: DEALER_INFO.city,
    state: DEALER_INFO.state,
    is_dealer: true,
    website: DEALER_INFO.website,
  }).eq('id', authUser.user.id);

  console.log('Created dealer:', DEALER_INFO.name);
  console.log('  Email:', DEALER_INFO.email);
  console.log('  Password:', password);
  return authUser.user.id;
}

async function getCategoryId(categoryText) {
  const catLower = categoryText.toLowerCase();
  let categorySlug = 'dry-van-trailers'; // Default

  for (const [keyword, slug] of Object.entries(CATEGORY_MAP)) {
    if (catLower.includes(keyword)) {
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

  // Check if this is a trailer (not a truck)
  const isTrailer = html.includes('Semi-Trailers') ||
                    html.includes('category":"trailer') ||
                    html.includes('>Trailer<') ||
                    html.toLowerCase().includes('trailer');

  // Check if it's a truck (to exclude)
  const isTruck = html.includes('Semi-Trucks') ||
                  html.includes('category":"truck') ||
                  html.includes('Day Cab') ||
                  html.includes('Sleeper');

  if (isTruck && !isTrailer) {
    return { isTrailer: false };
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

  // Must contain trailer-related terms
  const titleLower = title.toLowerCase();
  if (!titleLower.includes('trailer') &&
      !titleLower.includes('wabash') &&
      !titleLower.includes('mac trailer') &&
      !titleLower.includes('cottrell') &&
      !titleLower.includes('great dane') &&
      !titleLower.includes('utility') &&
      !titleLower.includes('vanguard') &&
      !titleLower.includes('hyundai') &&
      !titleLower.includes('stoughton')) {

    // Check category explicitly
    if (!html.includes('Semi-Trailers')) {
      return { isTrailer: false };
    }
  }

  // Extract year
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Extract make
  const makes = ['Wabash', 'MAC', 'Cottrell', 'Great Dane', 'Utility', 'Vanguard',
                 'Hyundai', 'Stoughton', 'Fontaine', 'Trail King', 'Kentucky',
                 'Sun Country', 'BWS', 'Wilson', 'Reitnouer', 'East', 'Manac'];
  let make = '';
  for (const m of makes) {
    if (title.toUpperCase().includes(m.toUpperCase())) {
      make = m;
      break;
    }
  }

  // Extract price
  let price = null;
  const priceMatch = html.match(/\$([0-9,]+)(?:\.\d{2})?/);
  if (priceMatch) {
    const parsed = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (parsed > 5000 && parsed < 500000) {
      price = parsed;
    }
  }

  // Extract images from admin.tecequipment.com
  const images = [];
  const imgRegex = /https:\/\/admin\.tecequipment\.com\/wp-content\/uploads\/[^"'\s]+\.(?:jpg|jpeg|png)/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const imgUrl = imgMatch[0];
    if (!images.includes(imgUrl)) {
      images.push(imgUrl);
    }
  }

  // Extract category
  let category = 'Dry Van Trailers';
  const catMatch = html.match(/Semi-Trailers\s*[-–]\s*([^<"]+)/i);
  if (catMatch) {
    category = catMatch[1].trim();
  }

  // Extract location
  let city = DEALER_INFO.city;
  let state = DEALER_INFO.state;
  const locMatch = html.match(/location['":\s]+([A-Za-z\s]+),?\s*([A-Z]{2})/i);
  if (locMatch) {
    city = locMatch[1].trim();
    state = locMatch[2];
  }

  // Extract description
  const descMatch = html.match(/description" content="([^"]+)"/i);
  const description = descMatch ? descMatch[1] : title;

  // Determine condition
  const isNew = html.toLowerCase().includes('"new"') ||
                html.toLowerCase().includes('condition":"new') ||
                (year && year >= 2025);

  return {
    isTrailer: true,
    title,
    year,
    make,
    price,
    images: [...new Set(images)],
    category,
    city,
    state,
    description,
    condition: isNew ? 'new' : 'used',
  };
}

async function main() {
  console.log('Scraping TEC Equipment');
  console.log('   Direct from: tecequipment.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  const allUrls = await getInventoryUrls();

  let imported = 0;
  let skipped = 0;
  let trucks = 0;
  let errors = 0;

  // Process in batches
  const BATCH_SIZE = 50;
  const MAX_TRAILERS = 200; // Limit to avoid overwhelming the database

  for (let i = 0; i < allUrls.length && imported < MAX_TRAILERS; i++) {
    const item = allUrls[i];

    // Progress indicator every 50 items
    if (i % BATCH_SIZE === 0) {
      console.log(`\nProcessing ${i + 1}-${Math.min(i + BATCH_SIZE, allUrls.length)} of ${allUrls.length}...`);
    }

    try {
      await sleep(300 + Math.random() * 200);

      const details = await fetchListingDetails(item.url);

      if (!details.isTrailer) {
        trucks++;
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

      const categoryId = await getCategoryId(details.category);

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
        city: details.city,
        state: details.state,
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
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Trailers imported: ' + imported);
  console.log('   Trucks skipped: ' + trucks);
  console.log('   Other skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
