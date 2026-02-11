// @ts-nocheck
/**
 * Scrape Faymonville Group / MAX Trailer lowboy/heavy-haul product catalog
 *
 * Faymonville (faymonville.com) is a Belgian manufacturer (founded 1958,
 * Lentzweiler) of heavy-haul trailers expanding into the North American
 * market under the MAX Trailer brand (maxtrailer.us). Product lines include
 * HighwayMAX, MultiMAX, MegaMAX, DualMAX, CombiMAX, VarioMAX, CargoMAX,
 * and ModulMAX.
 *
 * This scraper discovers product pages from maxtrailer.us, faymonville.com,
 * and the Hale Trailer dealer pages (haletrailer.com/faymonville/), extracts
 * specs, images, and descriptions, and upserts them into the
 * manufacturer_products tables via shared utilities.
 *
 * Usage:  node scripts/scrape-mfr-faymonville.mjs
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

const MANUFACTURER_SLUG = 'faymonville';
const MANUFACTURER_NAME = 'Faymonville Group';
const WEBSITE = 'https://www.faymonville.com';

/** Starting pages to discover lowboy / heavy-haul products */
const SEED_URLS = [
  // MAX Trailer (North American site)
  'https://www.maxtrailer.us/',
  'https://www.maxtrailer.us/brands',
  // Faymonville main European site
  'https://www.faymonville.com/en/',
  'https://www.faymonville.com/en/products/',
  // Hale Trailer (major US dealer with good spec pages)
  'https://haletrailer.com/faymonville/',
];

/** Direct product pages we know about (fallbacks in case discovery misses them) */
const KNOWN_PRODUCT_PAGES = [
  // MAX Trailer US site
  'https://www.maxtrailer.us/highwaymax',
  'https://www.maxtrailer.us/multimax',
  'https://www.maxtrailer.us/megamax',
  'https://www.maxtrailer.us/dualmax',
  // Faymonville main site
  'https://www.faymonville.com/en/products/combimax/',
  'https://www.faymonville.com/en/products/variomax/',
  'https://www.faymonville.com/en/products/variomax-plus/',
  'https://www.faymonville.com/en/products/cargomax/',
  'https://www.faymonville.com/en/products/modulmax/',
  'https://www.faymonville.com/en/products/megamax/',
  'https://www.faymonville.com/en/products/multimax/',
  'https://www.faymonville.com/en/products/highwaymax/',
  'https://www.faymonville.com/en/products/dualmax/',
  // Hale Trailer dealer pages (often have detailed specs)
  'https://haletrailer.com/faymonville/highwaymax/',
  'https://haletrailer.com/faymonville/multimax/',
  'https://haletrailer.com/faymonville/megamax/',
];

/**
 * Product line definitions with hardcoded fallback specs.
 * These are used both for classification and as fallback data when
 * scraping yields incomplete results.
 */
