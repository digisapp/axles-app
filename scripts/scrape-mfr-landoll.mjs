// @ts-nocheck
/**
 * Scrape Landoll Corporation lowboy/heavy-haul product catalog
 *
 * Landoll (landoll.com) has been manufacturing trailers in Kansas since 1963.
 * Their lineup includes the 850XT extendable detachable lowboy (flagship),
 * plus the 440B, 455B, and 425B traveling-axle series with hydraulic tilt decks.
 *
 * Key innovations:
 *   - H.O.S.S. (Hydraulic Operating System) cuts operational time in half
 *   - Traveling axle moves along frame; deck tilts to ground (6-degree load angle)
 *   - Adjustable load angle from 9 to 17 degrees
 *   - Closed spool valve system (Italian-made)
 *   - Chest-height control panel
 *
 * This scraper discovers product pages from landoll.com/landoll-trailers/,
 * extracts specs, images, and descriptions, and upserts them into the
 * manufacturer_products tables via shared utilities.
 *
 * Usage:  node scripts/scrape-mfr-landoll.mjs
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

const MANUFACTURER_SLUG = 'landoll';
const MANUFACTURER_NAME = 'Landoll Corporation';
const WEBSITE = 'https://landoll.com';

/** Starting pages to discover lowboy / heavy-haul products */
const SEED_URLS = [
  'https://landoll.com/landoll-trailers/',
];

/** Direct product pages we know about (fallbacks in case discovery misses them) */
const KNOWN_PRODUCT_PAGES = [
  // Detachable lowboy (flagship)
  'https://landoll.com/landoll-trailers/detachable/850xt/',
  // Traveling-axle series
  'https://landoll.com/landoll-trailers/440b/',
  'https://landoll.com/landoll-trailers/455b/',
  'https://landoll.com/landoll-trailers/425b/',
];

/**
 * Keywords that signal a page is a lowboy / heavy-haul product
 * (vs. ag equipment or other Landoll divisions).
 * Used to filter discovered links.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'detachable', 'gooseneck', 'traveling axle',
  'traveling-axle', 'tilt deck', 'tilt-deck', 'heavy haul', 'rgn',
  '850xt', '850 xt', '440b', '455b', '425b',
  'trailer', 'axle', 'tonnage', 'ton', 'deck height',
];

/** Delay between page loads (ms) */
const PAGE_DELAY_MIN = 2000;
const PAGE_DELAY_MAX = 3500;

// ---------------------------------------------------------------------------
// Hard-coded product knowledge
// ---------------------------------------------------------------------------

/**
 * Because manufacturer websites can be sparse or inconsistent,
 * we embed authoritative spec data for Landoll's key models.
 * This is merged with whatever the scraper finds on the page,
 * with hard-coded data filling in any gaps.
 */
