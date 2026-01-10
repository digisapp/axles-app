/**
 * Extract images from inventory grid pages
 *
 * Run with: npx tsx scripts/scrape-grid-images.ts
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

interface GridListing {
  title: string;
  price: string | null;
  image: string;
  link: string;
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
}

async function scrapeInventoryGrid(name: string, urls: string[]): Promise<GridListing[]> {
  console.log(`\n=== Scraping ${name} ===\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const allListings: GridListing[] = [];

  for (const url of urls) {
    try {
      console.log(`Loading: ${url.substring(0, 80)}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

      // Wait for content
      await new Promise(r => setTimeout(r, 3000));

      // Scroll to load lazy images
      for (let i = 0; i < 5; i++) {
        await autoScroll(page);
        await new Promise(r => setTimeout(r, 1000));
      }

      // Wait for images to load
      await new Promise(r => setTimeout(r, 2000));

      // Extract from Network requests (images that were loaded)
      const imageUrls = await page.evaluate(() => {
        const images: string[] = [];

        // Get all loaded images from performance API
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        resources.forEach(resource => {
          if (resource.initiatorType === 'img' ||
              resource.name.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
            if (!resource.name.includes('logo') &&
                !resource.name.includes('icon') &&
                !resource.name.includes('sprite')) {
              images.push(resource.name);
            }
          }
        });

        // Also get from img elements
        document.querySelectorAll('img').forEach((img) => {
          const src = img.currentSrc || img.src;
          if (src &&
              !src.includes('data:') &&
              !src.includes('logo') &&
              !src.includes('icon') &&
              !src.includes('placeholder') &&
              src.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
            if (!images.includes(src)) {
              images.push(src);
            }
          }
        });

        return images;
      });

      console.log(`  Found ${imageUrls.length} images in network/DOM`);

      // Get listing cards with their images
      const listings = await page.evaluate(() => {
        const results: any[] = [];

        // Find listing containers
        const containers = document.querySelectorAll(
          '[class*="listing"], [class*="result"], [class*="item"], [class*="card"], [data-listing]'
        );

        containers.forEach((container) => {
          const link = container.querySelector('a[href*="listing"]') as HTMLAnchorElement;
          const img = container.querySelector('img') as HTMLImageElement;
          const title = container.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');
          const price = container.querySelector('[class*="price"]');

          if (link && img && img.src) {
            results.push({
              title: title?.textContent?.trim() || 'Unknown',
              price: price?.textContent?.trim() || null,
              image: img.currentSrc || img.src,
              link: link.href,
            });
          }
        });

        return results;
      });

      console.log(`  Found ${listings.length} listing cards`);
      allListings.push(...listings);

      // Also save all image URLs found
      if (imageUrls.length > 0) {
        console.log('  Sample images:');
        imageUrls.slice(0, 5).forEach(url => console.log(`    - ${url.substring(0, 80)}`));
      }

    } catch (err) {
      console.log(`  Error: ${(err as Error).message}`);
    }
  }

  await browser.close();
  return allListings;
}

async function main() {
  console.log('Extracting images from inventory grids...\n');

  // Blyth URLs - different categories
  const blythUrls = [
    'https://www.blythtrailersales.com/inventory/?/listings/for-sale/flatbed-trailers-semi-trailers/14?accountcrmid=13174199&settingscrmid=13174199',
    'https://www.blythtrailersales.com/inventory/?/listings/for-sale/drop-deck-trailers-semi-trailers/12?accountcrmid=13174199&settingscrmid=13174199',
    'https://www.blythtrailersales.com/inventory/?/listings/for-sale/lowboy-trailers-semi-trailers/18?accountcrmid=13174199&settingscrmid=13174199',
  ];

  const blythResults = await scrapeInventoryGrid('Blyth Trailer Sales', blythUrls);

  // Pinnacle URLs
  const pinnacleUrls = [
    'https://www.pinnaclellc.us/inventory/?/listings/for-sale/trailers/28?dlr=1&accountcrmid=367568&settingscrmid=367569',
    'https://www.pinnaclellc.us/inventory/?/listings/for-sale/trucks/27?accountcrmid=367569&settingscrmid=367569',
  ];

  const pinnacleResults = await scrapeInventoryGrid('Pinnacle Truck & Trailer', pinnacleUrls);

  // Save results
  const outputDir = path.join(process.cwd(), 'data', 'dealers');

  if (blythResults.length > 0) {
    const deduped = blythResults.filter((v, i, a) => a.findIndex(t => t.link === v.link) === i);
    fs.writeFileSync(
      path.join(outputDir, 'blyth-trailer-sales-images.json'),
      JSON.stringify(deduped, null, 2)
    );
    console.log(`\nSaved ${deduped.length} Blyth listings`);
  }

  if (pinnacleResults.length > 0) {
    const deduped = pinnacleResults.filter((v, i, a) => a.findIndex(t => t.link === v.link) === i);
    fs.writeFileSync(
      path.join(outputDir, 'pinnacle-truck-trailer-images.json'),
      JSON.stringify(deduped, null, 2)
    );
    console.log(`\nSaved ${deduped.length} Pinnacle listings`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
