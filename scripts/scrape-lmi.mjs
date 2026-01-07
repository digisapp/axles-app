// @ts-nocheck
/**
 * Scrape LMI Tennessee LLC
 * Source: LumbermenOnline.com (their main site blocks requests)
 * North America's largest lowboy trailer dealer
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEALER_INFO = {
  name: 'LMI Tennessee LLC',
  email: 'sales@lmitennessee.com',
  phone: '(800) 467-0944',
  city: 'Waverly',
  state: 'TN',
  website: 'https://www.lmitennessee.com'
};

// Map their categories to our category slugs
const CATEGORY_MAP = {
  'lowboy': 'lowboy-trailers',
  'log': 'logging-trailers',
  'chip': 'chip-trailers',
  'open top': 'live-floor-trailers',
  'roll trailer': 'live-floor-trailers',
  'detach': 'lowboy-trailers',
  'flatbed': 'flatbed-trailers',
  'drop deck': 'drop-deck-trailers',
  'loader': 'loaders',
  'knuckleboom': 'logging-trailers',
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

  const password = 'LMI2024!';
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
  let categorySlug = 'lowboy-trailers'; // Default - they specialize in lowboys

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
  const allListings = [];
  const baseUrl = 'https://www.lumbermenonline.com/contact/LMI-Tennessee-LLC?sellerid=3038';

  for (let page = 1; page <= 5; page++) {
    const url = page === 1 ? baseUrl : `${baseUrl}&page=${page}`;
    process.stdout.write(`  Page ${page}... `);

    try {
      const html = await fetchHTML(url);

      // Extract listing URLs with itemid
      const linkRegex = /href="(\/for-sale\/[^"]+\?itemid=(\d+))"/g;
      let match;
      const pageListings = [];

      while ((match = linkRegex.exec(html)) !== null) {
        const listingUrl = 'https://www.lumbermenonline.com' + match[1];
        const itemId = match[2];
        if (!pageListings.some(l => l.itemId === itemId)) {
          pageListings.push({ url: listingUrl, itemId });
        }
      }

      if (pageListings.length === 0) {
        console.log('no listings found, stopping');
        break;
      }

      const newListings = pageListings.filter(l => !allListings.some(x => x.itemId === l.itemId));
      allListings.push(...newListings);
      console.log(`found ${pageListings.length} (${newListings.length} new, ${allListings.length} total)`);

      if (newListings.length === 0) break;
      await sleep(1000);
    } catch (e) {
      console.log('error:', e.message.substring(0, 40));
      break;
    }
  }

  return allListings;
}

async function fetchListingDetails(url, itemId) {
  const html = await fetchHTML(url);

  // Extract title from itemprop="name" or meta title
  let title = '';
  const itemPropMatch = html.match(/itemprop="name">([^<]+)</i);
  if (itemPropMatch) {
    title = itemPropMatch[1].trim();
  } else {
    const metaTitleMatch = html.match(/<meta name="title" content="([^"]+)"/i);
    if (metaTitleMatch) {
      title = metaTitleMatch[1].trim();
    } else {
      const titleMatch = html.match(/<title>([^<]+)</i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s*For Sale.*$/i, '').trim();
      }
    }
  }

  // Extract year from title
  const yearMatch = title.match(/^(\d{4})\s/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Extract make from title
  const makes = ['Pitts', 'Dorsey', 'Jet', 'Landoll', 'Barko', 'CSI', 'Trail King', 'Fontaine', 'XL Specialized', 'Eager Beaver'];
  let make = '';
  for (const m of makes) {
    if (title.toLowerCase().includes(m.toLowerCase())) {
      make = m;
      break;
    }
  }

  // Extract price - look for price in the listing
  const priceMatch = html.match(/\$([0-9,]+)(?:\.\d{2})?/);
  let price = null;
  if (priceMatch) {
    const priceStr = priceMatch[1].replace(/,/g, '');
    const parsed = parseFloat(priceStr);
    if (parsed > 5000 && parsed < 500000) { // Reasonable price range for trailers
      price = parsed;
    }
  }

  // Extract images from src2 attributes (main images)
  const images = [];
  const imgRegex = /src2="(https:\/\/www\.lumbermenonline\.com\/items\/\d+\/[^"?]+)/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const imgUrl = imgMatch[1];
    if (!images.includes(imgUrl)) {
      images.push(imgUrl);
    }
  }

  // Also check for og:image as fallback
  if (images.length === 0) {
    const ogImgMatch = html.match(/og:image" content="([^"]+)"/i);
    if (ogImgMatch) {
      let ogUrl = ogImgMatch[1];
      if (ogUrl.startsWith('http://')) {
        ogUrl = ogUrl.replace('http://', 'https://');
      }
      // Convert ashx handler URL to direct URL
      if (ogUrl.includes('showitemimage.ashx')) {
        const fileMatch = ogUrl.match(/file=([^&"]+)/);
        if (fileMatch) {
          const directUrl = `https://www.lumbermenonline.com/items/${itemId}/${fileMatch[1]}`;
          images.push(directUrl);
        }
      } else {
        images.push(ogUrl);
      }
    }
  }

  // Extract description
  const descMatch = html.match(/<meta name="[Dd]escription" content="([^"]+)"/i);
  const description = descMatch ? descMatch[1] : title;

  // Determine condition based on year
  const isNew = year && year >= 2024;

  return {
    title,
    year,
    make,
    price,
    images: [...new Set(images)],
    description,
    condition: isNew ? 'new' : 'used',
  };
}

async function main() {
  console.log('Scraping LMI Tennessee LLC');
  console.log('   Source: LumbermenOnline.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  console.log('\nCollecting listing URLs...');
  const listings = await getListingUrls();
  console.log(`\nTotal unique listings: ${listings.length}\n`);

  if (listings.length === 0) {
    console.log('No listings found');
    return;
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    process.stdout.write(`[${i + 1}/${listings.length}] `);

    try {
      await sleep(800 + Math.random() * 400);

      const details = await fetchListingDetails(listing.url, listing.itemId);
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

      const categoryId = await getCategoryId(details.title);

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
