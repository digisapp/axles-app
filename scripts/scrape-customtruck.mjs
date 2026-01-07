// @ts-nocheck
/**
 * Scrape Custom Truck One Source
 * WordPress site with good structure - no bot protection
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'Custom Truck One Source',
  email: 'sales@customtruck.com',
  phone: '(855) 458-8798',
  city: 'Kansas City',
  state: 'MO',
  website: 'https://www.customtruck.com'
};

// Map their categories to our category slugs
const CATEGORY_MAP = {
  'dump-trailer': 'end-dump-trailers',
  'low-boy-trailer': 'lowboy-trailers',
  'lowboy': 'lowboy-trailers',
  'equipment-hauler': 'equipment-trailers',
  'tag-along': 'equipment-trailers',
  'hydraulic-folding-tail': 'drop-deck-trailers',
  'extendable-pole': 'flatbed-trailers',
  'coil-pipe': 'flatbed-trailers',
  'dump-truck': 'dump-trucks',
  'water-truck': 'tank-trailers',
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

  const password = 'CustomTruck2024!';
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

async function getCategoryId(urlPath, title) {
  const pathLower = urlPath.toLowerCase();
  const titleLower = title.toLowerCase();
  let categorySlug = 'equipment-trailers'; // default

  // Check URL path first
  for (const [keyword, slug] of Object.entries(CATEGORY_MAP)) {
    if (pathLower.includes(keyword)) {
      categorySlug = slug;
      break;
    }
  }

  // Also check title for more specific matches
  if (titleLower.includes('lowboy') || titleLower.includes('low boy')) {
    categorySlug = 'lowboy-trailers';
  } else if (titleLower.includes('dump trailer') || titleLower.includes('end dump')) {
    categorySlug = 'end-dump-trailers';
  } else if (titleLower.includes('dump truck')) {
    categorySlug = 'dump-trucks';
  } else if (titleLower.includes('flatbed')) {
    categorySlug = 'flatbed-trailers';
  }

  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  return cat?.id;
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });
  return response.text();
}

function extractListingsFromHTML(html) {
  const listings = [];

  // Look for listing links with pattern: /new-used/category/type/year-make-model/stocknum
  const linkRegex = /href="(\/new-used\/[^"]+\/\d{4}-[^"]+\/[A-Z0-9]+)"/g;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    if (!listings.some(l => l.url === url)) {
      listings.push({ url: 'https://www.customtruck.com' + url });
    }
  }

  return listings;
}

async function fetchListingDetails(url) {
  const html = await fetchJSON(url);

  // Extract title from <title> or h1
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  let title = titleMatch ? titleMatch[1].trim() : '';
  title = title.replace(/\s*[|\-–]\s*Custom Truck.*$/i, '').trim();

  // Extract year from URL or title
  const yearMatch = url.match(/\/(\d{4})-/) || title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Extract make from title
  const makes = ['Load King', 'Peterbilt', 'Freightliner', 'Kenworth', 'International', 'Mack', 'Western Star', 'Ford', 'Chevrolet', 'GMC', 'Trail King', 'XL Specialized', 'Fontaine', 'Great Dane', 'Wabash', 'Utility'];
  let make = '';
  for (const m of makes) {
    if (title.toLowerCase().includes(m.toLowerCase())) {
      make = m;
      break;
    }
  }

  // Extract price
  const priceMatch = html.match(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*USD/i);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

  // Extract images from Azure CDN
  const images = [];
  const imgRegex = /https:\/\/pimctosprod\.azureedge\.net\/pim-assets\/[^"'\s]+\.(?:jpeg|jpg|png)/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const imgUrl = imgMatch[0];
    if (!images.includes(imgUrl)) {
      images.push(imgUrl);
    }
  }

  // Extract location
  const locationMatch = html.match(/Location[:\s]*<[^>]*>([^<]+)/i) || html.match(/([A-Z][a-z]+,\s*[A-Z]{2})/);
  let city = DEALER_INFO.city;
  let state = DEALER_INFO.state;
  if (locationMatch) {
    const loc = locationMatch[1].trim();
    const parts = loc.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      city = parts[0];
      state = parts[1].substring(0, 2).toUpperCase();
    }
  }

  // Extract description/specs
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  const description = descMatch ? descMatch[1] : title;

  // Determine condition
  const isNew = html.toLowerCase().includes('buyingtype=new') ||
                html.toLowerCase().includes('"new"') ||
                (year && year >= 2025);

  return {
    title,
    year,
    make,
    price,
    images,
    city,
    state,
    description,
    condition: isNew ? 'new' : 'used',
    url
  };
}

async function scrapeCategory(categoryUrl, categoryName, dealerId) {
  console.log(`\nScraping ${categoryName}...`);

  let allListings = [];
  let pageNum = 1;
  let hasMore = true;

  while (hasMore) {
    const url = pageNum === 1 ? categoryUrl : `${categoryUrl}?pageNumber=${pageNum}`;
    process.stdout.write(`  Page ${pageNum}... `);

    try {
      const html = await fetchJSON(url);
      const pageListings = extractListingsFromHTML(html);

      if (pageListings.length === 0) {
        console.log('no listings found');
        hasMore = false;
      } else {
        const newListings = pageListings.filter(l => !allListings.some(x => x.url === l.url));
        allListings.push(...newListings);
        console.log(`found ${pageListings.length} (${newListings.length} new, ${allListings.length} total)`);

        if (newListings.length === 0 || pageNum >= 10) {
          hasMore = false;
        } else {
          pageNum++;
          await sleep(1000);
        }
      }
    } catch (e) {
      console.log('error:', e.message.substring(0, 40));
      hasMore = false;
    }
  }

  console.log(`  Total ${categoryName}: ${allListings.length}`);
  return allListings;
}

async function main() {
  console.log('Scraping Custom Truck One Source');
  console.log('   Direct from: customtruck.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  // Scrape trailers and dump trucks
  const trailerListings = await scrapeCategory(
    'https://www.customtruck.com/new-used/trailers',
    'Trailers',
    dealerId
  );

  await sleep(2000);

  const dumpTruckListings = await scrapeCategory(
    'https://www.customtruck.com/new-used/dump-trucks',
    'Dump Trucks',
    dealerId
  );

  const allListings = [...trailerListings, ...dumpTruckListings];
  console.log(`\nTotal unique listings: ${allListings.length}`);

  // Process each listing
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < allListings.length; i++) {
    const listing = allListings[i];
    process.stdout.write(`[${i + 1}/${allListings.length}] `);

    try {
      await sleep(800 + Math.random() * 400);

      const details = await fetchListingDetails(listing.url);
      process.stdout.write((details.title?.substring(0, 35) || 'Unknown') + '... ');

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

      const categoryId = await getCategoryId(listing.url, details.title);

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

      // Insert images
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
      console.log('error: ' + (e.message?.substring(0, 40) || 'unknown'));
      errors++;
    }
  }

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
