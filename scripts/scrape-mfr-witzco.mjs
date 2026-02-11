// @ts-nocheck
/**
 * Scrape Witzco Challenger lowboy/heavy-haul product catalog
 *
 * Witzco Challenger (witzco.com) manufactures RG (Removable Gooseneck,
 * ground-bearing) and NGB (Non-Ground Bearing) series lowboy trailers.
 * This scraper discovers product pages from their /product/ section,
 * extracts specs, images, and descriptions, and upserts them into
 * the manufacturer_products tables via shared utilities.
 *
 * Key product lines:
 *   RG-35  – 35 ton, tandem, 22' well, spring suspension
 *   RG-52  – 52 ton, tri-axle, 22'-26' well, spring suspension
 *   NGB-35 – 35 ton, tandem, air ride, 4 height settings, Honda pony motor
 *   NGB-52 – 52 ton, tri-axle, Honda GX390 pony motor, air ride
 *   NGB-60 – 60 ton, 56'6" overall, 24'2" well
 *
 * Usage:  node scripts/scrape-mfr-witzco.mjs
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

const MANUFACTURER_SLUG = 'witzco';
const MANUFACTURER_NAME = 'Witzco Challenger';
const WEBSITE = 'https://www.witzco.com';

/** Starting pages to discover lowboy / heavy-haul products */
const SEED_URLS = [
  'https://www.witzco.com/',
  'https://www.witzco.com/products/',
  'https://www.witzco.com/product/',
];

/** Direct product pages we know about (fallbacks in case discovery misses them) */
const KNOWN_PRODUCT_PAGES = [
  'https://www.witzco.com/product/rg-35-35-ton-removable-gooseneck-series/',
  'https://www.witzco.com/product/rg-50-50-ton-removable-gooseneck/',
  'https://www.witzco.com/product/ngb-35-35-ton-non-ground-bearing-removable-gooseneck/',
  'https://www.witzco.com/product/ngb-50-50-ton-non-ground-bearing-removable-gooseneck/',
];

/**
 * Keywords that signal a page is a lowboy / heavy-haul product.
 * Used to filter discovered links.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'removable gooseneck', 'detachable', 'gooseneck',
  'rgn', 'rg-', 'ngb-', 'non-ground bearing', 'non ground bearing',
  'heavy haul', 'ton', 'pony motor', 'challenger',
];

/** Delay between page loads (ms) */
const PAGE_DELAY_MIN = 2000;
const PAGE_DELAY_MAX = 3500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomDelay() {
  return PAGE_DELAY_MIN + Math.random() * (PAGE_DELAY_MAX - PAGE_DELAY_MIN);
}

/**
 * Determine the product_type from a product name / description.
 * All Witzco Challenger products are lowboy trailers.
 */
function classifyProductType(_name, _description = '') {
  return 'lowboy';
}

/**
 * Determine the gooseneck_type from product name / specs text.
 * RG models are ground-bearing hydraulic-detachable.
 * NGB models are non-ground-bearing.
 */
function classifyGooseneckType(name, specsText = '') {
  const text = `${name} ${specsText}`.toLowerCase();
  if (/ngb|non.?ground.?bearing/.test(text)) return 'non-ground-bearing';
  if (/\brg\b|rg-?\d|removable.?gooseneck|ground.?bearing/.test(text)) return 'hydraulic-detachable';
  if (/hydraulic.?detach/.test(text)) return 'hydraulic-detachable';
  if (/detach/.test(text)) return 'detachable';
  return 'hydraulic-detachable'; // default for Witzco
}

