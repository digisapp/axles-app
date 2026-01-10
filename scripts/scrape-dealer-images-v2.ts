/**
 * Stealth scraper v2 - More aggressive image extraction
 *
 * Run with: npx tsx scripts/scrape-dealer-images-v2.ts
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

interface ListingData {
  title: string;
  url: string;
  price: string | null;
  images: string[];
  specs: Record<string, string>;
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function scrapeDealer(name: string, inventoryUrl: string): Promise<ListingData[]> {
  console.log(`\n=== Scraping ${name} ===\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  const page = await browser.newPage();

  // Realistic browser fingerprint
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  });

  const results: ListingData[] = [];

  try {
    console.log('Loading inventory page...');
    await page.goto(inventoryUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // Wait and scroll to load lazy content
    await new Promise(r => setTimeout(r, 3000));
    await autoScroll(page);
    await new Promise(r => setTimeout(r, 2000));

    // Take screenshot for debugging
    await page.screenshot({ path: `/tmp/${name.replace(/\s/g, '-')}-inventory.png`, fullPage: true });
    console.log(`Screenshot saved to /tmp/${name.replace(/\s/g, '-')}-inventory.png`);

    // Extract listing cards directly from inventory page
    const listingsFromGrid = await page.evaluate(() => {
      const listings: any[] = [];

      // Look for listing cards/items
      const cards = document.querySelectorAll('[class*="listing"], [class*="inventory"], [class*="result"], .card, article');

      cards.forEach((card) => {
        const link = card.querySelector('a[href*="listing"]') as HTMLAnchorElement;
        const img = card.querySelector('img') as HTMLImageElement;
        const titleEl = card.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');

        if (link && img) {
          const imgSrc = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
          if (imgSrc && !imgSrc.includes('logo') && !imgSrc.includes('icon')) {
            listings.push({
              url: link.href,
              title: titleEl?.textContent?.trim() || 'Unknown',
              thumbnail: imgSrc,
            });
          }
        }
      });

      return listings;
    });

    console.log(`Found ${listingsFromGrid.length} listings with thumbnails on grid`);

    // Also get listing links for detailed scraping
    const listingLinks = await page.evaluate(() => {
      const links: string[] = [];
      document.querySelectorAll('a[href*="listing"]').forEach((el) => {
        const href = (el as HTMLAnchorElement).href;
        if (href && !links.includes(href) && href.includes('/listing/')) {
          links.push(href);
        }
      });
      return [...new Set(links)].slice(0, 25);
    });

    console.log(`Found ${listingLinks.length} unique listing links`);

    // Visit each listing for full details
    for (let i = 0; i < listingLinks.length; i++) {
      const link = listingLinks[i];
      try {
        console.log(`  [${i + 1}/${listingLinks.length}] ${link.substring(0, 70)}...`);

        await page.goto(link, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        await autoScroll(page);
        await new Promise(r => setTimeout(r, 1000));

        const data = await page.evaluate(() => {
          // Get title
          const titleEl = document.querySelector('h1') ||
                          document.querySelector('[class*="title"]') ||
                          document.querySelector('[class*="heading"]');
          const title = titleEl?.textContent?.trim() || 'Unknown';

          // Get price
          const priceEl = document.querySelector('[class*="price"]') ||
                          document.querySelector('[data-price]');
          const price = priceEl?.textContent?.trim() || null;

          // Get ALL images from various sources
          const images: string[] = [];

          // Regular img tags
          document.querySelectorAll('img').forEach((img) => {
            const sources = [
              img.src,
              img.getAttribute('data-src'),
              img.getAttribute('data-lazy-src'),
              img.getAttribute('data-original'),
              img.getAttribute('data-zoom-image'),
              img.getAttribute('data-large'),
            ];

            sources.forEach((src) => {
              if (src &&
                  !src.includes('logo') &&
                  !src.includes('icon') &&
                  !src.includes('placeholder') &&
                  !src.includes('spacer') &&
                  !src.includes('loading') &&
                  (src.includes('.jpg') || src.includes('.jpeg') ||
                   src.includes('.png') || src.includes('.webp') ||
                   src.includes('cloudinary') || src.includes('amazonaws') ||
                   src.includes('cdnjs') || src.includes('cdn.'))) {
                // Try to get largest version
                const fullSrc = src
                  .replace(/\/thumb\/|\/small\/|\/medium\//g, '/large/')
                  .replace(/_thumb|_small|_medium/g, '')
                  .replace(/\?w=\d+|\?h=\d+|\?size=\w+/g, '');
                if (!images.includes(fullSrc)) {
                  images.push(fullSrc);
                }
              }
            });
          });

          // Background images
          document.querySelectorAll('[style*="background"]').forEach((el) => {
            const style = (el as HTMLElement).style.backgroundImage;
            const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match && match[1] && !images.includes(match[1])) {
              images.push(match[1]);
            }
          });

          // Picture sources
          document.querySelectorAll('source').forEach((source) => {
            const srcset = source.getAttribute('srcset');
            if (srcset) {
              const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
              urls.forEach(url => {
                if (url && !images.includes(url)) {
                  images.push(url);
                }
              });
            }
          });

          // Get specs
          const specs: Record<string, string> = {};
          document.querySelectorAll('[class*="spec"], [class*="detail"], table tr, dl').forEach((el) => {
            const text = el.textContent?.trim() || '';
            const parts = text.split(/:\s*|\t+/);
            if (parts.length === 2) {
              specs[parts[0].trim()] = parts[1].trim();
            }
          });

          return { title, price, images, specs };
        });

        if (data.images.length > 0) {
          results.push({
            title: data.title,
            url: link,
            price: data.price,
            images: data.images,
            specs: data.specs,
          });
          console.log(`    ✓ ${data.images.length} images - ${data.title.substring(0, 40)}`);
        } else {
          console.log(`    ✗ No images found`);
        }

      } catch (err) {
        console.log(`    ✗ Error: ${(err as Error).message.substring(0, 50)}`);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }

  return results;
}

async function main() {
  console.log('Starting stealth image scraper v2...\n');

  const dealers = [
    {
      name: 'Blyth Trailer Sales',
      url: 'https://www.blythtrailersales.com/inventory/?/listings/for-sale/equipment/all?AccountCRMID=13174199&SettingsCRMID=13174199&dlr=1',
    },
    {
      name: 'Pinnacle Truck & Trailer',
      url: 'https://www.pinnaclellc.us/inventory/?/listings/for-sale/equipment/all?AccountCRMID=367569&SettingsCRMID=367569',
    },
  ];

  for (const dealer of dealers) {
    const results = await scrapeDealer(dealer.name, dealer.url);

    if (results.length > 0) {
      const outputDir = path.join(process.cwd(), 'data', 'dealers');
      const filename = `${dealer.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-images.json`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
      console.log(`\nSaved ${results.length} listings to ${filepath}`);
    } else {
      console.log(`\nNo results for ${dealer.name}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
