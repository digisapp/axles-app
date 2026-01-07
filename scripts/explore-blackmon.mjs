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

  console.log('Loading inventory...');
  await page.goto('https://www.blackmontrailersllc.com/inventory/?/listings/for-sale/trailers/28?DSCompanyID=20778&dlr=1&settingscrmid=5336205', 
    { waitUntil: 'networkidle2', timeout: 60000 });
  
  await new Promise(r => setTimeout(r, 5000));
  
  // Check for listings
  const listings = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('a[href*="/listing/"]').forEach(a => {
      const href = a.href;
      if (href.includes('/listing/') && !results.some(r => r.url === href)) {
        results.push({ url: href, text: a.textContent.trim().substring(0, 60) });
      }
    });
    return results;
  });
  
  console.log('Listings found:', listings.length);
  listings.slice(0, 10).forEach(l => console.log('  -', l.text || '(no text)', '=>', l.url.substring(0, 80)));
  
  await browser.close();
}

explore().catch(console.error);