/**
 * Detect series from the product name / URL.
 * Witzco uses RG (Removable Gooseneck) and NGB (Non-Ground Bearing) prefixes.
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toUpperCase();
  if (/NGB[-\s]?60/.test(text)) return 'NGB';
  if (/NGB[-\s]?52|NGB[-\s]?50/.test(text)) return 'NGB';
  if (/NGB[-\s]?35/.test(text)) return 'NGB';
  if (/NGB/.test(text)) return 'NGB';
  if (/RG[-\s]?52|RG[-\s]?50/.test(text)) return 'RG';
  if (/RG[-\s]?35/.test(text)) return 'RG';
  if (/\bRG\b/.test(text)) return 'RG';
  return null;
}

/**
 * Extract model number from a product name.
 * E.g. "RG-35", "NGB-52", "NGB-60"
 */
function extractModelNumber(name) {
  const text = name.toUpperCase();
  // Match patterns like NGB-60, NGB-52, NGB-35, RG-52, RG-35
  const ngbMatch = text.match(/NGB[-\s]?\d{2,}/);
  if (ngbMatch) return ngbMatch[0].replace(/\s+/g, '-');
  const rgMatch = text.match(/RG[-\s]?\d{2,}/);
  if (rgMatch) return rgMatch[0].replace(/\s+/g, '-');
  return null;
}

/**
 * Parse axle count from spec text.
 */
function parseAxleCount(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/tri[-\s]?axle/.test(lower)) return 3;
  if (/tandem/.test(lower)) return 2;
  if (/quad/.test(lower)) return 4;
  const match = text.match(/(\d+)\s*(?:axle|axles)/i);
  if (match) return parseInt(match[1], 10);
  const numMatch = text.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 2 && n <= 8) return n;
  }
  return null;
}

/**
 * Try to infer axle count from the product name / description when specs
 * don't contain an explicit axle field.
 */
function inferAxleCount(name, description = '') {
  const text = `${name} ${description}`.toLowerCase();
  if (/tri[-\s]?axle/.test(text)) return 3;
  if (/tandem/.test(text)) return 2;
  if (/quad/.test(text)) return 4;
  // NGB-60 and RG-52/NGB-52 are typically tri-axle; RG-35/NGB-35 are tandem
  if (/ngb[-\s]?60/.test(text)) return 3;
  if (/ngb[-\s]?52|rg[-\s]?52|ngb[-\s]?50|rg[-\s]?50/.test(text)) return 3;
  if (/ngb[-\s]?35|rg[-\s]?35/.test(text)) return 2;
  return null;
}

/**
 * Try to infer tonnage from the product name when specs don't have it.
 */
function inferTonnage(name) {
  const text = name.toUpperCase();
  if (/NGB[-\s]?60/.test(text)) return { min: 60, max: 60 };
  if (/NGB[-\s]?52|NGB[-\s]?50/.test(text)) return { min: 52, max: 52 };
  if (/NGB[-\s]?35/.test(text)) return { min: 35, max: 35 };
  if (/RG[-\s]?52|RG[-\s]?50/.test(text)) return { min: 52, max: 52 };
  if (/RG[-\s]?35/.test(text)) return { min: 35, max: 35 };
  // Generic fallback from name
  const tonMatch = text.match(/(\d+)\s*[-–]?\s*(?:TO\s*)?(\d+)?\s*TON/);
  if (tonMatch) {
    const min = parseInt(tonMatch[1], 10);
    const max = tonMatch[2] ? parseInt(tonMatch[2], 10) : min;
    return { min, max };
  }
  return { min: null, max: null };
}

// ---------------------------------------------------------------------------
// Scraper Logic
// ---------------------------------------------------------------------------

/**
 * Discover product page URLs from seed pages.
 */
