// @ts-nocheck
import puppeteer from 'puppeteer';

async function debug() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  const url = 'https://www.baskintrucksales.com/Inventory/?/listings/for-sale/trucks/27?DSCompanyID=7164&settingscrmid=362413';

  console.log('Loading:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait extra time for dynamic content
  await new Promise(r => setTimeout(r, 5000));

  // Get page HTML structure
  const html = await page.content();

  // Check for iframes
  const iframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => ({
      src: f.src,
      id: f.id,
      name: f.name
    }));
  });

  console.log('\nIframes found:', iframes.length);
  iframes.forEach(f => console.log('  -', f.src || f.id || f.name));

  // Check for listing elements
  const elements = await page.evaluate(() => {
    const results = {};

    // Check various selectors
    results['a[href*="listing"]'] = document.querySelectorAll('a[href*="listing"]').length;
    results['[class*="listing"]'] = document.querySelectorAll('[class*="listing"]').length;
    results['[class*="result"]'] = document.querySelectorAll('[class*="result"]').length;
    results['[class*="card"]'] = document.querySelectorAll('[class*="card"]').length;
    results['[class*="item"]'] = document.querySelectorAll('[class*="item"]').length;
    results['article'] = document.querySelectorAll('article').length;

    // Get some sample classes
    const allElements = document.querySelectorAll('*');
    const classes = new Set();
    allElements.forEach(el => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(' ').forEach(c => {
          if (c.length > 3) classes.add(c);
        });
      }
    });

    results.sampleClasses = Array.from(classes).slice(0, 30);

    return results;
  });

  console.log('\nElement counts:');
  for (const [selector, count] of Object.entries(elements)) {
    if (selector !== 'sampleClasses') {
      console.log(`  ${selector}: ${count}`);
    }
  }

  console.log('\nSample classes:', elements.sampleClasses?.join(', '));

  // Check if there's an iframe with inventory
  if (iframes.length > 0) {
    for (const iframe of iframes) {
      if (iframe.src && iframe.src.includes('sandhills')) {
        console.log('\n\nFound Sandhills iframe:', iframe.src);

        // Navigate to iframe source directly
        await page.goto(iframe.src, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        const iframeContent = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="listing"]'));
          return links.slice(0, 5).map(l => ({
            href: l.href,
            text: l.textContent?.trim().substring(0, 50)
          }));
        });

        console.log('Iframe listings:', iframeContent);
      }
    }
  }

  // Save screenshot for debugging
  await page.screenshot({ path: '/tmp/baskin-debug.png', fullPage: true });
  console.log('\nScreenshot saved to /tmp/baskin-debug.png');

  await browser.close();
}

debug().catch(console.error);
