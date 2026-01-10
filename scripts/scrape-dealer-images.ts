/**
 * Stealth scraper for dealer listing images
 *
 * Run with: npx tsx scripts/scrape-dealer-images.ts
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

puppeteer.use(StealthPlugin());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ListingImage {
  title: string;
  url: string;
  images: string[];
}

async function scrapeBlyth(): Promise<ListingImage[]> {
  console.log('\n=== Scraping Blyth Trailer Sales ===\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set realistic viewport and user agent
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const results: ListingImage[] = [];

  try {
    // Go to inventory page
    console.log('Loading inventory page...');
    await page.goto('https://www.blythtrailersales.com/inventory/?/listings/for-sale/equipment/all?AccountCRMID=13174199&SettingsCRMID=13174199&dlr=1', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for listings to load
    await page.waitForSelector('.listing-card, .inventory-item, [class*="listing"], [class*="inventory"]', { timeout: 10000 }).catch(() => {});

    // Get all listing links
    const listingLinks = await page.evaluate(() => {
      const links: string[] = [];
      // Try various selectors
      const selectors = [
        'a[href*="/listing/"]',
        'a[href*="/Inventory/"]',
        '.listing-card a',
        '.inventory-item a',
      ];

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((el) => {
          const href = (el as HTMLAnchorElement).href;
          if (href && href.includes('listing') && !links.includes(href)) {
            links.push(href);
          }
        });
      }
      return links.slice(0, 15); // Limit to first 15
    });

    console.log(`Found ${listingLinks.length} listing links`);

    // Visit each listing and get images
    for (const link of listingLinks) {
      try {
        console.log(`  Visiting: ${link.substring(0, 80)}...`);
        await page.goto(link, { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1000)); // Wait for images to load

        const data = await page.evaluate(() => {
          const title = document.querySelector('h1, .listing-title, [class*="title"]')?.textContent?.trim() || 'Unknown';

          const images: string[] = [];
          // Get all images
          document.querySelectorAll('img').forEach((img) => {
            const src = img.src || img.getAttribute('data-src') || '';
            // Filter for listing images (usually larger images, not icons)
            if (src &&
                !src.includes('logo') &&
                !src.includes('icon') &&
                !src.includes('placeholder') &&
                (src.includes('cdn') || src.includes('cloudinary') || src.includes('amazonaws') ||
                 src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp'))) {
              // Get full size version if available
              const fullSrc = src.replace(/\/thumb\/|\/small\/|_thumb|_small|\?.*$/g, '');
              if (!images.includes(fullSrc)) {
                images.push(fullSrc);
              }
            }
          });

          return { title, images };
        });

        if (data.images.length > 0) {
          results.push({ title: data.title, url: link, images: data.images });
          console.log(`    Found ${data.images.length} images for: ${data.title.substring(0, 50)}`);
        }

      } catch (err) {
        console.log(`    Error on listing: ${(err as Error).message}`);
      }
    }

  } catch (err) {
    console.error('Error scraping Blyth:', err);
  } finally {
    await browser.close();
  }

  return results;
}

async function scrapePinnacle(): Promise<ListingImage[]> {
  console.log('\n=== Scraping Pinnacle Truck & Trailer ===\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const results: ListingImage[] = [];

  try {
    // Go to inventory page
    console.log('Loading inventory page...');
    await page.goto('https://www.pinnaclellc.us/inventory/?/listings/for-sale/equipment/all?AccountCRMID=367569&SettingsCRMID=367569', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.waitForSelector('.listing-card, .inventory-item, [class*="listing"], [class*="inventory"]', { timeout: 10000 }).catch(() => {});

    // Get listing links
    const listingLinks = await page.evaluate(() => {
      const links: string[] = [];
      const selectors = [
        'a[href*="/listing/"]',
        'a[href*="/Inventory/"]',
        '.listing-card a',
        '.inventory-item a',
      ];

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((el) => {
          const href = (el as HTMLAnchorElement).href;
          if (href && href.includes('listing') && !links.includes(href)) {
            links.push(href);
          }
        });
      }
      return links.slice(0, 20); // Limit to first 20
    });

    console.log(`Found ${listingLinks.length} listing links`);

    for (const link of listingLinks) {
      try {
        console.log(`  Visiting: ${link.substring(0, 80)}...`);
        await page.goto(link, { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1000));

        const data = await page.evaluate(() => {
          const title = document.querySelector('h1, .listing-title, [class*="title"]')?.textContent?.trim() || 'Unknown';

          const images: string[] = [];
          document.querySelectorAll('img').forEach((img) => {
            const src = img.src || img.getAttribute('data-src') || '';
            if (src &&
                !src.includes('logo') &&
                !src.includes('icon') &&
                !src.includes('placeholder') &&
                (src.includes('cdn') || src.includes('cloudinary') || src.includes('amazonaws') ||
                 src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp'))) {
              const fullSrc = src.replace(/\/thumb\/|\/small\/|_thumb|_small|\?.*$/g, '');
              if (!images.includes(fullSrc)) {
                images.push(fullSrc);
              }
            }
          });

          return { title, images };
        });

        if (data.images.length > 0) {
          results.push({ title: data.title, url: link, images: data.images });
          console.log(`    Found ${data.images.length} images for: ${data.title.substring(0, 50)}`);
        }

      } catch (err) {
        console.log(`    Error on listing: ${(err as Error).message}`);
      }
    }

  } catch (err) {
    console.error('Error scraping Pinnacle:', err);
  } finally {
    await browser.close();
  }

  return results;
}

async function saveResults(dealerName: string, results: ListingImage[]) {
  const outputDir = path.join(process.cwd(), 'data', 'dealers');
  const filename = `${dealerName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-images.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} listings with images to ${filepath}`);
}

async function main() {
  console.log('Starting stealth image scraper...');
  console.log('Using Puppeteer with Stealth plugin to bypass bot detection.\n');

  // Scrape Blyth
  const blythResults = await scrapeBlyth();
  if (blythResults.length > 0) {
    await saveResults('blyth-trailer-sales', blythResults);
  }

  // Scrape Pinnacle
  const pinnacleResults = await scrapePinnacle();
  if (pinnacleResults.length > 0) {
    await saveResults('pinnacle-truck-trailer', pinnacleResults);
  }

  console.log('\n=== Summary ===');
  console.log(`Blyth Trailer Sales: ${blythResults.length} listings with images`);
  console.log(`Pinnacle Truck & Trailer: ${pinnacleResults.length} listings with images`);
}

main()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
