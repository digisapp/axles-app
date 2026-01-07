// @ts-nocheck
/**
 * Scrape Western Truck & Trailer
 * Webflow site with pagination
 * Salt Lake City, UT headquarters
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Western Truck & Trailer',
  email: 'sales@westerntruck.com',
  phone: '(888) 615-1388',
  city: 'Salt Lake City',
  state: 'UT',
  website: 'https://www.westerntruck.com'
};

// Map their categories to our slugs
const CATEGORY_MAP = {
  'bottom dump': 'bottom-dump-trailers',
  'side dump': 'side-dump-trailers',
  'end dump': 'dump-trailers',
  'lowboy': 'lowboy-trailers',
  'flatbed': 'flatbed-trailers',
  'step deck': 'step-deck-trailers',
  'tank': 'tank-trailers',
  'pneumatic': 'pneumatic-trailers',
  'tilt': 'tilt-trailers',
  'tag': 'tag-trailers',
  'roll off': 'roll-off-trailers',
  'specialty': 'specialty-trailers',
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

  const password = 'WesternTruck2024!';
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
  let categorySlug = 'flatbed-trailers'; // Default

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

async function getListingUrls() {
  console.log('Fetching inventory pages...');
  const allListings = [];

  for (let page = 1; page <= 15; page++) {
    const url = page === 1
      ? 'https://www.westerntruck.com/inventory'
      : `https://www.westerntruck.com/inventory?b09ec52b_page=${page}`;

    const html = await fetchHTML(url);

    // Check for "No items found"
    if (html.includes('No items found')) {
      break;
    }

    // Extract listing URLs - Webflow uses /inventory/[slug]
    const regex = /href="(\/inventory\/[^"]+)"/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const path = match[1];
      // Skip if it's just /inventory or pagination
      if (path === '/inventory' || path.includes('page=')) continue;

      const fullUrl = `https://www.westerntruck.com${path}`;
      if (!allListings.find(l => l.url === fullUrl)) {
        allListings.push({ url: fullUrl, slug: path.replace('/inventory/', '') });
      }
    }

    console.log(`  Page ${page}: ${allListings.length} items so far`);
    await sleep(500);
  }

  console.log(`Found ${allListings.length} total listings`);
  return allListings;
}

async function fetchListingDetails(listing) {
  const html = await fetchHTML(listing.url);

  if (html.includes('Page not found') || html.includes('404')) {
    return null;
  }

  // Extract title from og:title or h1
  let title = '';
  const ogTitleMatch = html.match(/og:title" content="([^"]+)"/i);
  if (ogTitleMatch) {
    title = ogTitleMatch[1].replace(' - Western Truck and Trailer Sales', '').trim();
  }

  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }

  // Extract year from title
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Extract make
  const makes = ['SmithCo', 'Ranco', 'XL Specialized', 'Choice', 'Dragon', 'Dorsey',
                 'Manac', 'Trail King', 'Freightliner', 'Mack', 'Fontaine', 'Extreme',
                 'Construction Trailer', 'CTS'];
  let make = '';
  for (const m of makes) {
    if (title.toLowerCase().includes(m.toLowerCase())) {
      make = m;
      break;
    }
  }

  // Extract price
  let price = null;
  const priceMatch = html.match(/\$([0-9,]+)(?:\.00)?/);
  if (priceMatch) {
    const parsed = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (parsed > 10000 && parsed < 500000) {
      price = parsed;
    }
  }

  // Extract category from page
  let category = 'Flatbed';
  const catMatch = html.match(/Bottom Dump|Side Dump|End Dump|Lowboy|Flatbed|Step Deck|Tank|Pneumatic|Tilt|Tag|Roll Off|Specialty/i);
  if (catMatch) {
    category = catMatch[0];
  }

  // Extract condition
  const isNew = html.toLowerCase().includes('"new"') ||
                html.toLowerCase().includes('condition.*new') ||
                !html.toLowerCase().includes('used');

  // Extract stock number
  const stockMatch = html.match(/Stock[^:]*:\s*([A-Z0-9\-]+)/i);
  const stockNumber = stockMatch ? stockMatch[1] : null;

  // Extract images from Webflow CDN
  const images = [];
  const imgRegex = /https:\/\/cdn\.prod\.website-files\.com\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const imgUrl = imgMatch[0];
    // Skip tiny images, icons, logos
    if (!imgUrl.includes('favicon') &&
        !imgUrl.includes('logo') &&
        !images.includes(imgUrl)) {
      images.push(imgUrl);
    }
  }

  // Filter to likely product images (larger ones typically have longer hashes)
  const productImages = images.filter(img => img.length > 80).slice(0, 15);

  return {
    title,
    year,
    make,
    price,
    category,
    stockNumber,
    images: productImages,
    condition: isNew ? 'new' : 'used',
  };
}

async function main() {
  console.log('Scraping Western Truck & Trailer');
  console.log('   Direct from: westerntruck.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  const listings = await getListingUrls();

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];

    process.stdout.write(`[${i + 1}/${listings.length}] `);

    try {
      await sleep(400 + Math.random() * 200);

      const details = await fetchListingDetails(listing);

      if (!details || !details.title) {
        console.log('no details');
        skipped++;
        continue;
      }

      process.stdout.write(`${details.title.substring(0, 40)}... `);

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
        description: details.title,
        price: details.price,
        price_type: details.price ? 'fixed' : 'contact',
        condition: details.condition,
        year: details.year,
        make: details.make,
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

      // Insert images
      for (let j = 0; j < details.images.length; j++) {
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
      console.log('error: ' + e.message);
      errors++;
    }
  }

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Items imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
