// @ts-nocheck
/**
 * Scrape Eager Beaver Trailers lowboy product catalog
 *
 * Eager Beaver (eagerbeavertrailers.com) has manufactured heavy-haul lowboy
 * trailers since 1946. They produce GLB (Fixed Ground-Level-Bearing gooseneck)
 * and GSL (Hydraulic detachable non-ground-bearing) series lowboys in tonnages
 * from 25 to 70 tons, including standard, paver, and oilfield variants.
 *
 * Naming convention: [tonnage] + [gooseneck type] + [suffix]
 *   GLB = Fixed Ground-Level-Bearing gooseneck
 *   GSL = Hydraulic detachable non-ground-bearing
 *   Suffixes: -S (standard), -S4S (basic economical), -BR (standard hydraulic),
 *             -PT (Pass-Through premium), -3 (3-axle), -L (light)
 *
 * This scraper discovers product pages from their /product-category/ sections,
 * extracts specs, images, and descriptions, and upserts them into the
 * manufacturer_products tables via shared utilities.
 *
 * Usage:  node scripts/scrape-mfr-eager-beaver.mjs
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

const MANUFACTURER_SLUG = 'eager-beaver';
const MANUFACTURER_NAME = 'Eager Beaver Trailers';
const WEBSITE = 'https://www.eagerbeavertrailers.com';

/** Starting pages to discover lowboy / heavy-haul products */
const SEED_URLS = [
  'https://www.eagerbeavertrailers.com/product-category/lowboys/',
  'https://www.eagerbeavertrailers.com/product-category/paver-trailer-lowboys/',
  'https://www.eagerbeavertrailers.com/product-category/oilfield-lowboys/',
  'https://www.eagerbeavertrailers.com/products/specifications/',
];

/** Direct product pages we know about (fallbacks in case discovery misses them) */
const KNOWN_PRODUCT_PAGES = [
  // Standard lowboys
  'https://www.eagerbeavertrailers.com/products/lowboys/25-glb-l/',
  'https://www.eagerbeavertrailers.com/products/lowboys/35-glb/',
  'https://www.eagerbeavertrailers.com/products/lowboys/35-gsl-s4s/',
  'https://www.eagerbeavertrailers.com/products/lowboys/35-gsl-s/',
  'https://www.eagerbeavertrailers.com/products/lowboys/35-gsl-br/',
  'https://www.eagerbeavertrailers.com/products/lowboys/35-gsl-pt/',
  'https://www.eagerbeavertrailers.com/products/lowboys/50-glb/',
  'https://www.eagerbeavertrailers.com/products/lowboys/50-gsl-br/',
  'https://www.eagerbeavertrailers.com/products/lowboys/50-gsl-3/',
  'https://www.eagerbeavertrailers.com/products/lowboys/50-gsl-pt/',
  'https://www.eagerbeavertrailers.com/products/lowboys/55-gsl-3/',
  'https://www.eagerbeavertrailers.com/products/lowboys/55-gsl-pt/',
  'https://www.eagerbeavertrailers.com/products/lowboys/60-gsl-3/',
  'https://www.eagerbeavertrailers.com/products/lowboys/65-gsl-3/',
  // Paver trailer lowboys
  'https://www.eagerbeavertrailers.com/product-category/paver-trailer-lowboys/',
  // Oilfield lowboys
  'https://www.eagerbeavertrailers.com/products/oilfield-lowboys/70-glb-5/',
];

/**
 * Known model data for enrichment when scraping fails to extract specs.
 * Maps model slug to known specs.
 */
