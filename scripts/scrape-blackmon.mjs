// @ts-nocheck
/**
 * Scrape Blackmon Trailers LLC
 * Sandhills platform - requires stealth mode
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
  name: 'Blackmon Trailers LLC',
  email: 'mail@blackmontrailers.com',
  phone: '(318) 824-7053',
  city: 'Mansfield',
  state: 'LA',
  website: 'https://www.blackmontrailersllc.com'
};

const CATEGORY_MAP = {
  'flatbed': 'flatbed-trailers',
  'log': 'logging-trailers',
  'lowboy': 'lowboy-trailers',
  'chip': 'chip-trailers',
  'dump': 'end-dump-trailers',
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

  const password = 'Blackmon2024!';
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
  let categorySlug = 'flatbed-trailers';

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

async function main() {
  console.log('Scraping Blackmon Trailers LLC');
  console.log('   Direct from: blackmontrailersllc.com');
  console.log('==================================================\n');

  const dealerId = await getOrCreateDealer();
  if (!dealerId) return;

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Start from homepage to build session
  console.log('Loading homepage first...');
  await page.goto('https://www.blackmontrailersllc.com/', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);

  // Now go to all trailers
  console.log('Loading inventory...');
  await page.goto('https://www.blackmontrailersllc.com/inventory/?/listings/for-sale/trailers/28?DSCompanyID=20778&dlr=1&settingscrmid=5336205', 
    { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(5000);

  // Scroll to load content
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(500);
  }

  // Check all frames for listings
  let allListings = [];
  
  for (const frame of page.frames()) {
    const url = frame.url();
    if (url.includes('blackmon') || url.includes('sandhills') || url.includes('truckpaper')) {
      console.log('Checking frame:', url.substring(0, 60));
      
      try {
        await sleep(1000);
        const listings = await frame.evaluate(() => {
          const results = [];
          // Look for any listing links
          document.querySelectorAll('a').forEach(a => {
            const href = a.href;
            const text = a.textContent.trim();
            if (href && href.includes('/listing/') && text.length > 5) {
              results.push({ url: href, title: text.substring(0, 100) });
            }
          });
          
          // Also look for table rows with truck/trailer data
          document.querySelectorAll('tr').forEach(tr => {
            const text = tr.textContent;
            if (text && text.match(/20\d{2}/) && 
                (text.includes('FONTAINE') || text.includes('PITTS') || text.includes('TRAIL'))) {
              const link = tr.querySelector('a');
              if (link && link.href.includes('/listing/')) {
                results.push({ url: link.href, title: text.substring(0, 100).trim() });
              }
            }
          });
          
          return results;
        });
        
        console.log('  Found:', listings.length, 'listings');
        
        for (const l of listings) {
          if (!allListings.some(x => x.url === l.url)) {
            allListings.push(l);
          }
        }
      } catch (e) {
        console.log('  Error:', e.message.substring(0, 40));
      }
    }
  }

  // Also check main page
  const mainListings = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a[href*="/listing/"]').forEach(a => {
      const href = a.href;
      const text = a.textContent.trim();
      if (!results.some(r => r.url === href)) {
        results.push({ url: href, title: text.substring(0, 100) });
      }
    });
    return results;
  });
  
  console.log('Main page listings:', mainListings.length);
  for (const l of mainListings) {
    if (!allListings.some(x => x.url === l.url)) {
      allListings.push(l);
    }
  }

  console.log('\nTotal unique listings found:', allListings.length);

  if (allListings.length === 0) {
    console.log('\nNo listings found - site may be blocking inventory access');
    await page.screenshot({ path: '/tmp/blackmon-inventory.png', fullPage: true });
    console.log('Screenshot saved to /tmp/blackmon-inventory.png');
    await browser.close();
    return;
  }

  // Process listings
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < allListings.length; i++) {
    const listing = allListings[i];
    process.stdout.write('[' + (i + 1) + '/' + allListings.length + '] ');
    
    try {
      await sleep(2000 + Math.random() * 1000);
      await page.goto(listing.url, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      const details = await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent?.trim() || '';
        
        const images = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src;
          if (src && (src.includes('sandhills') || src.includes('cloudinary')) &&
              !src.includes('logo') && !src.includes('icon') && !src.includes('.gif')) {
            images.push(src);
          }
        });

        const yearMatch = title.match(/^(20\d{2}|19\d{2})/);
        const year = yearMatch ? parseInt(yearMatch[1]) : null;

        const makes = ['FONTAINE', 'PITTS', 'TRAIL KING', 'XL SPECIALIZED', 'TALBERT', 'EAGER BEAVER'];
        let make = '';
        for (const m of makes) {
          if (title.toUpperCase().includes(m)) { make = m; break; }
        }

        return { title, images: [...new Set(images)], year, make };
      });

      process.stdout.write((details.title?.substring(0, 35) || 'Unknown') + '... ');

      if (!details.title || details.title.includes('Pardon')) {
        console.log('blocked');
        errors++;
        continue;
      }

      if (details.images.length === 0) {
        console.log('no images');
        skipped++;
        continue;
      }

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
        condition: details.year >= 2024 ? 'new' : 'used',
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

      for (let j = 0; j < Math.min(details.images.length, 10); j++) {
        await supabase.from('listing_images').insert({
          listing_id: newListing.id,
          url: details.images[j],
          is_primary: j === 0,
          sort_order: j,
        });
      }

      imported++;
      console.log('OK ' + details.images.length + ' imgs');
    } catch (e) {
      console.log('error: ' + (e.message?.substring(0, 40) || 'unknown'));
      errors++;
    }
  }

  await browser.close();

  console.log('\n==================================================');
  console.log('Summary:');
  console.log('   Dealer: ' + DEALER_INFO.name);
  console.log('   Imported: ' + imported);
  console.log('   Skipped: ' + skipped);
  console.log('   Errors: ' + errors);
  console.log('==================================================\n');
}

main().catch(console.error);