const KNOWN_PRODUCTS = {
  '850xt': {
    name: 'Landoll 850XT Extendable Detachable Lowboy',
    series: '850XT',
    model_number: '850XT',
    product_type: 'extendable',
    gooseneck_type: 'hydraulic-detachable',
    tonnage_min: 50,
    tonnage_max: 50,
    deck_height_inches: 22,
    axle_count: 3,
    tagline: 'Non-ground-bearing hydraulic detachable with 7 adjustable height positions',
    fallback_specs: [
      { category: 'Capacity', key: 'Rated Capacity', value: '50 tons (100,000 lbs) over 16\' span', unit: 'tons' },
      { category: 'Dimensions', key: 'Deck Height', value: '22"', unit: 'in' },
      { category: 'Dimensions', key: 'Ground Clearance', value: '6"', unit: 'in' },
      { category: 'Dimensions', key: 'Standard Lengths', value: '48\' / 53\'', unit: 'ft' },
      { category: 'Dimensions', key: 'Extended Lengths', value: '48\'/50.5\'/53\'/56\' and 53\'/55.5\'/58\'/61\'', unit: 'ft' },
      { category: 'Capacity', key: 'Height Positions', value: '7 adjustable height positions', unit: null },
      { category: 'Running Gear', key: 'Axles', value: 'Triple 25,000 lb axles', unit: null },
      { category: 'Running Gear', key: 'Suspension', value: 'Air ride', unit: null },
      { category: 'Running Gear', key: 'Rear Axle', value: 'Air-lift rear axle', unit: null },
      { category: 'Gooseneck', key: 'Gooseneck Type', value: 'Non-ground-bearing hydraulic detachable', unit: null },
      { category: 'Hydraulics', key: 'Winch', value: '20,000 lb winch', unit: 'lbs' },
    ],
  },
  '440b': {
    name: 'Landoll 440B Traveling Axle Trailer',
    series: '440B',
    model_number: '440B',
    product_type: 'traveling-axle',
    gooseneck_type: 'fixed',
    tonnage_min: 40,
    tonnage_max: 40,
    deck_height_inches: 37,
    axle_count: 2,
    tagline: '40-ton traveling axle with hydraulic tilt deck',
    fallback_specs: [
      { category: 'Capacity', key: 'Rated Capacity', value: '40 tons (80,000 lbs)', unit: 'tons' },
      { category: 'Dimensions', key: 'Deck Height', value: '37"', unit: 'in' },
      { category: 'Dimensions', key: 'Available Lengths', value: '41\', 48\', 50\' (CA legal), 53\'', unit: 'ft' },
      { category: 'Running Gear', key: 'Axles', value: 'Tandem 25,000 lb axles', unit: null },
      { category: 'Running Gear', key: 'Suspension', value: 'Neway Air Ride', unit: null },
      { category: 'Gooseneck', key: 'Gooseneck Type', value: 'Fixed gooseneck', unit: null },
      { category: 'General', key: 'Deck Design', value: 'Hydraulic tilt deck', unit: null },
    ],
  },
  '455b': {
    name: 'Landoll 455B Traveling Axle Trailer',
    series: '455B',
    model_number: '455B',
    product_type: 'traveling-axle',
    gooseneck_type: 'fixed',
    tonnage_min: 55,
    tonnage_max: 55,
    deck_height_inches: 37,
    axle_count: 3,
    tagline: '55-ton traveling axle with hydraulic tilt deck',
    fallback_specs: [
      { category: 'Capacity', key: 'Rated Capacity', value: '55 tons (110,000 lbs)', unit: 'tons' },
      { category: 'Dimensions', key: 'Deck Height', value: '37"', unit: 'in' },
      { category: 'Dimensions', key: 'Available Lengths', value: '48\', 50\' (CA legal), 53\', 57\'', unit: 'ft' },
      { category: 'Running Gear', key: 'Axles', value: 'Triple 25,000 lb axles', unit: null },
      { category: 'Running Gear', key: 'Axle Spread', value: '60"', unit: 'in' },
      { category: 'Gooseneck', key: 'Gooseneck Type', value: 'Fixed gooseneck', unit: null },
      { category: 'General', key: 'Deck Design', value: 'Hydraulic tilt deck', unit: null },
    ],
  },
  '425b': {
    name: 'Landoll 425B Traveling Axle Trailer',
    series: '425B',
    model_number: '425B',
    product_type: 'traveling-axle',
    gooseneck_type: 'fixed',
    tonnage_min: null,
    tonnage_max: null,
    deck_height_inches: null,
    axle_count: null,
    tagline: 'Lighter duty traveling axle trailer',
    fallback_specs: [
      { category: 'Gooseneck', key: 'Gooseneck Type', value: 'Fixed gooseneck', unit: null },
      { category: 'General', key: 'Deck Design', value: 'Hydraulic tilt deck', unit: null },
      { category: 'General', key: 'Series', value: '400-series traveling axle', unit: null },
    ],
  },
};

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
  if (/850\s*xt|extendable.*detach|detach.*extend/.test(text)) return 'extendable';
  if (/traveling.?axle|tilt.?deck|440|455|425/.test(text)) return 'traveling-axle';
  if (/rgn|hydraulic.?detach|detachable.?gooseneck/.test(text)) return 'rgn';
  if (/double.?drop/.test(text)) return 'double-drop';
  if (/step.?deck/.test(text)) return 'step-deck';
  if (/flatbed/.test(text)) return 'flatbed';
  if (/lowboy|low.?boy/.test(text)) return 'lowboy';
  return 'lowboy'; // default for Landoll heavy-haul
}

/**
 * Determine the gooseneck_type from product name / specs text.
 */
function classifyGooseneckType(name, specsText = '') {
  const text = `${name} ${specsText}`.toLowerCase();
  if (/non.?ground.?bearing/.test(text)) return 'hydraulic-detachable';
  if (/hydraulic.?detach/.test(text)) return 'hydraulic-detachable';
  if (/mechanical.?detach/.test(text)) return 'mechanical-detachable';
  if (/detach/.test(text)) return 'detachable';
  if (/traveling.?axle|tilt.?deck|440|455|425/.test(text)) return 'fixed';
  if (/fixed/.test(text)) return 'fixed';
  return null;
}

