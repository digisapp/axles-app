// @ts-nocheck
/**
 * Talbert Manufacturing Product Catalog Scraper
 *
 * Scrapes talbertmfg.com for lowboy / heavy-haul trailer product data
 * and upserts it into the manufacturer_products tables via Supabase.
 *
 * Talbert Manufacturing (est. 1938) invented the hydraulic detachable
 * gooseneck trailer and produces CC, SA, RP, TA, HT, and other series.
 *
 * Usage:
 *   node scripts/scrape-mfr-talbert.mjs
 */

import {
  createBrowser,
  createPage,
  getSupabaseClient,
  getManufacturerId,
  upsertProduct,
  upsertProductImages,
  upsertProductSpecs,
  updateProductCount,
  sleep,
  cleanText,
  parseWeight,
  parseTonnage,
  parseDeckHeight,
  parseLength,
  slugify,
  printBanner,
  printSummary,
} from './lib/manufacturer-scraper-utils.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MANUFACTURER_SLUG = 'talbert';
const MANUFACTURER_NAME = 'Talbert Manufacturing';
const BASE_URL = 'https://talbertmfg.com';
const PRODUCTS_URL = `${BASE_URL}/products/`;
const PAGE_LOAD_DELAY_MS = 2500; // 2-3 seconds between page loads
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// Series metadata — used to classify products when the page data is ambiguous
// ---------------------------------------------------------------------------
const SERIES_MAP = {
  CC: { series: 'CC Series', fullName: 'Close-Coupled' },
  SA: { series: 'SA Series', fullName: 'Spread Axle' },
  RP: { series: 'RP Series', fullName: 'Rear-Pour / Roller Paver' },
  TA: { series: 'TA Series', fullName: 'Traveling Axle' },
  HT: { series: 'HT Series', fullName: 'Hydraulic Tail' },
  AC: { series: 'AC Series', fullName: 'Tag-A-Long / Tilt' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine series code from a product name string.
 * e.g. "55SA-HX Spread Axle Lowboy" => "SA"
 */
function detectSeriesCode(name) {
  if (!name) return null;
  const upper = name.toUpperCase();

  // Try matching a model-number prefix like "55CC", "60SA", "4053TA", "35HT"
  const modelMatch = upper.match(/\d+(CC|SA|RP|TA|HT|AC)/);
  if (modelMatch) return modelMatch[1];

  // Fallback: look for series keywords in the name
  if (/CLOSE.?COUPLE/i.test(name)) return 'CC';
  if (/SPREAD.?AXLE/i.test(name)) return 'SA';
  if (/REAR.?POUR|ROLLER.?PAVER/i.test(name)) return 'RP';
  if (/TRAVEL(ING)?.?AXLE/i.test(name)) return 'TA';
  if (/HYDRAULIC.?TAIL/i.test(name)) return 'HT';
  if (/TAG.?A.?LONG|TILT/i.test(name)) return 'AC';

  return null;
}

/**
 * Determine product_type based on product name and series.
 */
function detectProductType(name, seriesCode) {
  if (!name) return 'other';
  const lower = name.toLowerCase();

  if (/travel(ing)?\s*axle/i.test(lower)) return 'traveling-axle';
  if (/tag.?a.?long/i.test(lower)) return 'tag-along';
  if (/modular/i.test(lower)) return 'modular';
  if (/extendable|stretch/i.test(lower)) return 'extendable';
  if (/step.?deck/i.test(lower)) return 'step-deck';
  if (/flatbed|flat.?bed/i.test(lower)) return 'flatbed';
  if (/double.?drop/i.test(lower)) return 'double-drop';
  if (/tilt/i.test(lower)) return 'other';

  // Most Talbert products with CC/SA/HT/RP are RGN (hydraulic detachable gooseneck) lowboys
  if (seriesCode === 'CC' || seriesCode === 'SA' || seriesCode === 'RP') return 'rgn';
  if (seriesCode === 'HT') return 'lowboy';
  if (seriesCode === 'TA') return 'traveling-axle';

  // Generic lowboy fallback for anything with lowboy/lowbed in the name
  if (/lowboy|lowbed|low.?boy|low.?bed/i.test(lower)) return 'rgn';
  if (/paver/i.test(lower)) return 'lowboy';

  return 'lowboy';
}

/**
 * Determine gooseneck type based on product name and series.
 */
function detectGooseneckType(name, seriesCode) {
  if (!name) return null;
  const lower = name.toLowerCase();

  // Talbert is the inventor of hydraulic detachable gooseneck.
  // CC and SA series are hydraulic detachable gooseneck (RGN) lowboys.
  if (seriesCode === 'CC' || seriesCode === 'SA' || seriesCode === 'RP') {
    return 'hydraulic-detachable';
  }

  if (/non.?ground.?bearing/i.test(lower)) return 'non-ground-bearing';
  if (/hydraulic.?detach/i.test(lower)) return 'hydraulic-detachable';
  if (/mechanical.?detach/i.test(lower)) return 'mechanical-detachable';
  if (/detach/i.test(lower)) return 'detachable';
  if (/fixed.?gooseneck|fixed.?neck/i.test(lower)) return 'fixed';

  // TA and HT series are typically fixed gooseneck
  if (seriesCode === 'TA' || seriesCode === 'HT') return 'fixed';

  return null;
}

/**
 * Extract model number from the product name.
 * e.g. "55SA-HX Spread Axle Lowboy Trailer" => "55SA-HX"
 */
function extractModelNumber(name) {
  if (!name) return null;
  const match = name.match(/^(\d+\w+(?:-\w+)?)\b/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Parse an axle count from a string.
 */
function parseAxleCount(str) {
  if (!str) return null;
  const match = str.match(/(\d+)\s*axle/i);
  if (match) return parseInt(match[1], 10);
  // Just look for a plain number
  const numMatch = str.match(/(\d+)/);
  return numMatch ? parseInt(numMatch[1], 10) : null;
}

/**
 * Navigate to a URL with retry logic.
 */
async function safeGoto(page, url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      });
      if (response && response.status() === 403) {
        console.warn(`  [WARN] 403 Forbidden on ${url}`);
        if (attempt < retries) {
          console.log(`  Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }
      return response;
    } catch (err) {
      console.warn(`  [WARN] Navigation failed (attempt ${attempt + 1}): ${err.message}`);
      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS);
      } else {
        return null;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scraping functions
// ---------------------------------------------------------------------------

/**
 * Discover all product URLs from the /products/ page.
 * Talbert's products page lists all trailers with links to individual pages.
 */
async function discoverProductUrls(page) {
  console.log(`Navigating to products page: ${PRODUCTS_URL}`);
  const response = await safeGoto(page, PRODUCTS_URL);
  if (!response) {
    console.error('Failed to load products page. Trying alternative discovery...');
    return await discoverFromSitemap(page);
  }

  await sleep(2000);

  // Extract all links that point to /product/ individual pages
  const urls = await page.evaluate((baseUrl) => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const productUrls = new Set();

    for (const link of links) {
      const href = link.href;
      // Match /product/<slug>/ pattern (individual product pages)
      if (href && /\/product\/[^/]+\/?$/.test(href)) {
        // Normalize URL
        const url = href.endsWith('/') ? href : href + '/';
        productUrls.add(url);
      }
    }

    return Array.from(productUrls).sort();
  }, BASE_URL);

  console.log(`Found ${urls.length} product links on products page.\n`);

  // If the products page didn't yield enough results, also try the homepage
  if (urls.length < 5) {
    console.log('Few products found on /products/. Checking homepage for more links...');
    const homeUrls = await discoverFromHomepage(page);
    const combined = new Set([...urls, ...homeUrls]);
    console.log(`Total unique product URLs after homepage scan: ${combined.size}\n`);
    return Array.from(combined).sort();
  }

  return urls;
}

/**
 * Fallback: discover product URLs from the homepage.
 */
async function discoverFromHomepage(page) {
  const response = await safeGoto(page, BASE_URL);
  if (!response) return [];

  await sleep(2000);

  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const productUrls = new Set();
    for (const link of links) {
      const href = link.href;
      if (href && /\/product\/[^/]+\/?$/.test(href)) {
        const url = href.endsWith('/') ? href : href + '/';
        productUrls.add(url);
      }
    }
    return Array.from(productUrls);
  });
}

/**
 * Fallback: try to discover products from the XML sitemap.
 */
async function discoverFromSitemap(page) {
  const sitemapUrl = `${BASE_URL}/sitemap.xml`;
  console.log(`Trying sitemap: ${sitemapUrl}`);

  try {
    const response = await safeGoto(page, sitemapUrl);
    if (!response) return [];

    const content = await page.content();
    const urls = [];
    const regex = /<loc>(https?:\/\/talbertmfg\.com\/product\/[^<]+)<\/loc>/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const url = match[1].endsWith('/') ? match[1] : match[1] + '/';
      urls.push(url);
    }

    console.log(`Found ${urls.length} product URLs in sitemap.`);
    return urls;
  } catch (err) {
    console.warn(`Sitemap fallback failed: ${err.message}`);
    return [];
  }
}

/**
 * Scrape a single product page and return structured product data.
 */
async function scrapeProductPage(page, url) {
  console.log(`  Scraping: ${url}`);
  const response = await safeGoto(page, url);
  if (!response) {
    console.warn(`  [SKIP] Could not load ${url}`);
    return null;
  }

  await sleep(1500);

  const data = await page.evaluate(() => {
    // Helpers inside browser context
    const getText = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : '';
    };

    const getTexts = (sel) => {
      return Array.from(document.querySelectorAll(sel)).map((el) => el.textContent.trim());
    };

    // ---- Product Name ----
    // Try common heading selectors
    let name =
      getText('h1.product-title') ||
      getText('h1.entry-title') ||
      getText('.product-header h1') ||
      getText('h1');

    // ---- Description ----
    let description = '';
    const descEl =
      document.querySelector('.product-description') ||
      document.querySelector('.entry-content > p') ||
      document.querySelector('.product-content p') ||
      document.querySelector('.woocommerce-product-details__short-description') ||
      document.querySelector('article p');
    if (descEl) {
      description = descEl.textContent.trim();
    }

    // Also try to get a longer description from all paragraphs in the main content
    const contentEl =
      document.querySelector('.entry-content') ||
      document.querySelector('.product-content') ||
      document.querySelector('article');
    let fullDescription = '';
    if (contentEl) {
      const paras = contentEl.querySelectorAll('p');
      fullDescription = Array.from(paras)
        .map((p) => p.textContent.trim())
        .filter((t) => t.length > 20)
        .join('\n\n');
    }

    // ---- Tagline / short description ----
    let tagline = '';
    const taglineEl =
      document.querySelector('.product-tagline') ||
      document.querySelector('.product-subtitle') ||
      document.querySelector('.woocommerce-product-details__short-description');
    if (taglineEl) {
      tagline = taglineEl.textContent.trim();
    }

    // ---- Specs ----
    // Talbert product pages typically have specs in tables or definition lists
    const specs = [];

    // Try table-based specs
    const specTables = document.querySelectorAll('table');
    for (const table of specTables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const key = cells[0].textContent.trim();
          const value = cells[1].textContent.trim();
          if (key && value && key.length < 100 && value.length < 200) {
            specs.push({ key, value });
          }
        }
      }
    }

    // Try definition list specs
    const dlElements = document.querySelectorAll('dl');
    for (const dl of dlElements) {
      const dts = dl.querySelectorAll('dt');
      const dds = dl.querySelectorAll('dd');
      for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
        const key = dts[i].textContent.trim();
        const value = dds[i].textContent.trim();
        if (key && value) {
          specs.push({ key, value });
        }
      }
    }

    // Try spec lists (li with label:value pattern)
    const specLists = document.querySelectorAll(
      '.specs li, .specifications li, .product-specs li, .features li'
    );
    for (const li of specLists) {
      const text = li.textContent.trim();
      const colonMatch = text.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        specs.push({ key: colonMatch[1].trim(), value: colonMatch[2].trim() });
      }
    }

    // Try div-based spec groups (common in WordPress product pages)
    const specDivs = document.querySelectorAll(
      '.spec-row, .spec-item, [class*="spec"]'
    );
    for (const div of specDivs) {
      const label = div.querySelector('.spec-label, .spec-name, strong, b');
      const value = div.querySelector('.spec-value, .spec-data, span:last-child');
      if (label && value) {
        const k = label.textContent.trim().replace(/:$/, '');
        const v = value.textContent.trim();
        if (k && v && k !== v) {
          specs.push({ key: k, value: v });
        }
      }
    }

    // ---- Images ----
    const images = [];
    const seen = new Set();

    // Product gallery images
    const imgSelectors = [
      '.product-gallery img',
      '.woocommerce-product-gallery img',
      '.product-images img',
      '.gallery img',
      '.entry-content img',
      '.product-content img',
      'article img',
      '.wp-block-image img',
    ];

    for (const sel of imgSelectors) {
      const imgs = document.querySelectorAll(sel);
      for (const img of imgs) {
        // Prefer data-src (lazy load) or src
        let src = img.getAttribute('data-large_image') ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-lazy-src') ||
          img.src;

        if (!src || src.includes('data:image') || src.includes('placeholder')) continue;
        // Skip tiny icons and logos
        if (img.width && img.width < 50) continue;
        if (img.height && img.height < 50) continue;
        // Skip common non-product images
        if (/logo|icon|badge|banner|widget|gravatar/i.test(src)) continue;

        // Get full-size image if srcset is available
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          const parts = srcset.split(',').map((s) => s.trim());
          const largest = parts[parts.length - 1];
          const largeSrc = largest.split(/\s+/)[0];
          if (largeSrc && !largeSrc.includes('data:image')) {
            src = largeSrc;
          }
        }

        if (!seen.has(src)) {
          seen.add(src);
          images.push({
            url: src,
            alt: img.alt || '',
          });
        }
      }
    }

    // Also check for linked full-size images (lightbox pattern)
    const galleryLinks = document.querySelectorAll(
      'a[href*=".jpg"], a[href*=".jpeg"], a[href*=".png"], a[href*=".webp"]'
    );
    for (const link of galleryLinks) {
      const href = link.href;
      if (href && !seen.has(href) && !/logo|icon|badge/i.test(href)) {
        seen.add(href);
        const img = link.querySelector('img');
        images.push({
          url: href,
          alt: img ? img.alt || '' : '',
        });
      }
    }

    return {
      name,
      description: fullDescription || description,
      shortDescription: description,
      tagline,
      specs,
      images,
    };
  });

  if (!data || !data.name) {
    console.warn(`  [SKIP] No product name found on ${url}`);
    return null;
  }

  return { ...data, sourceUrl: url };
}

/**
 * Categorize a raw spec into { category, key, value, unit }.
 */
function categorizeSpec(rawKey, rawValue) {
  const key = rawKey.trim();
  const value = rawValue.trim();
  const lower = key.toLowerCase();

  // Capacity-related specs
  if (/capacity|payload|tonnage|ton\b|rating|gvwr|gross/i.test(lower)) {
    let unit = null;
    if (/ton/i.test(value)) unit = 'tons';
    else if (/lbs?|pounds?/i.test(value)) unit = 'lbs';
    else if (/kg/i.test(value)) unit = 'kg';
    return { category: 'Capacity', key, value, unit };
  }

  // Weight-related specs
  if (/weight|empty.*weight|curb.*weight|tare/i.test(lower)) {
    let unit = 'lbs';
    if (/kg/i.test(value)) unit = 'kg';
    return { category: 'Weight', key, value, unit };
  }

  // Dimension specs
  if (/length|width|height|deck|clear|overall|loaded/i.test(lower)) {
    let unit = null;
    if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
    else if (/[""]|inch|in\b/i.test(value)) unit = 'in';
    return { category: 'Dimensions', key, value, unit };
  }

  // Axle specs
  if (/axle|suspension|tire|wheel|brake/i.test(lower)) {
    return { category: 'Running Gear', key, value, unit: null };
  }

  // Gooseneck / neck specs
  if (/gooseneck|neck|detach/i.test(lower)) {
    return { category: 'Gooseneck', key, value, unit: null };
  }

  // Hydraulic / cylinder specs
  if (/hydraulic|cylinder|pump|power/i.test(lower)) {
    return { category: 'Hydraulics', key, value, unit: null };
  }

  // Structural specs
  if (/frame|beam|floor|deck.*type|steel|material|construction/i.test(lower)) {
    return { category: 'Construction', key, value, unit: null };
  }

  // Electrical / lighting
  if (/light|electric|led|wiring/i.test(lower)) {
    return { category: 'Electrical', key, value, unit: null };
  }

  // Default
  return { category: 'General', key, value, unit: null };
}

/**
 * Process raw scraped data into the structured product object.
 */
function processProduct(rawData) {
  const { name, description, shortDescription, tagline, specs, images, sourceUrl } = rawData;

  const cleanName = cleanText(name);
  const seriesCode = detectSeriesCode(cleanName);
  const seriesMeta = seriesCode ? SERIES_MAP[seriesCode] : null;
  const modelNumber = extractModelNumber(cleanName);
  const productType = detectProductType(cleanName, seriesCode);
  const gooseneckType = detectGooseneckType(cleanName, seriesCode);

  // Extract structured values from specs
  let tonnageMin = null;
  let tonnageMax = null;
  let deckHeightInches = null;
  let deckLengthFeet = null;
  let overallLengthFeet = null;
  let axleCount = null;
  let emptyWeightLbs = null;
  let gvwrLbs = null;
  let concentratedCapacityLbs = null;

  for (const spec of specs) {
    const lower = spec.key.toLowerCase();
    const val = spec.value;

    // Tonnage / capacity
    if (/capacity|payload|ton/i.test(lower) && /ton/i.test(val)) {
      const parsed = parseTonnage(val);
      if (parsed.min) tonnageMin = parsed.min;
      if (parsed.max) tonnageMax = parsed.max;
    }

    // Deck height
    if (/deck.*height|loaded.*height|load.*deck/i.test(lower)) {
      const h = parseDeckHeight(val);
      if (h) deckHeightInches = h;
    }

    // Deck length
    if (/deck.*length|well.*length|load.*length/i.test(lower)) {
      const l = parseLength(val);
      if (l) deckLengthFeet = l;
    }

    // Overall length
    if (/overall.*length|total.*length/i.test(lower)) {
      const l = parseLength(val);
      if (l) overallLengthFeet = l;
    }

    // Axles
    if (/axle/i.test(lower) && /\d/.test(val)) {
      const count = parseAxleCount(val);
      if (count) axleCount = count;
    }

    // Empty weight
    if (/empty.*weight|tare.*weight|trailer.*weight/i.test(lower)) {
      const w = parseWeight(val);
      if (w) emptyWeightLbs = w;
    }

    // GVWR
    if (/gvwr|gross.*vehicle|gross.*weight/i.test(lower)) {
      const w = parseWeight(val);
      if (w) gvwrLbs = w;
    }

    // Concentrated capacity
    if (/concentrated|center.*load/i.test(lower)) {
      const w = parseWeight(val);
      if (w) concentratedCapacityLbs = w;
    }
  }

  // If tonnage is in the model number (e.g. 55CC => 55 ton) and not found in specs
  if (!tonnageMin && modelNumber) {
    const tonMatch = modelNumber.match(/^(\d+)/);
    if (tonMatch) {
      const tons = parseInt(tonMatch[1], 10);
      // Only use if it looks like a tonnage value (< 200)
      if (tons <= 200) {
        tonnageMin = tons;
        tonnageMax = tons;
      }
    }
  }

  // Build categorized specs array
  const categorizedSpecs = specs.map((s) => categorizeSpec(s.key, s.value));

  // Build images array
  const processedImages = images
    .filter((img) => img.url && img.url.startsWith('http'))
    .map((img) => ({
      url: img.url,
      alt_text: img.alt || `${cleanName} trailer`,
      source_url: sourceUrl,
    }));

  const product = {
    name: cleanName,
    series: seriesMeta ? seriesMeta.series : null,
    model_number: modelNumber,
    tagline: cleanText(tagline) || null,
    description: cleanText(description) || null,
    short_description: cleanText(shortDescription) || null,
    product_type: productType,
    tonnage_min: tonnageMin,
    tonnage_max: tonnageMax,
    deck_height_inches: deckHeightInches,
    deck_length_feet: deckLengthFeet,
    overall_length_feet: overallLengthFeet,
    axle_count: axleCount,
    gooseneck_type: gooseneckType,
    empty_weight_lbs: emptyWeightLbs,
    gvwr_lbs: gvwrLbs,
    concentrated_capacity_lbs: concentratedCapacityLbs,
    source_url: sourceUrl,
  };

  return { product, specs: categorizedSpecs, images: processedImages };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  printBanner(MANUFACTURER_NAME, BASE_URL);

  // ---- Initialize Supabase ----
  const supabase = getSupabaseClient();
  const manufacturerId = await getManufacturerId(supabase, MANUFACTURER_SLUG);
  console.log(`Manufacturer ID: ${manufacturerId}\n`);

  // ---- Launch browser ----
  const browser = await createBrowser();
  const page = await createPage(browser);

  const stats = { scraped: 0, upserted: 0, errors: 0 };

  try {
    // ---- Discover product URLs ----
    const productUrls = await discoverProductUrls(page);

    if (productUrls.length === 0) {
      console.error('No product URLs found. The website may have changed or is blocking us.');
      return;
    }

    console.log(`\nWill scrape ${productUrls.length} products:\n`);
    for (const url of productUrls) {
      console.log(`  - ${url}`);
    }
    console.log('');

    // ---- Scrape each product ----
    for (let i = 0; i < productUrls.length; i++) {
      const url = productUrls[i];
      console.log(`\n[${i + 1}/${productUrls.length}] Processing product...`);

      try {
        const rawData = await scrapeProductPage(page, url);
        if (!rawData) {
          stats.errors++;
          continue;
        }

        stats.scraped++;
        const { product, specs, images } = processProduct(rawData);

        console.log(`  Name:    ${product.name}`);
        console.log(`  Series:  ${product.series || '(none)'}`);
        console.log(`  Model:   ${product.model_number || '(none)'}`);
        console.log(`  Type:    ${product.product_type}`);
        console.log(`  Tonnage: ${product.tonnage_min || '?'}-${product.tonnage_max || '?'} tons`);
        console.log(`  Specs:   ${specs.length} found`);
        console.log(`  Images:  ${images.length} found`);

        // ---- Upsert to Supabase ----
        const productId = await upsertProduct(supabase, manufacturerId, product);
        if (productId) {
          stats.upserted++;
          await upsertProductImages(supabase, productId, images);
          await upsertProductSpecs(supabase, productId, specs);
          console.log(`  Saved to DB (product ID: ${productId})`);
        } else {
          console.warn(`  [WARN] Failed to upsert product "${product.name}"`);
          stats.errors++;
        }
      } catch (err) {
        console.error(`  [ERROR] Failed to scrape ${url}: ${err.message}`);
        stats.errors++;
      }

      // Delay between page loads to be polite and avoid blocking
      if (i < productUrls.length - 1) {
        await sleep(PAGE_LOAD_DELAY_MS);
      }
    }

    // ---- Update product count ----
    const count = await updateProductCount(supabase, manufacturerId);
    console.log(`\nUpdated product count: ${count}`);
  } catch (err) {
    console.error(`\n[FATAL] Scraper error: ${err.message}`);
    console.error(err.stack);
  } finally {
    await browser.close();
  }

  printSummary(MANUFACTURER_NAME, stats);
}

main().catch(console.error);