async function discoverProductLinks(page) {
  const allLinks = new Set();

  for (const seedUrl of SEED_URLS) {
    console.log(`  Crawling seed page: ${seedUrl}`);
    try {
      await page.goto(seedUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(randomDelay());

      const links = await page.evaluate((baseUrl) => {
        const found = [];
        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
          // Only keep links on witzco.com under /product/ or /products/
          if (
            fullUrl.includes('witzco.com') &&
            (fullUrl.includes('/product/') || fullUrl.includes('/products/'))
          ) {
            found.push(fullUrl.replace(/\/$/, '') + '/');
          }
        });
        return [...new Set(found)];
      }, WEBSITE);

      links.forEach((l) => allLinks.add(l));
      console.log(`    Found ${links.length} links`);
    } catch (err) {
      console.error(`    Error crawling ${seedUrl}: ${err.message}`);
    }
  }

  // Add known product pages as fallbacks
  KNOWN_PRODUCT_PAGES.forEach((url) => allLinks.add(url));

  // Filter to product detail pages (not top-level category pages)
  const filtered = [...allLinks].filter((url) => {
    // Skip top-level category pages
    if (url === 'https://www.witzco.com/products/') return false;
    if (url === 'https://www.witzco.com/product/') return false;

    // Must be a sub-page under /product/ (individual product detail)
    const isProductPage = /\/product\/[^/]+\/$/.test(url);
    // Also allow /products/<slug>/ if they use that pattern
    const isProductsPage = /\/products\/[^/]+\/$/.test(url);
    return isProductPage || isProductsPage;
  });

  console.log(`\n  Discovered ${filtered.length} candidate product pages`);
  return filtered;
}

/**
 * Scrape a single product page and return structured data.
 */