const KNOWN_MODEL_DATA = {
  '25-glb-l':  { tonnageMin: 25, tonnageMax: 25, capacityLbs: 50000, gooseneckType: 'fixed', axleCount: 2 },
  '35-glb':    { tonnageMin: 35, tonnageMax: 35, capacityLbs: 70000, gooseneckType: 'fixed', axleCount: 2 },
  '35-gsl-s4s':{ tonnageMin: 35, tonnageMax: 35, capacityLbs: 70000, gooseneckType: 'hydraulic-detachable', axleCount: 2 },
  '35-gsl-s':  { tonnageMin: 35, tonnageMax: 35, capacityLbs: 70000, gooseneckType: 'hydraulic-detachable', axleCount: 2 },
  '35-gsl-br': { tonnageMin: 35, tonnageMax: 35, capacityLbs: 70000, gooseneckType: 'hydraulic-detachable', axleCount: 2 },
  '35-gsl-pt': { tonnageMin: 35, tonnageMax: 35, capacityLbs: 70000, gooseneckType: 'hydraulic-detachable', axleCount: 2 },
  '50-glb':    { tonnageMin: 50, tonnageMax: 50, capacityLbs: 100000, gooseneckType: 'fixed', axleCount: 2 },
  '50-gsl-br': { tonnageMin: 50, tonnageMax: 50, capacityLbs: 100000, gooseneckType: 'hydraulic-detachable', axleCount: 2 },
  '50-gsl-3':  { tonnageMin: 50, tonnageMax: 50, capacityLbs: 100000, gooseneckType: 'hydraulic-detachable', axleCount: 3 },
  '50-gsl-pt': { tonnageMin: 50, tonnageMax: 50, capacityLbs: 100000, gooseneckType: 'hydraulic-detachable', axleCount: 3, emptyWeightLbs: 22700 },
  '55-gsl-3':  { tonnageMin: 55, tonnageMax: 55, capacityLbs: 110000, gooseneckType: 'hydraulic-detachable', axleCount: 3 },
  '55-gsl-pt': { tonnageMin: 55, tonnageMax: 55, capacityLbs: 110000, gooseneckType: 'hydraulic-detachable', axleCount: 3 },
  '60-gsl-3':  { tonnageMin: 60, tonnageMax: 60, capacityLbs: 120000, gooseneckType: 'hydraulic-detachable', axleCount: 3 },
  '65-gsl-3':  { tonnageMin: 65, tonnageMax: 65, capacityLbs: 130000, gooseneckType: 'hydraulic-detachable', axleCount: 3 },
  '70-glb-5':  { tonnageMin: 70, tonnageMax: 70, capacityLbs: 140000, gooseneckType: 'fixed', axleCount: 5 },
};

/**
 * Keywords that signal a page is a lowboy / heavy-haul product.
 * Used to filter discovered links.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'glb', 'gsl', 'detachable', 'gooseneck',
  'heavy haul', 'paver', 'oilfield', 'ground level', 'ton',
  'hydraulic', 'trailer', 'pass-through', 'pass through',
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
 * For Eager Beaver, virtually all products are lowboys.
 */
function classifyProductType(name, description = '') {
  const text = `${name} ${description}`.toLowerCase();
  // Eager Beaver exclusively makes lowboys - all GLB and GSL models are lowboys
  if (/oilfield/i.test(text)) return 'lowboy';
  if (/paver/i.test(text)) return 'lowboy';
  if (/glb|gsl|lowboy|low.?boy/i.test(text)) return 'lowboy';
  if (/rgn|detachable.?gooseneck/i.test(text)) return 'rgn';
  if (/double.?drop/i.test(text)) return 'double-drop';
  return 'lowboy'; // default for Eager Beaver
}

/**
 * Determine the gooseneck_type from product name / specs text.
 *   GLB = Fixed Ground-Level-Bearing gooseneck
 *   GSL = Hydraulic detachable non-ground-bearing
 */
function classifyGooseneckType(name, specsText = '') {
  const text = `${name} ${specsText}`.toUpperCase();
  // GLB models are fixed gooseneck
  if (/\bGLB\b/.test(text)) return 'fixed';
  // GSL models are hydraulic detachable
  if (/\bGSL\b/.test(text)) return 'hydraulic-detachable';
  // Fallback to text analysis
  const lower = text.toLowerCase();
  if (/hydraulic.?detach/.test(lower)) return 'hydraulic-detachable';
  if (/detach/.test(lower)) return 'detachable';
  if (/fixed/.test(lower)) return 'fixed';
  return null;
}

