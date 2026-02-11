// @ts-nocheck
/**
 * Scrape E.D. Etnyre & Co. (Blackhawk) lowboy trailer product catalog
 *
 * Etnyre (etnyre.com) manufactures the Blackhawk line of lowboy trailers
 * including Mechanical Removable Gooseneck (MRG), Hydraulic Removable
 * Gooseneck (RTN), Paver Special, Extendable, and Specialty models.
 * Based in Oregon, IL, Etnyre is known for full-depth cambered I-beams,
 * 20,000 lb brake systems per axle, and adjustable 48"-56" fifth-wheel settings.
 *
 * This scraper discovers product pages from their /lowboy-trailers/ section,
 * extracts specs, images, and descriptions, and upserts them into the
 * manufacturer_products tables via shared utilities.
 *
 * Usage:  node scripts/scrape-mfr-etnyre.mjs
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

const MANUFACTURER_SLUG = 'etnyre';
const MANUFACTURER_NAME = 'E.D. Etnyre & Co.';
const WEBSITE = 'https://etnyre.com';

/** Starting pages to discover lowboy / heavy-haul products */
const SEED_URLS = [
  'https://etnyre.com/lowboy-trailers/',
  'https://etnyre.com/hydraulic-removable-gooseneck/',
  'https://etnyre.com/mechanical-removable-gooseneck/',
  'https://etnyre.com/lowboy-trailers/paver-special/',
  'https://etnyre.com/lowboy-trailers/specialty-trailers/',
];

/** Direct product pages we know about (fallbacks in case discovery misses them) */
const KNOWN_PRODUCT_PAGES = [
  // Hydraulic Removable Gooseneck (RTN) models
  'https://etnyre.com/hydraulic-removable-gooseneck/',
  'https://etnyre.com/hydraulic-removable-gooseneck/rtn35td/',
  'https://etnyre.com/hydraulic-removable-gooseneck/rtn50td/',
  'https://etnyre.com/hydraulic-removable-gooseneck/rtn55td/',
  'https://etnyre.com/hydraulic-removable-gooseneck/rtn55etd3/',
  'https://etnyre.com/hydraulic-removable-gooseneck/rtn60td/',
  'https://etnyre.com/hydraulic-removable-gooseneck/rtn65td/',
  'https://etnyre.com/hydraulic-removable-gooseneck/rtn85td/',
  // Mechanical Removable Gooseneck (MRG) models
  'https://etnyre.com/mechanical-removable-gooseneck/',
  'https://etnyre.com/mechanical-removable-gooseneck/mrg30-40/',
  'https://etnyre.com/mechanical-removable-gooseneck/mrg55/',
  // Paver Special models
  'https://etnyre.com/lowboy-trailers/paver-special/',
  'https://etnyre.com/lowboy-trailers/paver-special/ps35/',
  'https://etnyre.com/lowboy-trailers/paver-special/ps50/',
  'https://etnyre.com/lowboy-trailers/paver-special/ps55/',
  'https://etnyre.com/lowboy-trailers/paver-special/ps55e/',
  'https://etnyre.com/lowboy-trailers/paver-special/ps60/',
  // Extendable models
  'https://etnyre.com/lowboy-trailers/extendable/',
  'https://etnyre.com/lowboy-trailers/extendable/ext35/',
  'https://etnyre.com/lowboy-trailers/extendable/ext55/',
  'https://etnyre.com/lowboy-trailers/extendable/ext65/',
  // Specialty models
  'https://etnyre.com/lowboy-trailers/specialty-trailers/',
  'https://etnyre.com/lowboy-trailers/specialty-trailers/110-ton/',
];