async function scrapeProductPage(page, url) {
  console.log(`\n  Scraping: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(randomDelay());
  } catch (err) {
    console.error(`    Navigation error: ${err.message}`);
    return null;
  }

  const pageData = await page.evaluate(() => {
    // --- Name / title ---
    const h1 = document.querySelector('h1');
    const name = h1 ? h1.textContent.trim() : '';

    // --- Tagline (often in a subtitle or first prominent paragraph) ---
    let tagline = '';
    const subtitle = document.querySelector(
      '.entry-subtitle, .page-subtitle, .product-subtitle, .woocommerce-product-details__short-description, h2'
    );
    if (subtitle) {
      tagline = subtitle.textContent.trim();
    }

    // --- Description ---
    let description = '';
    let shortDescription = '';
    const contentSelectors = [
      '.entry-content p',
      '.page-content p',
      '.product-description p',
      '.woocommerce-product-details__short-description p',
      'article p',
      'main p',
      '.content p',
      '#content p',
      '.elementor-widget-text-editor p',
      '.wpb_text_column p',
    ];
    for (const sel of contentSelectors) {
      const paragraphs = document.querySelectorAll(sel);
      if (paragraphs.length > 0) {
        const texts = [];
        paragraphs.forEach((p) => {
          const t = p.textContent.trim();
          if (t.length > 20) texts.push(t);
        });
        if (texts.length > 0) {
          description = texts.join('\n\n');
          shortDescription = texts[0].substring(0, 300);
          break;
        }
      }
    }

    // --- Specs table / list ---
    const specs = [];

    // Look for specification tables
    const tables = document.querySelectorAll('table');
    tables.forEach((table) => {
      const rows = table.querySelectorAll('tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const key = cells[0].textContent.trim();
          const value = cells[1].textContent.trim();
          if (key && value && key.length < 100 && value.length < 200) {
            specs.push({ rawKey: key, rawValue: value });
          }
        }
      });
    });

    // Also look for definition lists
    const dlItems = document.querySelectorAll('dl dt, dl dd');
    for (let i = 0; i < dlItems.length - 1; i += 2) {
      if (dlItems[i].tagName === 'DT' && dlItems[i + 1]?.tagName === 'DD') {
        const key = dlItems[i].textContent.trim();
        const value = dlItems[i + 1].textContent.trim();
        if (key && value) {
          specs.push({ rawKey: key, rawValue: value });
        }
      }
    }

    // Also look for spec-like key/value pairs in list items
    document.querySelectorAll('li, .spec-item, .feature-item').forEach((li) => {
      const text = li.textContent.trim();
      // Patterns like "Capacity: 110,000 lbs" or "Deck Height: 18""
      const kvMatch = text.match(/^([^:]{3,50}):\s*(.+)$/);
      if (kvMatch) {
        specs.push({ rawKey: kvMatch[1].trim(), rawValue: kvMatch[2].trim() });
      }
    });

    // Also look for strong/b tags followed by text (common spec format)
    document.querySelectorAll('p, div').forEach((el) => {
      const strongs = el.querySelectorAll('strong, b');
      strongs.forEach((strong) => {
        const key = strong.textContent.trim().replace(/:$/, '');
        const fullText = el.textContent.trim();
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const valueMatch = fullText.match(
          new RegExp(escapedKey + '[:\\s]+(.+)', 'i')
        );
        if (valueMatch && key.length > 2 && key.length < 80) {
          specs.push({ rawKey: key, rawValue: valueMatch[1].trim() });
        }
      });
    });

    // Look for Elementor-based specs (common in modern WordPress sites)
    document.querySelectorAll('.elementor-icon-list-text, .elementor-text-editor li').forEach((el) => {
      const text = el.textContent.trim();
      const kvMatch = text.match(/^([^:]{3,50}):\s*(.+)$/);
      if (kvMatch) {
        specs.push({ rawKey: kvMatch[1].trim(), rawValue: kvMatch[2].trim() });
      }
    });

    // --- Images ---
    const images = [];
    const seenUrls = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (!src) return;
      // Skip tiny icons, logos, etc.
      if (src.includes('logo') || src.includes('icon') || src.includes('favicon')) return;
      if (src.includes('.gif') || src.includes('.svg')) return;
      if (src.includes('gravatar') || src.includes('wp-content/plugins')) return;
      // Only keep witzco.com domain images or CDN / wp-content images
      if (!src.includes('witzco.com') && !src.includes('wp-content')) return;

      const width = img.naturalWidth || img.width || 0;
      if (width > 0 && width < 50) return; // skip tiny images

      const normalizedSrc = src.split('?')[0]; // remove query params for dedup
      if (seenUrls.has(normalizedSrc)) return;
      seenUrls.add(normalizedSrc);

      images.push({
        url: src,
        alt: img.alt || '',
      });
    });

    // Also check for gallery images (WooCommerce or custom galleries)
    document.querySelectorAll(
      '.woocommerce-product-gallery__image img, .product-gallery img, .gallery img, .slider img, .carousel img'
    ).forEach((img) => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (!src) return;
      const normalizedSrc = src.split('?')[0];
      if (seenUrls.has(normalizedSrc)) return;
      seenUrls.add(normalizedSrc);
      images.push({
        url: src,
        alt: img.alt || '',
      });
    });

    // --- Features list (to capture NGB-specific features) ---
    const features = [];
    document.querySelectorAll('ul li, ol li').forEach((li) => {
      const text = li.textContent.trim();
      if (text.length > 10 && text.length < 300) {
        features.push(text);
      }
    });

    // --- Body text for classification ---
    const bodyText = document.body ? document.body.textContent.substring(0, 5000) : '';

    return { name, tagline, description, shortDescription, specs, images, features, bodyText };
  });

  if (!pageData || !pageData.name) {
    console.log('    No product name found, skipping');
    return null;
  }

  console.log(`    Name: ${pageData.name}`);
  console.log(`    Specs found: ${pageData.specs.length}`);
  console.log(`    Images found: ${pageData.images.length}`);
  console.log(`    Features found: ${pageData.features.length}`);

  return { ...pageData, sourceUrl: url };
}

/**
 * Categorize raw specs into structured spec objects.
 */
function categorizeSpecs(rawSpecs) {
  const specs = [];
  const seen = new Set();

  for (const { rawKey, rawValue } of rawSpecs) {
    const key = rawKey.trim();
    const value = rawValue.trim();
    const dedup = `${key}|${value}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const keyLower = key.toLowerCase();

    // Classify by key content
    let category = 'General';
    let unit = null;

    if (/capacity|payload|gvwr|weight|tonnage|ton/i.test(keyLower)) {
      category = 'Capacity';
      if (/lbs?|pounds?/i.test(value)) unit = 'lbs';
      else if (/ton/i.test(value)) unit = 'tons';
    } else if (/deck|height|length|width|clearance|swing|well|overall/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
    } else if (/axle|suspension|tire|wheel|brake|air.?ride|spring/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch|detach/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump|pony.?motor|honda|motor/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    } else if (/height.?setting|ride.?height|auto.?height/i.test(keyLower)) {
      category = 'Height Control';
    }

    specs.push({ category, key, value, unit });
  }

  return specs;
}

