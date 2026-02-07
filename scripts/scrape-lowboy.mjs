// @ts-nocheck
/**
 * Scrape Lowboy Trailers from TruckPaper with dealer-specific accounts
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = 'https://www.truckpaper.com';
const CATEGORY_URL = '/listings/trailers/semi-trailers/lowboy-trailers';
const MAX_PAGES = 10; // Scrape up to 10 pages

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Dealer cache
const dealerCache = new Map();

async function getOrCreateDealer(info) {
  const name = info.name?.trim() || 'TruckPaper Listing';

  if (dealerCache.has(name)) return dealerCache.get(name);

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('company_name', name)
    .single();

  if (existing) {
    dealerCache.set(name, existing.id);
    return existing.id;
  }

  // Create new dealer
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  const email = `${cleanName}${Math.random().toString(36).substring(2,6)}@dealers.axlon.ai`;

  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: `Dealer${Math.random().toString(36).substring(2,10)}!`,
  });

  if (authUser?.user?.id) {
    await supabase.from('profiles').update({
      company_name: name,
      phone: info.phone || '',
      city: info.city || '',
      state: info.state || '',
      is_dealer: true,
    }).eq('id', authUser.user.id);

    dealerCache.set(name, authUser.user.id);
    console.log(`   ✓ Created dealer: ${name}`);
    return authUser.user.id;
  }

  // Fallback
  const { data: fallback } = await supabase.from('profiles').select('id').eq('company_name', 'TruckPaper Listings').single();
  return fallback?.id;
}

async function main() {
  console.log('🚛 Scraping Lowboy Trailers with Dealer Info...');
  console.log('==================================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  // Get category ID
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'lowboy-trailers').single();
  const categoryId = cat?.id;

  if (!categoryId) {
    console.log('❌ Lowboy trailers category not found');
    await browser.close();
    return;
  }

  let allListings = [];

  // Scrape multiple pages
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const url = `${BASE_URL}${CATEGORY_URL}?page=${pageNum}`;
    console.log(`   Page ${pageNum}...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      const listings = await page.evaluate((base) => {
        const items = [];
        document.querySelectorAll('a[href*="/listing/"]').forEach(el => {
          const href = el.getAttribute('href');
          if (href && href.includes('/listing/') && !items.some(i => i.url.includes(href))) {
            const title = el.textContent?.trim() || '';
            if (title && title.length > 5) {
              items.push({
                url: href.startsWith('http') ? href : base + href,
                title: title.substring(0, 100)
              });
            }
          }
        });
        return items;
      }, BASE_URL);

      if (listings.length === 0) break;

      // Dedupe
      const newListings = listings.filter(l => !allListings.some(a => a.url === l.url));
      allListings.push(...newListings);
      console.log(`      Found ${newListings.length} new listings`);

      await sleep(2000);
    } catch (e) {
      console.log(`      Error: ${e.message}`);
      break;
    }
  }

  console.log(`\n   Total unique listings: ${allListings.length}\n`);

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < allListings.length; i++) {
    const listing = allListings[i];
    process.stdout.write(`   [${i+1}/${allListings.length}] ${listing.title?.substring(0,40)}...`);

    try {
      await page.goto(listing.url, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(1500);

      const details = await page.evaluate(() => {
        const skipPatterns = ['flag', 'logo', 'icon', 'sprite', 'badge', '/flags/', '/icons/', '.gif', '.svg', 'placeholder'];
        const images = [];

        document.querySelectorAll('img[src*="sandhills"], img[src*="truckpaper"]').forEach(img => {
          const src = img.src || img.getAttribute('data-src');
          if (src && !images.includes(src) && !skipPatterns.some(p => src.toLowerCase().includes(p))) {
            images.push(src);
          }
        });

        // Get dealer info
        let dealerName = '', dealerPhone = '', dealerEmail = '', city = '', state = '';

        // Look for seller info
        const pageText = document.body.textContent || '';

        // Find dealer name from seller section
        const sellerSection = document.querySelector('[class*="seller"], [class*="dealer"], [class*="contact"]');
        if (sellerSection) {
          const lines = sellerSection.textContent.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 80);
          for (const line of lines) {
            if (!dealerName && !line.includes('Phone') && !line.includes('Contact') &&
                !line.includes('Email') && !line.includes('View') && !line.includes('Location') &&
                !line.match(/^\d/) && !line.includes('USD') && !line.includes('$')) {
              dealerName = line;
              break;
            }
          }
        }

        // Get phone
        const phoneLink = document.querySelector('a[href^="tel:"]');
        if (phoneLink) {
          const digits = phoneLink.href.replace('tel:', '').replace(/\D/g, '');
          if (digits.length >= 10) {
            dealerPhone = `(${digits.slice(-10,-7)}) ${digits.slice(-7,-4)}-${digits.slice(-4)}`;
          }
        }

        // Get email
        const emailLink = document.querySelector('a[href^="mailto:"]');
        if (emailLink) dealerEmail = emailLink.href.replace('mailto:', '');

        // Get location
        const locMatch = pageText.match(/Location[:\s]*([^,\n]+),\s*([A-Z]{2})/i);
        if (locMatch) {
          city = locMatch[1].trim().split(' ').pop() || ''; // Get last word (city name)
          state = locMatch[2];
        }

        // Get price
        const priceMatch = pageText.match(/\$([\d,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

        // Get year/make from title
        const titleEl = document.querySelector('h1, [class*="title"]');
        const title = titleEl?.textContent?.trim() || '';
        const yearMatch = title.match(/^(\d{4})/);
        const year = yearMatch ? parseInt(yearMatch[1]) : null;

        const parts = title.replace(/^\d{4}\s+/, '').split(/\s+/);
        const make = parts[0] || '';

        return { images, dealerName, dealerPhone, dealerEmail, city, state, price, year, make, title };
      });

      if (details.images.length === 0) {
        console.log(' no images');
        skipped++;
        continue;
      }

      // Get or create dealer
      const dealerId = await getOrCreateDealer({
        name: details.dealerName,
        phone: details.dealerPhone,
        city: details.city,
        state: details.state,
      });

      // Check duplicate
      const title = details.title || listing.title;
      const { data: exists } = await supabase.from('listings')
        .select('id')
        .eq('title', title)
        .single();

      if (exists) {
        console.log(' duplicate');
        skipped++;
        continue;
      }

      // Insert listing
      const { data: newListing, error: insertError } = await supabase.from('listings').insert({
        user_id: dealerId,
        category_id: categoryId,
        title: title,
        description: title,
        price: details.price,
        price_type: details.price ? 'fixed' : 'contact',
        condition: 'used',
        year: details.year,
        make: details.make,
        city: details.city,
        state: details.state,
        country: 'USA',
        status: 'active',
        listing_type: 'sale',
      }).select('id').single();

      if (insertError) {
        console.log(` error: ${insertError.message}`);
        continue;
      }

      // Insert images
      for (let j = 0; j < Math.min(details.images.length, 10); j++) {
        await supabase.from('listing_images').insert({
          listing_id: newListing.id,
          url: details.images[j],
          is_primary: j === 0,
          sort_order: j,
        });
      }

      imported++;
      console.log(` ✓ ${details.images.length} imgs - ${details.dealerName || 'Unknown'}`);

    } catch (e) {
      console.log(` error: ${e.message}`);
    }
  }

  await browser.close();

  console.log('\n==================================================');
  console.log(`📊 Summary:`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Dealers created: ${dealerCache.size}`);
  console.log('==================================================\n');
}

main().catch(console.error);