const PRODUCT_LINES = {
  highwaymax: {
    name: 'HighwayMAX',
    series: 'HighwayMAX',
    product_type: 'lowboy',
    gooseneck_type: 'hydraulic-detachable',
    tagline: '9-axle heavy haul trailer for North American highways',
    short_description:
      'The HighwayMAX is a 9-axle heavy haul lowboy designed for North American legal loads of 174,000+ lbs (87 tons) with a technical rating of 249,000+ lbs. Features 20,000 lbs/axle capacity and up to 22\'6" adjustable axle spacing.',
    tonnage_min: 87,
    tonnage_max: 125,
    axle_count: 9,
    concentrated_capacity_lbs: 249000,
  },
  multimax: {
    name: 'MultiMAX',
    series: 'MultiMAX',
    product_type: 'extendable',
    gooseneck_type: 'hydraulic-detachable',
    tagline: 'Extendable flatbed/step deck with hydraulic gooseneck',
    short_description:
      'The MultiMAX is an extendable flatbed/step deck trailer rated up to 120,000 lbs (60 tons). Well extends to 77\' plus 13\' gooseneck. Features air ride suspension, hydraulic gooseneck, and liftable axles 1-3.',
    tonnage_min: 40,
    tonnage_max: 60,
    concentrated_capacity_lbs: 120000,
  },
  megamax: {
    name: 'MegaMAX',
    series: 'MegaMAX',
    product_type: 'double-drop',
    gooseneck_type: 'hydraulic-detachable',
    tagline: 'Ultra-low double-drop with one of the lowest deck heights in the industry',
    short_description:
      'The MegaMAX is an ultra-low double-drop trailer with a 13.8" deck height - one of the lowest in the industry. Features a steerable 4th pin-on flip axle option and hydraulic liftable/detachable gooseneck.',
    deck_height_inches: 13.8,
    tonnage_min: 40,
    tonnage_max: 80,
  },
  dualmax: {
    name: 'DualMAX',
    series: 'DualMAX',
    product_type: 'modular',
    gooseneck_type: 'other',
    tagline: 'Dual-lane heavy modular trailer for North American market',
    short_description:
      'The DualMAX is a dual-lane heavy modular trailer with width adjustable from 14\' to 21\', designed specifically for the North American heavy haul market.',
    tonnage_min: 80,
    tonnage_max: 200,
  },
  combimax: {
    name: 'CombiMAX',
    series: 'CombiMAX',
    product_type: 'modular',
    gooseneck_type: 'other',
    tagline: 'Modular lowloader system with universal coupling',
    short_description:
      'The CombiMAX is a modular lowloader rated 50-250 tonnes. Features universal coupling and telescopic Add-On Beam for maximum load flexibility.',
    tonnage_min: 50,
    tonnage_max: 250,
  },
  variomax: {
    name: 'VarioMAX',
    series: 'VarioMAX',
    product_type: 'lowboy',
    gooseneck_type: 'hydraulic-detachable',
    tagline: 'Lowbed with removable pendle-axle bogie',
    short_description:
      'The VarioMAX is a lowbed trailer with removable 1-4 pendle-axle bogie. The VarioMAX Plus variant handles up to 105 tonnes at 12 tonnes per axle.',
    tonnage_min: 40,
    tonnage_max: 105,
  },
  'variomax-plus': {
    name: 'VarioMAX Plus',
    series: 'VarioMAX',
    product_type: 'lowboy',
    gooseneck_type: 'hydraulic-detachable',
    tagline: 'Enhanced lowbed with higher axle ratings',
    short_description:
      'The VarioMAX Plus is an enhanced lowbed trailer rated up to 105 tonnes at 12 tonnes per axle, with removable 1-4 pendle-axle bogie for maximum configurability.',
    tonnage_min: 60,
    tonnage_max: 105,
  },
  cargomax: {
    name: 'CargoMAX',
    series: 'CargoMAX',
    product_type: 'flatbed',
    gooseneck_type: 'fixed',
    tagline: 'Flatbed for crane components and heavy cargo',
    short_description:
      'The CargoMAX is a heavy-duty flatbed trailer with 3-8 axles, designed for transporting crane components and other heavy indivisible loads.',
    tonnage_min: 40,
    tonnage_max: 150,
  },
  modulmax: {
    name: 'ModulMAX',
    series: 'ModulMAX',
    product_type: 'modular',
    gooseneck_type: 'other',
    tagline: 'Heavy modular transporter for super-heavy loads',
    short_description:
      'The ModulMAX is a heavy modular transporter combinable up to 5,000 tonnes. Each module has 2-6 axle lines at 45 tonnes per axle line for extreme heavy haul applications.',
    tonnage_min: 100,
    tonnage_max: 5000,
  },
};

/**
 * Keywords used to identify relevant product links during discovery.
 */
const PRODUCT_KEYWORDS = [
  'highwaymax', 'highway-max', 'highway max',
  'multimax', 'multi-max', 'multi max',
  'megamax', 'mega-max', 'mega max',
  'dualmax', 'dual-max', 'dual max',
  'combimax', 'combi-max', 'combi max',
  'variomax', 'vario-max', 'vario max',
  'cargomax', 'cargo-max', 'cargo max',
  'modulmax', 'modul-max', 'modul max',
  'lowboy', 'lowbed', 'low loader', 'lowloader',
  'heavy haul', 'modular', 'double drop', 'double-drop',
  'extendable', 'flatbed', 'gooseneck',
];

