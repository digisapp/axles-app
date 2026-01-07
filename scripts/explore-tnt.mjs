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

  console.log('Loading TNT Sales inventory...');
  await page.goto('https://www.tntsales.biz/inventory/trailers-for-sale/', { waitUntil: 'networkidle2', timeout: 60000 });
  
  await new Promise(r => setTimeout(r, 5000));
  
  const content = await page.content();
  if (content.includes('Pardon Our Interruption')) {
    console.log('BLOCKED by bot detection');
  } else {
    console.log('SUCCESS - page loaded');
    
    // Check for iframes (Sandhills uses iframes)
    const frames = page.frames();
    console.log('\nFrames:', frames.length);
    for (const frame of frames) {
      console.log('  -', frame.url().substring(0, 80));
    }
    
    // Find listing links
    const links = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href*="listing"], a[href*="Listing"]').forEach(a => {
        const href = a.href;
        if (href && !results.includes(href)) {
          results.push(href);
        }
      });
      return results.slice(0, 20);
    });
    
    console.log('\nListing links:');
    links.forEach(l => console.log('  -', l));
    
    // Check contact info
    const contact = await page.evaluate(() => {
      const text = document.body.textContent;
      const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
      return { phones: phoneMatch ? phoneMatch.slice(0, 3) : [] };
    });
    console.log('\nPhones:', contact.phones);
  }
  
  await browser.close();
}

explore().catch(console.error);