/**
 * Build structured product data from scraped page data.
 */
function buildProduct(pageData) {
  const { name, tagline, description, shortDescription, specs: rawSpecs, features, sourceUrl } = pageData;

  // Combine all spec values for searching
  const allSpecText = rawSpecs.map((s) => `${s.rawKey}: ${s.rawValue}`).join(' ');
  const combinedText = `${name} ${description} ${allSpecText}`;

  // Tonnage
  let tonnageMin = null;
  let tonnageMax = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/capacity|tonnage|ton|payload/i.test(rawKey)) {
      const t = parseTonnage(rawValue);
      if (t.min) { tonnageMin = t.min; tonnageMax = t.max; break; }
    }
  }
  // Fallback: search description for tonnage
  if (!tonnageMin) {
    const tonMatch = combinedText.match(/(\d+)\s*[-–]?\s*(?:to\s*)?(\d+)?\s*ton/i);
    if (tonMatch) {
      tonnageMin = parseInt(tonMatch[1], 10);
      tonnageMax = tonMatch[2] ? parseInt(tonMatch[2], 10) : tonnageMin;
    }
  }
  // Fallback: infer from model name
  if (!tonnageMin) {
    const inferred = inferTonnage(name);
    tonnageMin = inferred.min;
    tonnageMax = inferred.max;
  }

  // Deck height
  let deckHeightInches = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?height|loaded.?height/i.test(rawKey)) {
      deckHeightInches = parseDeckHeight(rawValue);
      if (deckHeightInches) break;
    }
  }

  // Deck length (well length for lowboys)
  let deckLengthFeet = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?length|well.?length|loading.?length/i.test(rawKey)) {
      deckLengthFeet = parseLength(rawValue);
      if (deckLengthFeet) break;
    }
  }

  // Overall length
  let overallLengthFeet = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/overall.?length|total.?length/i.test(rawKey)) {
      overallLengthFeet = parseLength(rawValue);
      if (overallLengthFeet) break;
    }
  }

  // Axle count
  let axleCount = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/axle/i.test(rawKey)) {
      axleCount = parseAxleCount(rawValue);
      if (axleCount) break;
    }
  }
  // Fallback: infer from product name/description
  if (!axleCount) {
    axleCount = inferAxleCount(name, description);
  }

  // Empty weight
  let emptyWeightLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/empty.?weight|tare.?weight|unladen/i.test(rawKey)) {
      emptyWeightLbs = parseWeight(rawValue);
      if (emptyWeightLbs) break;
    }
  }

  // GVWR
  let gvwrLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/gvwr|gross.?vehicle|gross.?weight/i.test(rawKey)) {
      gvwrLbs = parseWeight(rawValue);
      if (gvwrLbs) break;
    }
  }

  // Concentrated capacity
  let concentratedCapacityLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/concentrated|max.?payload|capacity.*lbs/i.test(rawKey)) {
      concentratedCapacityLbs = parseWeight(rawValue);
      if (concentratedCapacityLbs) break;
    }
  }

  const series = detectSeries(name, sourceUrl);
  const modelNumber = extractModelNumber(name);
  const productType = classifyProductType(name, description);
  const gooseneckType = classifyGooseneckType(name, allSpecText);

  // Build a richer description that includes key features for NGB models
  let enrichedDescription = cleanText(description) || null;
  if (features && features.length > 0 && (!enrichedDescription || enrichedDescription.length < 100)) {
    const featureText = features.slice(0, 10).join('\n');
    enrichedDescription = enrichedDescription
      ? `${enrichedDescription}\n\nKey Features:\n${featureText}`
      : `Key Features:\n${featureText}`;
  }

  return {
    name: cleanText(name),
    series,
    model_number: modelNumber,
    tagline: cleanText(tagline) || null,
    description: enrichedDescription,
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
}