/**
 * Keywords that signal a page is a lowboy / heavy-haul product
 * Used to filter discovered links.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'removable', 'gooseneck', 'rtn', 'mrg',
  'paver', 'extendable', 'heavy haul', 'rgn', 'detachable',
  'tonnage', 'ton', 'blackhawk', 'well deck', 'hydraulic',
  'mechanical', 'specialty', 'trailer',
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
  if (/extendable|ext\d+/i.test(text)) return 'extendable';
  if (/paver/i.test(text)) return 'lowboy';
  if (/rtn|hydraulic.?removable|hydraulic.?detach/i.test(text)) return 'lowboy';
  if (/mrg|mechanical.?removable|mechanical.?detach/i.test(text)) return 'lowboy';
  if (/well.?deck|specialty|110.?ton/i.test(text)) return 'lowboy';
  if (/double.?drop/i.test(text)) return 'double-drop';
  if (/step.?deck/i.test(text)) return 'step-deck';
  return 'lowboy'; // default for Etnyre heavy-haul
}

/**
 * Determine the gooseneck_type from product name / specs text.
 */
function classifyGooseneckType(name, specsText = '') {
  const text = `${name} ${specsText}`.toLowerCase();
  if (/mrg|mechanical.?removable|mechanical.?detach/i.test(text)) return 'mechanical-detachable';
  if (/rtn|hydraulic.?removable|hydraulic.?detach/i.test(text)) return 'hydraulic-detachable';
  if (/non.?ground.?bearing/i.test(text)) return 'non-ground-bearing';
  if (/detach/i.test(text)) return 'detachable';
  if (/fixed/i.test(text)) return 'fixed';
  return null;
}

/**
 * Detect series from the product name / URL.
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toUpperCase();
  if (/RTN\d+/i.test(text)) return 'RTN';
  if (/MRG/i.test(text)) return 'MRG';
  if (/PS\d+|PAVER.?SPECIAL/i.test(text)) return 'Paver Special';
  if (/EXT\d+|EXTENDABLE/i.test(text)) return 'Extendable';
  if (/110.?TON|WELL.?DECK|SPECIALTY/i.test(text)) return 'Specialty';
  if (/HYDRAULIC.?REMOVABLE/i.test(text)) return 'RTN';
  if (/MECHANICAL.?REMOVABLE/i.test(text)) return 'MRG';
  return null;
}

/**
 * Extract model number from a product name or URL.
 * E.g. "RTN35TD" or "MRG55" or "PS55E" or "EXT65"
 */
