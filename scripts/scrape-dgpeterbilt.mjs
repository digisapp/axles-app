// @ts-nocheck
/**
 * Scrape DG Peterbilt (Dimmick Group)
 * ImanPro platform - 96 trucks
 * Part of same group as Lucky's Trailer Sales
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'DG Peterbilt',
  email: 'sales@dgpeterbilt.com',
  phone: '(800) 639-7383',
  city: 'Newburgh',
  state: 'NY',
  website: 'https://www.dgpeterbilt.com'
};

// Map truck types to our category slugs
const CATEGORY_MAP = {
  'dump truck': 'dump-trucks',
  'dump': 'dump-trucks',
  'daycab': 'day-cab-trucks',
  'day cab': 'day-cab-trucks',
  'sleeper': 'sleeper-trucks',
  'hooklift': 'hooklift-trucks',
  'hook lift': 'hooklift-trucks',
  'cab chassis': 'cab-chassis-trucks',
  'flatbed': 'flatbed-trucks',
  'mixer': 'mixer-trucks',
  'concrete': 'mixer-trucks',
  'refuse': 'refuse-trucks',
  'garbage': 'refuse-trucks',
  'vacuum': 'vacuum-trucks',
  'tanker': 'tanker-trucks',
  'fuel': 'fuel-trucks',
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

  const password = 'DGPeterbilt2024!';
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
  let categorySlug = 'heavy-duty-trucks'; // Default for Peterbilt

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
  console.log('Fetching truck listing pages...');
  const allListings = [];

  // 96 trucks, 20 per page, so 5 pages
  for (let start = 0; start < 120; start += 20) {
    const url = `https://www.dgpeterbilt.com/trucks-for-sale/?start=${start}`;
    const html = await fetchHTML(url);

    // Extract all vid/unit pairs
    const regex = /\/trucks\/\?vid=(\d+)&unit=([^"'\s]+)/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const vid = match[1];
      const unit = match[2];
      if (!allListings.find(l => l.vid === vid)) {
        allListings.push({
          vid,
          unit,
          url: `https://www.dgpeterbilt.com/trucks/?vid=${vid}&unit=${unit}`
        });
      }
    }

    const countMatch = html.match(/of (\d+) Results/);
    const total = countMatch ? parseInt(countMatch[1]) : 96;

    if (allListings.length >= total || start + 20 >= total) {
      break;
    }

    await sleep(300);
  }

  console.log(`Found ${allListings.length} trucks`);
  return allListings;
}

async function fetchListingDetails(listing) {
  const html = await fetchHTML(listing.url);

  if (html.includes('Page Not Found') || html.includes('404')) {
    return null;
  }

  // Extract title
  let title = '';
  const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (h2Match) {
    title = h2Match[1]
      .replace(/^New\s+/i, '')
      .replace(/^Used\s+/i, '')
      .replace(/\s+for sale$/i, '')
      .trim();
  }

  if (!title) {
    const ogTitleMatch = html.match(/og:title" content="([^"]+)"/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1]
        .replace(/^New\s+/i, '')
        .replace(/^Used\s+/i, '')
        .replace(/\s+for sale$/i, '')
        .replace(/\s*\|.*$/, '')
        .trim();
    }
  }

  // Extract year
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Extract make
  const makes = ['PETERBILT', 'KENWORTH', 'FREIGHTLINER', 'MACK', 'VOLVO', 'INTERNATIONAL', 'WESTERN STAR'];
  let make = '';
  for (const m of makes) {
    if (title.toUpperCase().includes(m)) {
      make = m.charAt(0) + m.slice(1).toLowerCase();
      break;
    }
  }

  // Extract location
  let city = DEALER_INFO.city;
  let state = DEALER_INFO.state;
  const locMatch = html.match(/Dimmick Group[^-]*-\s*([A-Za-z\s]+),?\s*([A-Z]{2})/i) ||
                   html.match(/<strong>Location:<\/strong>[^<]*([A-Za-z\s]+),?\s*([A-Z]{2})/i);
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

  // Images - ImanPro sequential format (under luckys folder)
  const images = [];
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
  console.log('Scraping DG Peterbilt (Dimmick Group)');
  console.log('   Direct from: dgpeterbilt.com');
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
  console.log('   Trucks imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
