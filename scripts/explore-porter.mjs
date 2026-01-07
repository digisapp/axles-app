// @ts-nocheck
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function explore() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Start from home page to build session
  console.log('Loading home page first...');
  await page.goto('https://www.portertrk.com/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Click on Trucks link naturally
  console.log('Clicking Trucks link...');
  await page.click('a[href*="trucks/27"]');
  await new Promise(r => setTimeout(r, 8000));
  
  // Check page content
  const content = await page.content();
  console.log('Page has captcha:', content.includes('hcaptcha'));
  console.log('Page has Pardon:', content.includes('Pardon'));
  
  // Check all frames
  for (const frame of page.frames()) {
    const url = frame.url();
    if (url.includes('portertrk') || url.includes('sandhills')) {
      console.log('\nChecking frame:', url.substring(0, 60));
      try {
        const html = await frame.content();
        console.log('  Has listings table:', html.includes('listing-row') || html.includes('ListingRow'));
        
        // Look for any truck/trailer data
        const items = await frame.evaluate(() => {
          const results = [];
          // Check for table rows
          document.querySelectorAll('tr, .listing, .item').forEach(el => {
            const text = el.textContent.trim();
            if (text.length > 20 && text.length < 200 && 
                (text.includes('PETERBILT') || text.includes('KENWORTH') || 
                 text.includes('FREIGHTLINER') || text.includes('INTERNATIONAL'))) {
              results.push(text.substring(0, 100));
            }
          });
          return results.slice(0, 5);
        });
        
        if (items.length > 0) {
          console.log('  Found items:', items);
        }
      } catch (e) {
        console.log('  Error:', e.message.substring(0, 40));
      }
    }
  }
  
  await browser.close();
}

explore().catch(console.error);