/**
 * Build images array for upsertProductImages.
 */
function buildImages(pageData) {
  return pageData.images.map((img) => ({
    url: img.url,
    alt_text: img.alt || `${pageData.name} trailer`,
    source_url: pageData.sourceUrl,
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  printBanner(MANUFACTURER_NAME, WEBSITE);

  const supabase = getSupabaseClient();
  const manufacturerId = await getManufacturerId(supabase, MANUFACTURER_SLUG);
  console.log(`  Manufacturer ID: ${manufacturerId}\n`);

  const browser = await createBrowser('new');
  const page = await createPage(browser);

  const stats = { scraped: 0, upserted: 0, errors: 0 };

  try {
    // ------------------------------------------------------------------
    // Step 1: Discover product page URLs
    // ------------------------------------------------------------------
    console.log('Step 1: Discovering product pages...\n');
    const productUrls = await discoverProductLinks(page);

    if (productUrls.length === 0) {
      console.error('  No product pages discovered! Aborting.');
      await browser.close();
      return;
    }

    // Deduplicate by normalizing URLs
    const uniqueUrls = [...new Set(productUrls.map((u) => u.replace(/\/$/, '') + '/'))];
    console.log(`\n  ${uniqueUrls.length} unique product pages to scrape\n`);

    // ------------------------------------------------------------------
    // Step 2: Scrape each product page
    // ------------------------------------------------------------------
    console.log('Step 2: Scraping individual product pages...');

    for (let i = 0; i < uniqueUrls.length; i++) {
      const url = uniqueUrls[i];
      console.log(`\n[${i + 1}/${uniqueUrls.length}] ${url}`);

      try {
        const pageData = await scrapeProductPage(page, url);
        if (!pageData) {
          stats.errors++;
          continue;
        }
        stats.scraped++;

        // Build structured data
        const product = buildProduct(pageData);
        const images = buildImages(pageData);
        const specs = categorizeSpecs(pageData.specs);

        console.log(`    Product type: ${product.product_type}`);
        console.log(`    Series: ${product.series || 'N/A'}`);
        console.log(`    Model: ${product.model_number || 'N/A'}`);
        console.log(`    Tonnage: ${product.tonnage_min || '?'}-${product.tonnage_max || '?'} ton`);
        console.log(`    Gooseneck: ${product.gooseneck_type || 'N/A'}`);
        console.log(`    Axles: ${product.axle_count || 'N/A'}`);
        console.log(`    Specs: ${specs.length}, Images: ${images.length}`);

        // ------------------------------------------------------------------
        // Step 3: Upsert to DB
        // ------------------------------------------------------------------
        const productId = await upsertProduct(supabase, manufacturerId, product);
        if (!productId) {
          console.error('    Failed to upsert product');
          stats.errors++;
          continue;
        }

        await upsertProductImages(supabase, productId, images);
        await upsertProductSpecs(supabase, productId, specs);

        stats.upserted++;
        console.log(`    Upserted product ID: ${productId}`);
      } catch (err) {
        console.error(`    Error processing ${url}: ${err.message}`);
        stats.errors++;
      }

      // Polite delay between page loads
      if (i < uniqueUrls.length - 1) {
        await sleep(randomDelay());
      }
    }

    // ------------------------------------------------------------------
    // Step 4: Update product count
    // ------------------------------------------------------------------
    console.log('\nStep 3: Updating product count...');
    const count = await updateProductCount(supabase, manufacturerId);
    console.log(`  Active products: ${count}`);
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    stats.errors++;
  } finally {
    await browser.close();
  }

  printSummary(MANUFACTURER_NAME, stats);
}

main().catch(console.error);