/**
 * Detect series from the product name / URL.
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toUpperCase();
  if (/850\s*XT/.test(text)) return '850XT';
  if (/455\s*B/.test(text)) return '455B';
  if (/440\s*B/.test(text)) return '440B';
  if (/425\s*B/.test(text)) return '425B';
  return null;
}

/**
 * Detect the known-product key from a URL or page name.
 */
function detectKnownProductKey(name, url = '') {
  const text = `${name} ${url}`.toLowerCase();
  if (/850\s*xt/.test(text)) return '850xt';
  if (/455\s*b/.test(text)) return '455b';
  if (/440\s*b/.test(text)) return '440b';
  if (/425\s*b/.test(text)) return '425b';
  return null;
}

/**
 * Extract model number from a product name.
 * E.g. "850XT" or "440B" or "455B"
 */
function extractModelNumber(name) {
  const text = name.toUpperCase();
  const match = text.match(/\b(850\s*XT|440\s*B|455\s*B|425\s*B)\b/);
  if (match) return match[1].replace(/\s+/g, '');
  return null;
}

/**
 * Parse axle count from spec text.
 */
function parseAxleCount(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/triple|3[\s-]*axle/i.test(lower)) return 3;
  if (/tandem|2[\s-]*axle|dual/i.test(lower)) return 2;
  if (/single|1[\s-]*axle/i.test(lower)) return 1;
  if (/quad|4[\s-]*axle/i.test(lower)) return 4;
  const match = lower.match(/(\d+)\s*(?:axle|axles)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Check if a URL looks like a lowboy/heavy-haul product page.
 */
function isLowboyProduct(url, linkText = '') {
  const combined = `${url} ${linkText}`.toLowerCase();
  return LOWBOY_KEYWORDS.some((kw) => combined.includes(kw));
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
          // Only keep links on landoll.com under /landoll-trailers/
          if (
            fullUrl.includes('landoll.com') &&
            fullUrl.includes('/landoll-trailers/')
          ) {
            found.push({
              url: fullUrl.replace(/\/$/, '') + '/',
              text: a.textContent.trim(),
            });
          }
        });
        return found;
      }, WEBSITE);

      links.forEach((l) => allLinks.add(l.url));
      console.log(`    Found ${links.length} links`);
    } catch (err) {
      console.error(`    Error crawling ${seedUrl}: ${err.message}`);
    }
  }

  // Also crawl sub-sections that might list more products
  const subsectionUrls = [
    'https://landoll.com/landoll-trailers/detachable/',
    'https://landoll.com/landoll-trailers/traveling-axle/',
  ];

  for (const subUrl of subsectionUrls) {
    console.log(`  Crawling sub-section: ${subUrl}`);
    try {
      await page.goto(subUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(randomDelay());

      const links = await page.evaluate((baseUrl) => {
        const found = [];
        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
          if (
            fullUrl.includes('landoll.com') &&
            fullUrl.includes('/landoll-trailers/')
          ) {
            found.push(fullUrl.replace(/\/$/, '') + '/');
          }
        });
        return [...new Set(found)];
      }, WEBSITE);

      links.forEach((l) => allLinks.add(l));
      console.log(`    Found ${links.length} links`);
    } catch (err) {
      console.error(`    Error crawling ${subUrl}: ${err.message}`);
    }
  }

  // Add known product pages as fallbacks
  KNOWN_PRODUCT_PAGES.forEach((url) => allLinks.add(url.replace(/\/$/, '') + '/'));

  // Filter to just product detail pages (not top-level category pages)
  const filtered = [...allLinks].filter((url) => {
    // Skip the main trailers listing page itself
    if (url === 'https://landoll.com/landoll-trailers/') return false;
    // Skip category pages that are just containers
    if (url === 'https://landoll.com/landoll-trailers/detachable/') return false;
    if (url === 'https://landoll.com/landoll-trailers/traveling-axle/') return false;

    // Must contain a model identifier or be a deeper sub-page
    const isProductPage = /\/landoll-trailers\/(?:detachable\/)?[^/]+\/$/.test(url);
    return isProductPage;
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
    const subtitle = document.querySelector('.entry-subtitle, .page-subtitle, h2, .hero-subtitle');
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

    // --- Features list (common on Landoll pages) ---
    const features = [];
    document.querySelectorAll('li, .feature-item').forEach((li) => {
      const text = li.textContent.trim();
      if (text.length > 10 && text.length < 300) {
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
        const valueMatch = fullText.match(new RegExp(escapedKey + '[:\\s]+(.+)', 'i'));
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
      // Only keep Landoll domain images or CDN images
      if (!src.includes('landoll.com') && !src.includes('wp-content') && !src.includes('uploads')) return;

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
    const bodyText = document.body ? document.body.textContent.substring(0, 8000) : '';

    return { name, tagline, description, shortDescription, specs, features, images, bodyText };
  });

  if (!pageData || !pageData.name) {
    console.log('    No product name found, skipping');
    return null;
  }

  console.log(`    Name: ${pageData.name}`);
  console.log(`    Specs found: ${pageData.specs.length}`);
  console.log(`    Features found: ${pageData.features?.length || 0}`);
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
    } else if (/deck|height|length|width|clearance|swing|ground/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
    } else if (/axle|suspension|tire|wheel|brake|air.?ride/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump|winch|h\.?o\.?s\.?s/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    } else if (/load.?angle|tilt|ramp/i.test(keyLower)) {
      category = 'Loading';
    } else if (/control|panel|valve|spool/i.test(keyLower)) {
      category = 'Controls';
    }

    specs.push({ category, key, value, unit });
  }

  return specs;
}