/**
 * Detect series from the product name / URL.
 * Eager Beaver series are GLB (fixed) and GSL (hydraulic detachable).
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toUpperCase();
  if (/\bGLB\b/.test(text)) return 'GLB';
  if (/\bGSL\b/.test(text)) return 'GSL';
  return null;
}

/**
 * Detect the suffix/variant from the product name.
 *   -S (standard), -S4S (basic economical), -BR (standard hydraulic),
 *   -PT (Pass-Through premium), -3 (3-axle), -L (light)
 */
function detectVariant(name) {
  const text = name.toUpperCase();
  if (/\bPT\b|-PT\b/.test(text)) return 'PT';
  if (/\bS4S\b|-S4S\b/.test(text)) return 'S4S';
  if (/\bBR\b|-BR\b|\/BR\b/.test(text)) return 'BR';
  if (/-S\b/.test(text)) return 'S';
  if (/-L\b/.test(text)) return 'L';
  if (/-3\b/.test(text)) return '3';
  if (/-5\b/.test(text)) return '5';
  return null;
}

/**
 * Extract the model number from a product name.
 * E.g. "50 GSL-3" -> "50 GSL-3", "35 GSL-PT" -> "35 GSL-PT"
 */
function extractModelNumber(name) {
  const text = name.toUpperCase().trim();
  // Match patterns like "50 GSL-3", "35 GLB", "25 GLB-L", "70 GLB-5", "50 GSL/BR"
  const match = text.match(/(\d+)\s*(GLB|GSL)[-/]?([A-Z0-9]*)/);
  if (match) {
    const tonnage = match[1];
    const series = match[2];
    const suffix = match[3] ? `-${match[3]}` : '';
    return `${tonnage} ${series}${suffix}`;
  }
  return null;
}

/**
 * Extract model slug from the source URL for known-data lookups.
 * E.g. "https://...eagerbeavertrailers.com/products/lowboys/50-gsl-3/" -> "50-gsl-3"
 */
