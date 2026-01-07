// @ts-nocheck
/**
 * Scrape Lucky's Trailer Sales
 * ImanPro platform with offset-based pagination
 * 90 trailers across Northeast (VT, NH, NY)
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: "Lucky's Trailer Sales",
  email: 'sales@luckystrailers.com',
  phone: '(800) 639-7383',
  city: 'South Royalton',
  state: 'VT',
  website: 'https://www.luckystrailers.com'
};

// Map their types to our category slugs
const CATEGORY_MAP = {
  'end dump': 'dump-trailers',
  'dump': 'dump-trailers',
  'flatbed': 'flatbed-trailers',
  'lowboy': 'lowboy-trailers',
  'tag trailer': 'tag-trailers',
  'tag': 'tag-trailers',
  'live floor': 'live-floor-trailers',
  'traveling axle': 'lowboy-trailers',
  'detachable': 'lowboy-trailers',
  'drop deck': 'drop-deck-trailers',
  'step deck': 'step-deck-trailers',
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

  const password = 'Luckys2024!';
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

async function getCategoryId(title) {
  const titleLower = title.toLowerCase();
  let categorySlug = 'flatbed-trailers'; // Default

  for (const [keyword, slug] of Object.entries(CATEGORY_MAP)) {
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
  console.log('Fetching listing pages...');
  const allListings = [];

  // 90 trailers, 15 per page, so 6 pages (0, 15, 30, 45, 60, 75)
  for (let start = 0; start < 100; start += 15) {
    const url = `https://www.luckystrailers.com/trailers-for-sale/?start=${start}`;
    const html = await fetchHTML(url);

    // Extract all vid/unit pairs
    const regex = /\/trailers\/\?vid=(\d+)&unit=([^"'\s]+)/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const vid = match[1];
      const unit = match[2];
      // Avoid duplicates
      if (!allListings.find(l => l.vid === vid)) {
        allListings.push({
          vid,
          unit,
          url: `https://www.luckystrailers.com/trailers/?vid=${vid}&unit=${unit}`
        });
      }
    }

    // Check if we've got all items
    const countMatch = html.match(/of (\d+) Results/);
    const total = countMatch ? parseInt(countMatch[1]) : 90;

    if (allListings.length >= total || start + 15 >= total) {
      break;
    }

    await sleep(300);
  }

  console.log(`Found ${allListings.length} trailers`);
  return allListings;
}

async function fetchListingDetails(listing) {
  const html = await fetchHTML(listing.url);

  // Check for 404
  if (html.includes('Page Not Found') || html.includes('404')) {
    return null;
  }

  // Extract title
  let title = '';
  const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (h2Match) {
    title = h2Match[1].replace(' for sale', '').trim();
  }

  if (!title) {
    const ogTitleMatch = html.match(/og:title" content="([^"]+)"/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1].replace(' for sale', '').replace(' | Lucky\'s Trailer Sales', '').trim();
    }
  }

  // Extract year
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Extract make
  const makes = ['MAC', 'TALBERT', 'FELLING', 'LANDOLL', 'XL SPECIALIZED', 'DORSEY',
                 'EAGER BEAVER', 'LIDDELL', 'TRAIL KING', 'REITNOUER', 'FONTAINE'];
  let make = '';
  for (const m of makes) {
    if (title.toUpperCase().includes(m)) {
      make = m.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
      break;
    }
  }

  // Extract location from HTML
  let city = DEALER_INFO.city;
  let state = DEALER_INFO.state;
  const locMatch = html.match(/Located at[^<]*([A-Za-z\s]+),?\s*([A-Z]{2})/i) ||
                   html.match(/<strong>Location:<\/strong>[^<]*([A-Za-z\s]+),?\s*([A-Z]{2})/i) ||
                   html.match(/- ([A-Za-z\s]+), ([A-Z]{2})/);
  if (locMatch) {
    city = locMatch[1].trim();
    state = locMatch[2];
  }

  // Extract stock number
  const stockMatch = html.match(/Stock\s*#?\s*:?\s*([A-Z0-9]+)/i);
  const stockNumber = stockMatch ? stockMatch[1] : null;

  // Extract VIN
  const vinMatch = html.match(/VIN\s*:?\s*([A-Z0-9]{17})/i);
  const vin = vinMatch ? vinMatch[1] : null;

  // Images - ImanPro uses sequential numbered images
  const images = [];
  // Check for image count in HTML
  const imgCountMatch = html.match(/photo\/(\d+)\/(\d+)\.jpg/g);
  const maxImg = imgCountMatch ? Math.max(...imgCountMatch.map(m => {
    const num = m.match(/\/(\d+)\.jpg/);
    return num ? parseInt(num[1]) : 0;
  })) : 5;

  for (let i = 1; i <= Math.min(maxImg, 15); i++) {
    images.push(`https://www.imanpro.net/pub/co/luckys/photo/${listing.vid}/${i}.jpg`);
  }

  // Determine condition
  const isNew = year && year >= 2025;

  return {
    title,
    year,
    make,
    city,
    state,
    stockNumber,
    vin,
    images,
    condition: isNew ? 'new' : 'used',
  };
}

async function main() {
  console.log("Scraping Lucky's Trailer Sales");
  console.log('   Direct from: luckystrailers.com');
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
      await sleep(300 + Math.random() * 200);

      const details = await fetchListingDetails(listing);

      if (!details || !details.title) {
        console.log('no details');
        skipped++;
        continue;
      }

      process.stdout.write(`${details.title.substring(0, 40)}... `);

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

      const categoryId = await getCategoryId(details.title);

      const { data: newListing, error } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: details.title,
        description: details.title,
        price: null,
        price_type: 'contact',
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
      console.log(`OK ${details.images.length} imgs`);
    } catch (e) {
      console.log('error: ' + e.message);
      errors++;
    }
  }

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Trailers imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
