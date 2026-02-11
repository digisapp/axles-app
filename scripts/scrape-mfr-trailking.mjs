// @ts-nocheck
/**
 * Scrape Trail King Industries lowboy/heavy-haul product catalog
 *
 * Trail King (trailking.com) manufactures HDG, SA, and MG series lowboys.
 * This scraper discovers product pages from their /products/ and /solutions/
 * sections, extracts specs, images, and descriptions, and upserts them into
 * the manufacturer_products tables via shared utilities.
 *
 * Usage:  node scripts/scrape-mfr-trailking.mjs
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

const MANUFACTURER_SLUG = 'trail-king';
const MANUFACTURER_NAME = 'Trail King Industries';
const WEBSITE = 'https://www.trailking.com';

/** Starting pages to discover lowboy / heavy-haul products */
const SEED_URLS = [
  'https://www.trailking.com/products/',
  'https://www.trailking.com/solutions/open-deck-construction/',
  'https://www.trailking.com/solutions/open-deck-commercial/',
  'https://www.trailking.com/solutions/specialized/',
];

/** Direct product pages we know about (fallbacks in case discovery misses them) */
const KNOWN_PRODUCT_PAGES = [
  // Products section
  'https://www.trailking.com/products/tkhdg-hydraulic-detachable-gooseneck/',
  'https://www.trailking.com/products/hydraulic-detachable-gooseneck/',
  'https://www.trailking.com/products/paver-special/',
  'https://www.trailking.com/products/multi-axle/',
  'https://www.trailking.com/products/tklp-tag/',
  'https://www.trailking.com/products/tkrb-rollback/',
  'https://www.trailking.com/products/jeeps/',
  'https://www.trailking.com/products/boosters/',
  'https://www.trailking.com/products/detachable-double-drop-extendable/',
  // Solutions section – construction
  'https://www.trailking.com/solutions/open-deck-construction/hydraulic-detachable-gooseneck-trailer-tkhdg/',
  'https://www.trailking.com/solutions/open-deck-construction/hydraulic-sliding-axle-trailer-tksa/',
  'https://www.trailking.com/solutions/open-deck-construction/hydraulic-tail-trailer-tkht/',
  'https://www.trailking.com/solutions/open-deck-construction/paver-special-trailer-tkpaverspecial/',
  // Solutions section – commercial
  'https://www.trailking.com/solutions/open-deck-commercial/hydraulic-detachable-gooseneck-trailer-tkhdg-cmost/',
  'https://www.trailking.com/solutions/open-deck-commercial/mechanical-hydraulic-detachable-gooseneck-trailer/',
  'https://www.trailking.com/solutions/open-deck-commercial/detachable-gooseneck-double-drop-extendable-trailer/',
];

/**
 * Keywords that signal a page is a lowboy / heavy-haul product (vs. dump trailer, etc.)
 * Used to filter discovered links.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'detachable', 'hdg', 'gooseneck', 'sliding axle',
  'motor grader', 'semi-apron', 'hydraulic tail', 'paver special',
  'multi-axle', 'tag', 'rollback', 'double drop', 'booster', 'jeep',
  'heavy haul', 'rgn',
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
 */
function classifyProductType(name, description = '') {
  const text = `${name} ${description}`.toLowerCase();
  if (/rgn|hydraulic.?detach|hdg|detachable.?gooseneck/.test(text)) return 'rgn';
  if (/double.?drop|extendable/.test(text)) return 'double-drop';
  if (/step.?deck/.test(text)) return 'step-deck';
  if (/flatbed/.test(text)) return 'flatbed';
  if (/sliding.?axle|traveling.?axle/.test(text)) return 'traveling-axle';
  if (/tag/.test(text) && /tag.?along|tklp/.test(text)) return 'tag-along';
  if (/modular|multi.?axle/.test(text)) return 'modular';
  if (/lowboy|low.?boy/.test(text)) return 'lowboy';
  if (/booster|jeep/.test(text)) return 'other';
  return 'lowboy'; // default for Trail King heavy-haul
}

/**
 * Determine the gooseneck_type from product name / specs text.
 */
function classifyGooseneckType(name, specsText = '') {
  const text = `${name} ${specsText}`.toLowerCase();
  if (/hydraulic.?detach/.test(text)) return 'hydraulic-detachable';
  if (/mechanical.?detach/.test(text)) return 'mechanical-detachable';
  if (/non.?ground.?bearing/.test(text)) return 'non-ground-bearing';
  if (/detach/.test(text)) return 'detachable';
  if (/sliding/.test(text)) return 'sliding';
  if (/fold/.test(text)) return 'folding';
  if (/fixed/.test(text)) return 'fixed';
  return null;
}