/**
 * Build structured product data from scraped page data.
 * Merges with hard-coded known-product data when available.
 */
function buildProduct(pageData) {
  const { name, tagline, description, shortDescription, specs: rawSpecs, features, sourceUrl } = pageData;

  // Check if this matches a known product
  const knownKey = detectKnownProductKey(name, sourceUrl);
  const known = knownKey ? KNOWN_PRODUCTS[knownKey] : null;

  // Combine all spec values for searching
  const allSpecText = rawSpecs.map((s) => `${s.rawKey}: ${s.rawValue}`).join(' ');
  const featuresText = (features || []).join(' ');
  const combinedText = `${name} ${description} ${allSpecText} ${featuresText}`;

  // --- Tonnage ---
  let tonnageMin = null;
  let tonnageMax = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/capacity|tonnage|ton|payload|rated/i.test(rawKey)) {
      const t = parseTonnage(rawValue);
      if (t.min) { tonnageMin = t.min; tonnageMax = t.max; break; }
    }
  }
  // Fallback: search description/body for tonnage
  if (!tonnageMin) {
    const tonMatch = combinedText.match(/(\d+)\s*[-–]?\s*(?:to\s*)?(\d+)?\s*ton/i);
    if (tonMatch) {
      tonnageMin = parseInt(tonMatch[1], 10);
      tonnageMax = tonMatch[2] ? parseInt(tonMatch[2], 10) : tonnageMin;
    }
  }
  // Fallback: use known product data
  if (!tonnageMin && known) {
    tonnageMin = known.tonnage_min;
    tonnageMax = known.tonnage_max;
  }

  // --- Deck height ---
  let deckHeightInches = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?height|loaded.?height/i.test(rawKey)) {
      deckHeightInches = parseDeckHeight(rawValue);
      if (deckHeightInches) break;
    }
  }
  if (!deckHeightInches && known) {
    deckHeightInches = known.deck_height_inches;
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
  // Fallback: search combined text
  if (!axleCount) {
    if (/triple|3[\s-]*axle/i.test(combinedText)) axleCount = 3;
    else if (/tandem|2[\s-]*axle/i.test(combinedText)) axleCount = 2;
  }
  if (!axleCount && known) {
    axleCount = known.axle_count;
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
    if (/concentrated|max.?payload|capacity.*lbs/i.test(rawKey)) {
      concentratedCapacityLbs = parseWeight(rawValue);
      if (concentratedCapacityLbs) break;
    }
  }

  // Classify using scraped data, with known product fallbacks
  const series = detectSeries(name, sourceUrl) || (known ? known.series : null);
  const modelNumber = extractModelNumber(name) || (known ? known.model_number : null);
  const productType = classifyProductType(name, description) || (known ? known.product_type : 'lowboy');
  const gooseneckType = classifyGooseneckType(name, allSpecText) || (known ? known.gooseneck_type : null);

  // Use scraped name, but fall back to known name if scraped name is too generic
  const productName = (name && name.length > 3) ? name : (known ? known.name : name);

  // Merge tagline: use scraped if substantive, else known
  const productTagline = (tagline && tagline.length > 10) ? tagline : (known ? known.tagline : tagline);

  return {
    name: cleanText(productName),
    series,
    model_number: modelNumber,
    tagline: cleanText(productTagline) || null,
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

/**
 * Build specs, merging scraped specs with known fallback specs.
 * Scraped specs take priority; fallback specs fill gaps.
 */
function buildSpecs(pageData) {
  const scrapedSpecs = categorizeSpecs(pageData.specs);

  // Check if we have known product fallback specs
  const knownKey = detectKnownProductKey(pageData.name, pageData.sourceUrl);
  const known = knownKey ? KNOWN_PRODUCTS[knownKey] : null;

  if (!known || !known.fallback_specs) {
    return scrapedSpecs;
  }

  // Build a set of scraped spec keys (lowercased) for dedup
  const scrapedKeys = new Set(scrapedSpecs.map((s) => s.key.toLowerCase()));

  // Add fallback specs that are not already present
  const mergedSpecs = [...scrapedSpecs];
  for (const fallback of known.fallback_specs) {
    if (!scrapedKeys.has(fallback.key.toLowerCase())) {
      mergedSpecs.push({
        category: fallback.category,
        key: fallback.key,
        value: fallback.value,
        unit: fallback.unit,
      });
    }
  }

  // Also add features from the page as general specs if they look meaningful
  if (pageData.features && pageData.features.length > 0) {
    const featureKeys = new Set(mergedSpecs.map((s) => s.value.toLowerCase().substring(0, 40)));
    for (const feature of pageData.features) {
      const featurePreview = feature.toLowerCase().substring(0, 40);
      if (!featureKeys.has(featurePreview) && feature.length > 15 && feature.length < 200) {
        // Only add features that look like real specs/features (not navigation)
        if (/axle|capacity|deck|hydraulic|winch|suspension|air|steel|load|ton|height|angle|valve|control|h\.?o\.?s\.?s/i.test(feature)) {
          mergedSpecs.push({
            category: 'Features',
            key: 'Feature',
            value: feature,
            unit: null,
          });
          featureKeys.add(featurePreview);
        }
      }
    }
  }

  return mergedSpecs;
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
      console.error('  No product pages discovered! Using known product pages only.');
    }

    // Deduplicate by normalizing URLs
    const uniqueUrls = [...new Set(
      (productUrls.length > 0 ? productUrls : KNOWN_PRODUCT_PAGES)
        .map((u) => u.replace(/\/$/, '') + '/')
    )];
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
          // If scraping failed but we have known product data, create a minimal record
          const knownKey = detectKnownProductKey('', url);
          if (knownKey && KNOWN_PRODUCTS[knownKey]) {
            console.log(`    Using known product data for ${knownKey}`);
            const known = KNOWN_PRODUCTS[knownKey];
            const syntheticPageData = {
              name: known.name,
              tagline: known.tagline,
              description: '',
              shortDescription: '',
              specs: [],
              features: [],
              images: [],
              bodyText: '',
              sourceUrl: url,
            };

            const product = buildProduct(syntheticPageData);
            const specs = buildSpecs(syntheticPageData);

            const productId = await upsertProduct(supabase, manufacturerId, product);
            if (productId) {
              await upsertProductSpecs(supabase, productId, specs);
              stats.upserted++;
              stats.scraped++;
              console.log(`    Upserted known product ID: ${productId}`);
            } else {
              stats.errors++;
            }
          } else {
            stats.errors++;
          }
          continue;
        }
        stats.scraped++;

        // Build structured data
        const product = buildProduct(pageData);
        const images = buildImages(pageData);
        const specs = buildSpecs(pageData);

        console.log(`    Product type: ${product.product_type}`);
        console.log(`    Series: ${product.series || 'N/A'}`);
        console.log(`    Model: ${product.model_number || 'N/A'}`);
        console.log(`    Tonnage: ${product.tonnage_min || '?'}-${product.tonnage_max || '?'} ton`);
        console.log(`    Gooseneck: ${product.gooseneck_type || 'N/A'}`);
        console.log(`    Deck height: ${product.deck_height_inches || '?'}"`);
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
