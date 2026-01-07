// @ts-nocheck
import puppeteer from 'puppeteer';

async function explore() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Loading detail page...');
  await page.goto('https://www.jhtt.com/inventory/specs/16428569/2027-Great__Dane-Everest__SS', { waitUntil: 'networkidle2', timeout: 60000 });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const data = await page.evaluate(() => {
    const title = document.querySelector('h1, h2, .title')?.textContent?.trim() || '';
    
    // Find all images
    const images = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && src.includes('http') && !src.includes('logo') && !src.includes('icon')) {
        images.push(src);
      }
    });
    
    // Find price
    let price = null;
    const bodyText = document.body.textContent;
    const priceMatch = bodyText.match(/\$[\d,]+/);
    if (priceMatch) {
      price = priceMatch[0];
    }
    
    // Get all text that looks like specs
    const specs = [];
    document.querySelectorAll('dt, dd, .spec, [class*="spec"], th, td').forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length < 100) {
        specs.push(text);
      }
    });
    
    return { title, images, price, specs: specs.slice(0, 30) };
  });
  
  console.log('Title:', data.title);
  console.log('Price:', data.price);
  console.log('Images:', data.images.length);
  data.images.slice(0, 5).forEach(i => console.log('  -', i));
  console.log('Specs sample:', data.specs.slice(0, 10));
  
  await browser.close();
}

explore().catch(console.error);