/**
 * Detect series from the product name / URL.
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toUpperCase();
  if (/TKHDG|HDG/.test(text)) return 'HDG';
  if (/TKSA|SLIDING.?AXLE/.test(text)) return 'SA';
  if (/TKMG|MOTOR.?GRADER/.test(text)) return 'MG';
  if (/TKHT|HYDRAULIC.?TAIL/.test(text)) return 'HT';
  if (/TKLP|TAG/.test(text)) return 'LP';
  if (/TKRB|ROLLBACK/.test(text)) return 'RB';
  if (/PAVER/.test(text)) return 'HDG Paver Special';
  if (/BOOSTER/.test(text)) return 'Booster';
  if (/JEEP/.test(text)) return 'Jeep';
  if (/MULTI.?AXLE/.test(text)) return 'Multi-Axle';
  if (/DOUBLE.?DROP|EXTENDABLE/.test(text)) return 'DDE';
  return null;
}

/**
 * Extract model number from a product name.
 * E.g. "TK110HDG" or "TKHDG" or "TKSA-55"
 */
function extractModelNumber(name) {
  const text = name.toUpperCase();
  // Match patterns like TK70HDG, TK110HDG, TK120HDG
  const tkMatch = text.match(/TK\d*[A-Z]{2,}/);
  if (tkMatch) return tkMatch[0];
  // Match patterns like HDG580, HDG590
  const hdgMatch = text.match(/HDG\d{3}/);
  if (hdgMatch) return hdgMatch[0];
  return null;
}

/**
 * Parse axle count from spec text.
 */
function parseAxleCount(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:axle|axles)/i);
  if (match) return parseInt(match[1], 10);
  // Try standalone numbers near axle context
  const numMatch = text.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return null;
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
          // Only keep links on trailking.com under /products/ or /solutions/
          if (
            fullUrl.includes('trailking.com') &&
            (fullUrl.includes('/products/') || fullUrl.includes('/solutions/'))
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

  // Filter to just product detail pages (not top-level category pages)
  const filtered = [...allLinks].filter((url) => {
    // Skip top-level category pages
    if (url === 'https://www.trailking.com/products/') return false;
    if (url === 'https://www.trailking.com/solutions/') return false;
    if (url === 'https://www.trailking.com/solutions/open-deck-construction/') return false;
    if (url === 'https://www.trailking.com/solutions/open-deck-commercial/') return false;
    if (url === 'https://www.trailking.com/solutions/specialized/') return false;
    if (url === 'https://www.trailking.com/solutions/agriculture/') return false;
    if (url === 'https://www.trailking.com/solutions/materials-hauling/') return false;

    // Must be a sub-page under products or solutions
    const isProductPage = /\/products\/[^/]+\/$/.test(url);
    const isSolutionPage = /\/solutions\/[^/]+\/[^/]+\/$/.test(url);
    return isProductPage || isSolutionPage;
  });

  // Deduplicate by path (products and solutions may point to same product)
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
    const subtitle = document.querySelector('.entry-subtitle, .page-subtitle, h2');
    if (subtitle) {
      tagline = subtitle.textContent.trim();
    }

    // --- Description ---
    let description = '';
    let shortDescription = '';
    // Gather all paragraphs in the main content area
    const contentSelectors = [
      '.entry-content p',
      '.page-content p',
      'article p',
      'main p',
      '.content p',
      '.product-description p',
      '#content p',
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
        const valueMatch = fullText.match(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[:\\s]+(.+)', 'i'));
        if (valueMatch && key.length > 2 && key.length < 80) {
          specs.push({ rawKey: key, rawValue: valueMatch[1].trim() });
        }
      });
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
      // Only keep Trail King domain images or CDN images
      if (!src.includes('trailking.com') && !src.includes('wp-content')) return;

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

    // --- Body text for classification ---
    const bodyText = document.body ? document.body.textContent.substring(0, 5000) : '';

    return { name, tagline, description, shortDescription, specs, images, bodyText };
  });

  if (!pageData || !pageData.name) {
    console.log('    No product name found, skipping');
    return null;
  }

  console.log(`    Name: ${pageData.name}`);
  console.log(`    Specs found: ${pageData.specs.length}`);
  console.log(`    Images found: ${pageData.images.length}`);

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
    } else if (/deck|height|length|width|clearance|swing/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
    } else if (/axle|suspension|tire|wheel|brake/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    }

    specs.push({ category, key, value, unit });
  }

  return specs;
}

/**
 * Build structured product data from scraped page data.
 */
function buildProduct(pageData) {
  const { name, tagline, description, shortDescription, specs: rawSpecs, sourceUrl } = pageData;

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

  // Deck height
  let deckHeightInches = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?height|loaded.?height/i.test(rawKey)) {
      deckHeightInches = parseDeckHeight(rawValue);
      if (deckHeightInches) break;
    }
  }

  // Deck length
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

  return {
    name: cleanText(name),
    series,
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