/** Delay between page loads (ms) */
const PAGE_DELAY_MIN = 2500;
const PAGE_DELAY_MAX = 4000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomDelay() {
  return PAGE_DELAY_MIN + Math.random() * (PAGE_DELAY_MAX - PAGE_DELAY_MIN);
}

/**
 * Identify which product line a URL or product name belongs to.
 * Returns the key into PRODUCT_LINES or null.
 */
function identifyProductLine(text) {
  const lower = text.toLowerCase().replace(/[-_\s]+/g, '');
  if (/highwaymax/.test(lower)) return 'highwaymax';
  if (/multimax/.test(lower)) return 'multimax';
  if (/megamax/.test(lower)) return 'megamax';
  if (/dualmax/.test(lower)) return 'dualmax';
  if (/combimax/.test(lower)) return 'combimax';
  if (/variomaxplus/.test(lower)) return 'variomax-plus';
  if (/variomax/.test(lower)) return 'variomax';
  if (/cargomax/.test(lower)) return 'cargomax';
  if (/modulmax/.test(lower)) return 'modulmax';
  return null;
}

/**
 * Determine the product_type from a product name / description.
 * Falls back to product line definitions when possible.
 */
function classifyProductType(name, description = '') {
  const lineKey = identifyProductLine(`${name} ${description}`);
  if (lineKey && PRODUCT_LINES[lineKey]) {
    return PRODUCT_LINES[lineKey].product_type;
  }

  const text = `${name} ${description}`.toLowerCase();
  if (/double.?drop|ultra.?low/.test(text)) return 'double-drop';
  if (/extendable|step.?deck/.test(text)) return 'extendable';
  if (/modular|module/.test(text)) return 'modular';
  if (/flatbed|cargo/.test(text)) return 'flatbed';
  if (/lowboy|lowbed|low.?loader/.test(text)) return 'lowboy';
  return 'lowboy'; // default for Faymonville heavy-haul
}

/**
 * Determine the gooseneck_type from product name / specs text.
 */
function classifyGooseneckType(name, specsText = '') {
  const lineKey = identifyProductLine(`${name} ${specsText}`);
  if (lineKey && PRODUCT_LINES[lineKey]) {
    return PRODUCT_LINES[lineKey].gooseneck_type;
  }

  const text = `${name} ${specsText}`.toLowerCase();
  if (/hydraulic.?detach/.test(text)) return 'hydraulic-detachable';
  if (/mechanical.?detach/.test(text)) return 'mechanical-detachable';
  if (/detach/.test(text)) return 'detachable';
  if (/fixed/.test(text)) return 'fixed';
  return null;
}

/**
 * Detect series from the product name / URL.
 */
function detectSeries(name, url = '') {
  const lineKey = identifyProductLine(`${name} ${url}`);
  if (lineKey && PRODUCT_LINES[lineKey]) {
    return PRODUCT_LINES[lineKey].series;
  }
  return null;
}

/**
 * Extract model number from a product name.
 * Faymonville uses the MAX naming convention (e.g. HighwayMAX, MultiMAX).
 */
function extractModelNumber(name) {
  const text = name.trim();
  // Match patterns like HighwayMAX, MultiMAX, MegaMAX, etc.
  const maxMatch = text.match(/(\w+MAX(?:\s*Plus)?)/i);
  if (maxMatch) return maxMatch[1];
  // Match patterns like Combi MAX, Vario MAX
  const splitMatch = text.match(/((?:Highway|Multi|Mega|Dual|Combi|Vario|Cargo|Modul)\s*MAX(?:\s*Plus)?)/i);
  if (splitMatch) return splitMatch[1].replace(/\s+/g, '');
  return null;
}

/**
 * Parse axle count from spec text.
 */