function extractModelNumber(name, url = '') {
  const text = `${name} ${url}`.toUpperCase();
  // Match RTN models: RTN35TD, RTN55ETD3, etc.
  const rtnMatch = text.match(/RTN\d+[A-Z0-9]*/);
  if (rtnMatch) return rtnMatch[0];
  // Match MRG models: MRG30-40, MRG55
  const mrgMatch = text.match(/MRG\d+[-\d]*/);
  if (mrgMatch) return mrgMatch[0];
  // Match Paver Special models: PS35, PS55E
  const psMatch = text.match(/PS\d+[A-Z]*/);
  if (psMatch) return psMatch[0];
  // Match Extendable models: EXT35, EXT65
  const extMatch = text.match(/EXT\d+/);
  if (extMatch) return extMatch[0];
  // Match standalone tonnage patterns in product names like "110 Ton"
  const tonMatch = text.match(/(\d+)\s*[-]?\s*TON/);
  if (tonMatch) return `${tonMatch[1]}-TON`;
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
 * Parse MSRP range from known model pricing.
 * Returns { low, high } or { low: null, high: null }.
 */
function estimateMsrp(modelNumber) {
  if (!modelNumber) return { low: null, high: null };
  const model = modelNumber.toUpperCase();
  if (model.includes('RTN35TD')) return { low: 90000, high: 114000 };
  if (model.includes('RTN55ETD3')) return { low: 165000, high: 180000 };
  return { low: null, high: null };
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
          // Only keep links on etnyre.com
          if (fullUrl.includes('etnyre.com')) {
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
  KNOWN_PRODUCT_PAGES.forEach((url) => {
    allLinks.add(url.replace(/\/$/, '') + '/');
  });

  // Filter to relevant lowboy / heavy-haul product pages
  const filtered = [...allLinks].filter((url) => {
    const urlLower = url.toLowerCase();

    // Must be related to lowboy / trailer products
    const isRelevant =
      urlLower.includes('/lowboy-trailers/') ||
      urlLower.includes('/hydraulic-removable-gooseneck/') ||
      urlLower.includes('/mechanical-removable-gooseneck/') ||
      urlLower.includes('/rtn') ||
      urlLower.includes('/mrg') ||
      urlLower.includes('/paver') ||
      urlLower.includes('/extendable') ||
      urlLower.includes('/specialty');

    if (!isRelevant) return false;

    // Skip top-level category pages that are too broad (only if they have sub-pages)
    // We want to keep category pages that ARE product pages (e.g. /hydraulic-removable-gooseneck/)
    // but skip the very top /lowboy-trailers/ page
    if (url === 'https://etnyre.com/lowboy-trailers/') return false;

    // Skip non-product pages
    if (urlLower.includes('/contact') || urlLower.includes('/about')) return false;
    if (urlLower.includes('/news') || urlLower.includes('/blog')) return false;
    if (urlLower.includes('/careers') || urlLower.includes('/dealers')) return false;
    if (urlLower.includes('.pdf') || urlLower.includes('.jpg')) return false;

    return true;
  });

  // Deduplicate
  const unique = [...new Set(filtered)];
  console.log(`\n  Discovered ${unique.length} candidate product pages`);
  return unique;
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
      '.entry-subtitle, .page-subtitle, .hero-subtitle, h2'
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
      'article p',
      'main p',
      '.content p',
      '.product-description p',
      '#content p',
      '.wp-block-column p',
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

    // --- Features list ---
    const features = [];
    document.querySelectorAll('ul li, ol li').forEach((li) => {
      const t = li.textContent.trim();
      if (t.length > 10 && t.length < 300) {
        features.push(t);
      }
    });
    if (features.length > 0 && !description) {
      description = features.join('\n');
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

    // --- Images ---
    const images = [];
    const seenUrls = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src =
        img.src ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-lazy-src');
      if (!src) return;
      // Skip tiny icons, logos, etc.
      if (src.includes('logo') || src.includes('icon') || src.includes('favicon')) return;
      if (src.includes('.gif') || src.includes('.svg')) return;
      if (src.includes('gravatar') || src.includes('wp-content/plugins')) return;
      // Only keep Etnyre domain images or CDN images
      if (!src.includes('etnyre.com') && !src.includes('wp-content')) return;

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
  console.log(`    Images found: ${pageData.images.length}`);
  console.log(`    Features found: ${pageData.features?.length || 0}`);

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
    } else if (/deck|height|length|width|clearance|swing|loading.?angle/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
      else if (/degree/i.test(value)) unit = 'degrees';
    } else if (/axle|suspension|tire|wheel|brake/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch|fifth.?wheel/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural|i-beam|cambered/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    } else if (/outrigger|ramp|swing/i.test(keyLower)) {
      category = 'Accessories';
    } else if (/extend|retract/i.test(keyLower)) {
      category = 'Extension';
    }

    specs.push({ category, key, value, unit });
  }

  return specs;
}

/**
 * Build key features as additional spec entries for Etnyre products.
 * Etnyre/Blackhawk trailers have well-known features that may not appear
 * in the scraped specs but should be recorded.
 */
function buildEtnyreFeatureSpecs(name, description, existingSpecs) {
  const featureSpecs = [];
  const combined = `${name} ${description}`.toLowerCase();
  const existingKeys = new Set(existingSpecs.map((s) => s.key.toLowerCase()));

  // Cambered I-beams
  if (combined.includes('cambered') || combined.includes('i-beam')) {
    if (!existingKeys.has('frame construction')) {
      featureSpecs.push({
        category: 'Frame',
        key: 'Frame Construction',
        value: 'Full-depth cambered I-beams',
        unit: null,
      });
    }
  }

  // Brake system
  if (combined.includes('20,000') && combined.includes('brake')) {
    if (!existingKeys.has('brake system')) {
      featureSpecs.push({
        category: 'Running Gear',
        key: 'Brake System',
        value: '20,000 lb per axle',
        unit: 'lbs',
      });
    }
  }

  // Outriggers
  if (combined.includes('outrigger')) {
    if (!existingKeys.has('outriggers')) {
      featureSpecs.push({
        category: 'Accessories',
        key: 'Outriggers',
        value: 'Swing/removable outriggers',
        unit: null,
      });
    }
  }

  // Fifth-wheel adjustment
  if (combined.includes('48') && combined.includes('56')) {
    if (!existingKeys.has('fifth-wheel settings')) {
      featureSpecs.push({
        category: 'Gooseneck',
        key: 'Fifth-Wheel Settings',
        value: 'Adjustable 48"-56"',
        unit: 'in',
      });
    }
  }

  // Loading angle (Paver Special)
  if (combined.includes('18') && combined.includes('degree') && combined.includes('loading')) {
    if (!existingKeys.has('loading angle')) {
      featureSpecs.push({
        category: 'Dimensions',
        key: 'Loading Angle',
        value: '18 degrees',
        unit: 'degrees',
      });
    }
  }

  return featureSpecs;
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
      if (t.min) {
        tonnageMin = t.min;
        tonnageMax = t.max;
        break;
      }
    }
  }
  // Fallback: search combined text for tonnage
  if (!tonnageMin) {
    const tonMatch = combinedText.match(/(\d+)\s*[-–]?\s*(?:to\s*)?(\d+)?\s*ton/i);
    if (tonMatch) {
      tonnageMin = parseInt(tonMatch[1], 10);
      tonnageMax = tonMatch[2] ? parseInt(tonMatch[2], 10) : tonnageMin;
    }
  }
  // Fallback: extract tonnage from model number (e.g., RTN35TD -> 35, MRG30-40 -> 30-40)
  if (!tonnageMin) {
    const modelTon = name.match(/(?:RTN|MRG|PS|EXT)(\d+)/i);
    if (modelTon) {
      tonnageMin = parseInt(modelTon[1], 10);
      tonnageMax = tonnageMin;
    }
    // Handle MRG30-40 range
    const rangeTon = name.match(/MRG(\d+)\s*[-–]\s*(\d+)/i);
    if (rangeTon) {
      tonnageMin = parseInt(rangeTon[1], 10);
      tonnageMax = parseInt(rangeTon[2], 10);
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

  const modelNumber = extractModelNumber(name, sourceUrl);
  const series = detectSeries(name, sourceUrl);
  const productType = classifyProductType(name, description);
  const gooseneckType = classifyGooseneckType(name, allSpecText);
  const msrp = estimateMsrp(modelNumber);

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
    msrp_low: msrp.low,
    msrp_high: msrp.high,
    source_url: sourceUrl,
  };
}

/**
 * Build images array for upsertProductImages.
 */
function buildImages(pageData) {
  return pageData.images.map((img) => ({
    url: img.url,
    alt_text: img.alt || `${pageData.name} Blackhawk lowboy trailer`,
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
        const baseSpecs = categorizeSpecs(pageData.specs);
        // Enrich with known Etnyre/Blackhawk feature specs
        const featureSpecs = buildEtnyreFeatureSpecs(
          product.name,
          product.description || '',
          baseSpecs
        );
        const specs = [...baseSpecs, ...featureSpecs];

        console.log(`    Product type: ${product.product_type}`);
        console.log(`    Series: ${product.series || 'N/A'}`);
        console.log(`    Model: ${product.model_number || 'N/A'}`);
        console.log(`    Tonnage: ${product.tonnage_min || '?'}-${product.tonnage_max || '?'} ton`);
        console.log(`    Gooseneck: ${product.gooseneck_type || 'N/A'}`);
        console.log(`    Specs: ${specs.length}, Images: ${images.length}`);
        if (product.msrp_low) {
          console.log(`    MSRP: $${product.msrp_low.toLocaleString()}-$${product.msrp_high.toLocaleString()}`);
        }

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