function extractModelSlugFromUrl(url) {
  // Match the last path segment before trailing slash
  const match = url.match(/\/(\d+-(?:glb|gsl)[a-z0-9-]*)\/?$/i);
  if (match) return match[1].toLowerCase();
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

/**
 * Extract tonnage from model name (e.g. "50 GSL-3" -> 50).
 */
function extractTonnageFromName(name) {
  const match = name.match(/^(\d+)\s*(GLB|GSL)/i);
  if (match) return parseInt(match[1], 10);
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
          // Only keep links on eagerbeavertrailers.com under /products/ or /product-category/
          if (
            fullUrl.includes('eagerbeavertrailers.com') &&
            (fullUrl.includes('/products/') || fullUrl.includes('/product-category/'))
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

  // Filter to just individual product detail pages (not top-level category pages)
  const filtered = [...allLinks].filter((url) => {
    // Skip top-level category pages (we want individual product pages)
    if (url === 'https://www.eagerbeavertrailers.com/products/') return false;
    if (url === 'https://www.eagerbeavertrailers.com/product-category/lowboys/') return false;
    if (url === 'https://www.eagerbeavertrailers.com/product-category/paver-trailer-lowboys/') return false;
    if (url === 'https://www.eagerbeavertrailers.com/product-category/oilfield-lowboys/') return false;
    if (url === 'https://www.eagerbeavertrailers.com/products/specifications/') return false;

    // Must be a product sub-page (e.g. /products/lowboys/50-gsl-3/)
    const isProductPage = /\/products\/[^/]+\/[^/]+\/$/.test(url);
    return isProductPage;
  });

  // Deduplicate
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
    const subtitle = document.querySelector('.entry-subtitle, .page-subtitle, .product-tagline, h2');
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
      '.product-description p',
      'article p',
      'main p',
      '.content p',
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

    // --- Feature lists (Eager Beaver often uses bullet lists for features) ---
    const features = [];
    document.querySelectorAll('.entry-content li, .product-features li, article li, main li').forEach((li) => {
      const text = li.textContent.trim();
      if (text.length > 5 && text.length < 300) {
        features.push(text);
      }
    });

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

    // Look for spec-like key/value pairs in list items
    document.querySelectorAll('li, .spec-item, .feature-item').forEach((li) => {
      const text = li.textContent.trim();
      // Patterns like "Capacity: 110,000 lbs" or "Deck Height: 18""
      const kvMatch = text.match(/^([^:]{3,50}):\s*(.+)$/);
      if (kvMatch) {
        specs.push({ rawKey: kvMatch[1].trim(), rawValue: kvMatch[2].trim() });
      }
    });

    // Look for strong/b tags followed by text (common spec format)
    document.querySelectorAll('p, div').forEach((el) => {
      const strongs = el.querySelectorAll('strong, b');
      strongs.forEach((strong) => {
        const key = strong.textContent.trim().replace(/:$/, '');
        const fullText = el.textContent.trim();
        const valueMatch = fullText.match(
          new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[:\\s]+(.+)', 'i')
        );
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
      // Only keep Eager Beaver domain images or CDN images
      if (!src.includes('eagerbeavertrailers.com') && !src.includes('wp-content')) return;

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

    return { name, tagline, description, shortDescription, features, specs, images, bodyText };
  });

  if (!pageData || !pageData.name) {
    console.log('    No product name found, skipping');
    return null;
  }

  console.log(`    Name: ${pageData.name}`);
  console.log(`    Specs found: ${pageData.specs.length}`);
  console.log(`    Features found: ${pageData.features.length}`);
  console.log(`    Images found: ${pageData.images.length}`);

  return { ...pageData, sourceUrl: url };
}

/**
 * Categorize raw specs into structured spec objects.
 */
function categorizeSpecs(rawSpecs, features = []) {
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
    } else if (/axle|suspension|tire|wheel|brake|cush.?air/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform|oak|decking/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness|led/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural|crossmember|mainrail/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    }

    specs.push({ category, key, value, unit });
  }

  // Add notable features as specs in the "Features" category
  for (const feature of features) {
    const dedup = `Feature|${feature}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    // Only add substantial features (skip if already captured as a key-value spec)
    if (feature.includes(':')) continue; // already captured above
    if (feature.length < 10) continue;

    specs.push({ category: 'Features', key: 'Feature', value: feature, unit: null });
  }

  return specs;
}

/**
 * Build structured product data from scraped page data.
 */
function buildProduct(pageData) {
  const { name, tagline, description, shortDescription, features, specs: rawSpecs, sourceUrl } = pageData;

  // Combine all spec values for searching
  const allSpecText = rawSpecs.map((s) => `${s.rawKey}: ${s.rawValue}`).join(' ');
  const combinedText = `${name} ${description} ${allSpecText}`;

  // Try to look up known model data for enrichment
  const modelSlug = extractModelSlugFromUrl(sourceUrl);
  const knownData = modelSlug ? KNOWN_MODEL_DATA[modelSlug] || null : null;

  // Tonnage — extract from model name first, then specs, then known data
  let tonnageMin = null;
  let tonnageMax = null;

  const nameTonnage = extractTonnageFromName(name);
  if (nameTonnage) {
    tonnageMin = nameTonnage;
    tonnageMax = nameTonnage;
  }

  if (!tonnageMin) {
    for (const { rawKey, rawValue } of rawSpecs) {
      if (/capacity|tonnage|ton|payload/i.test(rawKey)) {
        const t = parseTonnage(rawValue);
        if (t.min) { tonnageMin = t.min; tonnageMax = t.max; break; }
      }
    }
  }

  // Fallback: search description for tonnage
  if (!tonnageMin) {
    const tonMatch = combinedText.match(/(\d+)\s*[-\u2013]?\s*(?:to\s*)?(\d+)?\s*ton/i);
    if (tonMatch) {
      tonnageMin = parseInt(tonMatch[1], 10);
      tonnageMax = tonMatch[2] ? parseInt(tonMatch[2], 10) : tonnageMin;
    }
  }

  // Fallback to known data
  if (!tonnageMin && knownData) {
    tonnageMin = knownData.tonnageMin;
    tonnageMax = knownData.tonnageMax;
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

  // Axle count — try from specs, model name suffix, or known data
  let axleCount = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/axle/i.test(rawKey)) {
      axleCount = parseAxleCount(rawValue);
      if (axleCount) break;
    }
  }
  // Infer from model suffix: -3 means 3-axle, -5 means 5-axle
  if (!axleCount) {
    const suffixMatch = name.match(/-(\d)\s*$/);
    if (suffixMatch) {
      axleCount = parseInt(suffixMatch[1], 10);
    }
  }
  // Default tandem for models without an axle suffix
  if (!axleCount && knownData) {
    axleCount = knownData.axleCount;
  }

  // Empty weight
  let emptyWeightLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/empty.?weight|tare.?weight|unladen|trailer.?weight/i.test(rawKey)) {
      emptyWeightLbs = parseWeight(rawValue);
      if (emptyWeightLbs) break;
    }
  }
  if (!emptyWeightLbs && knownData && knownData.emptyWeightLbs) {
    emptyWeightLbs = knownData.emptyWeightLbs;
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
    if (/concentrated|max.?payload|capacity.*lbs|rated.?capacity/i.test(rawKey)) {
      concentratedCapacityLbs = parseWeight(rawValue);
      if (concentratedCapacityLbs) break;
    }
  }
  // Fallback to known capacity data
  if (!concentratedCapacityLbs && knownData && knownData.capacityLbs) {
    concentratedCapacityLbs = knownData.capacityLbs;
  }

  const series = detectSeries(name, sourceUrl);
  const variant = detectVariant(name);
  const modelNumber = extractModelNumber(name);
  const productType = classifyProductType(name, description);
  let gooseneckType = classifyGooseneckType(name, allSpecText);

  // Fallback gooseneck type from known data
  if (!gooseneckType && knownData) {
    gooseneckType = knownData.gooseneckType;
  }

  // Build a meaningful tagline if one is not found
  let effectiveTagline = cleanText(tagline) || null;
  if (!effectiveTagline && series && tonnageMin) {
    const seriesDesc = series === 'GLB'
      ? 'Fixed Ground-Level-Bearing Gooseneck'
      : 'Hydraulic Detachable Non-Ground-Bearing';
    effectiveTagline = `${tonnageMin}-Ton ${seriesDesc} Lowboy Trailer`;
  }

  // Build enhanced description including Eager Beaver signature features
  let effectiveDescription = cleanText(description) || null;
  if (!effectiveDescription && features && features.length > 0) {
    effectiveDescription = features.join('. ') + '.';
  }

  return {
    name: cleanText(name),
    series,
    model_number: modelNumber,
    tagline: effectiveTagline,
    description: effectiveDescription,
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
    alt_text: img.alt || `${pageData.name} Eager Beaver lowboy trailer`,
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
        const specs = categorizeSpecs(pageData.specs, pageData.features);

        console.log(`    Product type: ${product.product_type}`);
        console.log(`    Series: ${product.series || 'N/A'}`);
        console.log(`    Variant: ${detectVariant(pageData.name) || 'N/A'}`);
        console.log(`    Model: ${product.model_number || 'N/A'}`);
        console.log(`    Tonnage: ${product.tonnage_min || '?'}-${product.tonnage_max || '?'} ton`);
        console.log(`    Gooseneck: ${product.gooseneck_type || 'N/A'}`);
        console.log(`    Axles: ${product.axle_count || 'N/A'}`);
        console.log(`    Capacity: ${product.concentrated_capacity_lbs ? product.concentrated_capacity_lbs.toLocaleString() + ' lbs' : 'N/A'}`);
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