function parseAxleCount(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:axle|axles)/i);
  if (match) return parseInt(match[1], 10);
  // Range: "3-8 axles" -> take the max
  const rangeMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:axle|axles)/i);
  if (rangeMatch) return parseInt(rangeMatch[2], 10);
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

      const links = await page.evaluate(() => {
        const found = [];
        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;
          const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
          // Keep links from Faymonville, MAX Trailer, and Hale Trailer domains
          if (
            fullUrl.includes('faymonville.com') ||
            fullUrl.includes('maxtrailer.us') ||
            fullUrl.includes('haletrailer.com/faymonville')
          ) {
            found.push(fullUrl.replace(/\/$/, '') + '/');
          }
        });
        return [...new Set(found)];
      });

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

  // Filter to product-relevant pages
  const filtered = [...allLinks].filter((url) => {
    const lower = url.toLowerCase();
    // Skip top-level / non-product pages
    if (lower === 'https://www.faymonville.com/en/') return false;
    if (lower === 'https://www.maxtrailer.us/') return false;
    if (lower === 'https://haletrailer.com/faymonville/') return false;
    // Skip contact, about, news, cookie, legal pages
    if (/contact|about|news|press|career|cookie|legal|privacy|imprint|dealer/i.test(lower)) return false;

    // Must contain a product keyword or be under a products path
    const hasProductKeyword = PRODUCT_KEYWORDS.some((kw) =>
      lower.replace(/[-_\s]/g, '').includes(kw.replace(/[-_\s]/g, ''))
    );
    const isProductPath =
      lower.includes('/products/') ||
      lower.includes('/en/products/') ||
      lower.includes('haletrailer.com/faymonville/');

    return hasProductKeyword || isProductPath;
  });

  // Deduplicate: prefer Hale Trailer pages (richer specs), then MAX Trailer, then Faymonville
  // but keep all unique product lines
  const productLinesSeen = new Set();
  const deduped = [];
  // Sort: haletrailer first, then maxtrailer, then faymonville
  const sorted = filtered.sort((a, b) => {
    const scoreA = a.includes('haletrailer') ? 0 : a.includes('maxtrailer') ? 1 : 2;
    const scoreB = b.includes('haletrailer') ? 0 : b.includes('maxtrailer') ? 1 : 2;
    return scoreA - scoreB;
  });

  for (const url of sorted) {
    const lineKey = identifyProductLine(url);
    if (lineKey) {
      // Only keep first (best) URL per product line for dedup, but keep all source URLs
      // Actually, scrape all of them so we get the richest data
      deduped.push(url);
    } else {
      // Unknown product line -- keep it, might be a new product
      deduped.push(url);
    }
  }

  console.log(`\n  Discovered ${deduped.length} candidate product pages`);
  return deduped;
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

  const domain = new URL(url).hostname;

  const pageData = await page.evaluate((domainArg) => {
    // --- Name / title ---
    const h1 = document.querySelector('h1');
    const name = h1 ? h1.textContent.trim() : '';

    // --- Tagline (often in a subtitle or first prominent paragraph) ---
    let tagline = '';
    const subtitle = document.querySelector(
      '.entry-subtitle, .page-subtitle, .hero-subtitle, h2, .tagline, .subtitle'
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
      'article p',
      'main p',
      '.content p',
      '#content p',
      '.text-content p',
      '.product-detail p',
      '.product-info p',
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
      // Only keep images from relevant domains
      if (
        !src.includes('faymonville') &&
        !src.includes('maxtrailer') &&
        !src.includes('haletrailer') &&
        !src.includes('wp-content')
      ) {
        return;
      }

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
    const bodyText = document.body
      ? document.body.textContent.substring(0, 5000)
      : '';

    return { name, tagline, description, shortDescription, specs, images, bodyText };
  }, domain);

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

    if (/capacity|payload|gvwr|weight|tonnage|ton|rating/i.test(keyLower)) {
      category = 'Capacity';
      if (/lbs?|pounds?/i.test(value)) unit = 'lbs';
      else if (/ton/i.test(value)) unit = 'tons';
      else if (/kg/i.test(value)) unit = 'kg';
      else if (/tonne/i.test(value)) unit = 'tonnes';
    } else if (/deck|height|length|width|clearance|swing|dimension|spacing/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
      else if (/mm/i.test(value)) unit = 'mm';
      else if (/\bm\b/i.test(value)) unit = 'm';
    } else if (/axle|suspension|tire|wheel|brake|bogie|pendle/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch|coupling/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump|steering/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform|loading/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    } else if (/option|accessory|add.?on/i.test(keyLower)) {
      category = 'Options';
    }

    specs.push({ category, key, value, unit });
  }

  return specs;
}

/**
 * Build structured product data from scraped page data.
 * Merges scraped data with hardcoded fallback data from PRODUCT_LINES.
 */
function buildProduct(pageData) {
  const { name, tagline, description, shortDescription, specs: rawSpecs, sourceUrl } = pageData;

  // Identify product line for fallback data
  const lineKey = identifyProductLine(`${name} ${sourceUrl}`);
  const lineDefaults = lineKey ? PRODUCT_LINES[lineKey] : null;

  // Combine all spec values for searching
  const allSpecText = rawSpecs.map((s) => `${s.rawKey}: ${s.rawValue}`).join(' ');
  const combinedText = `${name} ${description} ${allSpecText}`;

  // --- Tonnage ---
  let tonnageMin = null;
  let tonnageMax = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/capacity|tonnage|ton|payload|rating/i.test(rawKey)) {
      const t = parseTonnage(rawValue);
      if (t.min) {
        tonnageMin = t.min;
        tonnageMax = t.max;
        break;
      }
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
  // Fallback to product line defaults
  if (!tonnageMin && lineDefaults) {
    tonnageMin = lineDefaults.tonnage_min || null;
    tonnageMax = lineDefaults.tonnage_max || null;
  }

  // --- Deck height ---
  let deckHeightInches = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?height|loaded.?height|loading.?height/i.test(rawKey)) {
      deckHeightInches = parseDeckHeight(rawValue);
      if (deckHeightInches) break;
    }
  }
  // Fallback: check description for deck height mentions
  if (!deckHeightInches) {
    const dhMatch = combinedText.match(/([\d.]+)[""]\s*deck\s*height/i);
    if (dhMatch) {
      deckHeightInches = parseFloat(dhMatch[1]);
    }
  }
  // Convert mm to inches if needed (Faymonville uses metric)
  if (!deckHeightInches) {
    const mmMatch = combinedText.match(/(\d{3,4})\s*mm\s*(?:deck|loading|loaded)/i);
    if (mmMatch) {
      deckHeightInches = Math.round((parseInt(mmMatch[1], 10) / 25.4) * 10) / 10;
    }
  }
  if (!deckHeightInches && lineDefaults) {
    deckHeightInches = lineDefaults.deck_height_inches || null;
  }

  // --- Deck length ---
  let deckLengthFeet = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?length|well.?length|loading.?length/i.test(rawKey)) {
      deckLengthFeet = parseLength(rawValue);
      if (deckLengthFeet) break;
    }
  }

  // --- Overall length ---
  let overallLengthFeet = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/overall.?length|total.?length/i.test(rawKey)) {
      overallLengthFeet = parseLength(rawValue);
      if (overallLengthFeet) break;
    }
  }

  // --- Axle count ---
  let axleCount = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/axle/i.test(rawKey)) {
      axleCount = parseAxleCount(rawValue);
      if (axleCount) break;
    }
  }
  if (!axleCount && lineDefaults) {
    axleCount = lineDefaults.axle_count || null;
  }

  // --- Empty weight ---
  let emptyWeightLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/empty.?weight|tare.?weight|unladen/i.test(rawKey)) {
      emptyWeightLbs = parseWeight(rawValue);
      if (emptyWeightLbs) break;
    }
  }

  // --- GVWR ---
  let gvwrLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/gvwr|gross.?vehicle|gross.?weight/i.test(rawKey)) {
      gvwrLbs = parseWeight(rawValue);
      if (gvwrLbs) break;
    }
  }

  // --- Concentrated capacity ---
  let concentratedCapacityLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/concentrated|max.?payload|capacity.*lbs|technical.*rating/i.test(rawKey)) {
      concentratedCapacityLbs = parseWeight(rawValue);
      if (concentratedCapacityLbs) break;
    }
  }
  if (!concentratedCapacityLbs && lineDefaults) {
    concentratedCapacityLbs = lineDefaults.concentrated_capacity_lbs || null;
  }

  const series = detectSeries(name, sourceUrl);
  const modelNumber = extractModelNumber(name);
  const productType = classifyProductType(name, description);
  const gooseneckType = classifyGooseneckType(name, allSpecText);

  // Use scraped data with fallback to product line defaults
  const finalName = cleanText(name) || (lineDefaults ? lineDefaults.name : 'Unknown');
  const finalTagline =
    cleanText(tagline) || (lineDefaults ? lineDefaults.tagline : null);
  const finalDescription =
    cleanText(description) || (lineDefaults ? lineDefaults.short_description : null);
  const finalShortDescription =
    cleanText(shortDescription) || (lineDefaults ? lineDefaults.short_description : null);

  return {
    name: finalName,
    series,
    model_number: modelNumber,
    tagline: finalTagline,
    description: finalDescription,
    short_description: finalShortDescription,
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

/**
 * For product lines not found during discovery, create products from
 * hardcoded fallback data so the catalog is always complete.
 */
function buildFallbackProduct(lineKey) {
  const line = PRODUCT_LINES[lineKey];
  if (!line) return null;

  return {
    name: line.name,
    series: line.series,
    model_number: line.name,
    tagline: line.tagline,
    description: line.short_description,
    short_description: line.short_description,
    product_type: line.product_type,
    tonnage_min: line.tonnage_min || null,
    tonnage_max: line.tonnage_max || null,
    deck_height_inches: line.deck_height_inches || null,
    deck_length_feet: null,
    overall_length_feet: null,
    axle_count: line.axle_count || null,
    gooseneck_type: line.gooseneck_type,
    empty_weight_lbs: null,
    gvwr_lbs: null,
    concentrated_capacity_lbs: line.concentrated_capacity_lbs || null,
    source_url: `https://www.faymonville.com/en/products/${lineKey}/`,
  };
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
  const scrapedLines = new Set();

  try {
    // ------------------------------------------------------------------
    // Step 1: Discover product page URLs
    // ------------------------------------------------------------------
    console.log('Step 1: Discovering product pages...\n');
    const productUrls = await discoverProductLinks(page);

    if (productUrls.length === 0) {
      console.warn('  No product pages discovered via crawl. Will use fallback data only.');
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

        // Track which product lines we successfully scraped
        const lineKey = identifyProductLine(`${pageData.name} ${url}`);
        if (lineKey) {
          // If we already have a better version (more specs/images), skip
          if (scrapedLines.has(lineKey)) {
            console.log(`    Product line ${lineKey} already scraped, skipping duplicate`);
            continue;
          }
          scrapedLines.add(lineKey);
        }

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
        // Upsert to DB
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
    // Step 3: Upsert fallback products for any product lines not scraped
    // ------------------------------------------------------------------
    console.log('\nStep 3: Upserting fallback data for missing product lines...');

    for (const [lineKey, lineDef] of Object.entries(PRODUCT_LINES)) {
      if (scrapedLines.has(lineKey)) {
        console.log(`  ${lineDef.name}: already scraped, skipping fallback`);
        continue;
      }

      console.log(`  ${lineDef.name}: using fallback data`);
      try {
        const product = buildFallbackProduct(lineKey);
        if (!product) continue;

        const productId = await upsertProduct(supabase, manufacturerId, product);
        if (!productId) {
          console.error(`    Failed to upsert fallback product: ${lineDef.name}`);
          stats.errors++;
          continue;
        }

        // No images or specs for fallback products (we have no scraped data)
        stats.upserted++;
        console.log(`    Upserted fallback product ID: ${productId}`);
      } catch (err) {
        console.error(`    Error upserting fallback ${lineDef.name}: ${err.message}`);
        stats.errors++;
      }
    }

    // ------------------------------------------------------------------
    // Step 4: Update product count
    // ------------------------------------------------------------------
    console.log('\nStep 4: Updating product count...');
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
