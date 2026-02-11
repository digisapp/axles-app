// @ts-nocheck
/**
 * Scrape Globe Trailers lowboy/heavy-haul product catalog
 *
 * Globe Trailers (globetrailers.com) manufactures 35-80 ton lowboy trailers
 * and extendable models from their facility in Bradenton, FL.  All trailers
 * are 100 % US-made using locally sourced steel.
 *
 * This scraper visits the known product-line category pages, discovers
 * individual product/configuration pages, extracts specs, images, and
 * descriptions, and upserts them into the manufacturer_products tables
 * via shared utilities.
 *
 * Usage:  node scripts/scrape-mfr-globe.mjs
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

const MANUFACTURER_SLUG = 'globe';
const MANUFACTURER_NAME = 'Globe Trailers';
const WEBSITE = 'https://www.globetrailers.com';

/** Category pages that list individual product/configuration pages */
const SEED_URLS = [
  'https://www.globetrailers.com/',
  'https://www.globetrailers.com/35-40-ton-lowboys-standard/',
  'https://www.globetrailers.com/50-55-ton-lowboys/',
  'https://www.globetrailers.com/60-80-ton-lowboys/',
  'https://www.globetrailers.com/extendables/',
];

/**
 * Known product / configuration pages (fallbacks if discovery misses them).
 * Globe structures its site by tonnage category – sub-pages represent
 * specific configurations (Standard, Beavertail, Ag, Paver, etc.).
 */
const KNOWN_PRODUCT_PAGES = [
  // 35-40 Ton
  'https://www.globetrailers.com/35-40-ton-lowboys-standard/',
  'https://www.globetrailers.com/35-40-ton-lowboy-beavertail/',
  'https://www.globetrailers.com/35-40-ton-lowboy-agricultural/',
  // 50-55 Ton
  'https://www.globetrailers.com/50-55-ton-lowboys/',
  'https://www.globetrailers.com/50-55-ton-lowboy-standard/',
  'https://www.globetrailers.com/50-55-ton-lowboy-beavertail/',
  'https://www.globetrailers.com/50-55-ton-lowboy-paver/',
  // 60-80 Ton
  'https://www.globetrailers.com/60-80-ton-lowboys/',
  'https://www.globetrailers.com/60-80-ton-lowboy-standard/',
  'https://www.globetrailers.com/60-80-ton-lowboy-beavertail/',
  // Extendable
  'https://www.globetrailers.com/extendables/',
  'https://www.globetrailers.com/60-ton-extendable/',
  'https://www.globetrailers.com/extendable-lowboy/',
];

/**
 * Keywords that indicate a page is about a lowboy / heavy-haul product.
 * Used to filter links discovered during crawl.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'ton', 'beavertail', 'beaver tail',
  'paver', 'agricultural', 'extendable', 'heavy haul',
  'standard', 'detachable', 'gooseneck', 'rgn', 'flip axle',
];

/** Delay between page loads (ms) */
const PAGE_DELAY_MIN = 2000;
const PAGE_DELAY_MAX = 3500;

// ---------------------------------------------------------------------------
// Globe-specific domain knowledge (used to enrich scraped data)
// ---------------------------------------------------------------------------

/**
 * Known configuration data keyed by URL path fragment.
 * This supplements whatever the scraper can extract from the page itself,
 * since some Globe pages are image-heavy with limited machine-readable text.
 */
const KNOWN_CONFIGS = {
  '35-40-ton-lowboys-standard': {
    tonnageMin: 35,
    tonnageMax: 40,
    deckHeightInches: 22,
    deckLengthFeetMin: 20,
    deckLengthFeetMax: 29,
    overallLengthFeetMin: 41.92,  // 41'11"
    overallLengthFeetMax: 51.08,  // 51'1"
    axleCount: 2,
    emptyWeightLbs: 20840,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: 'Standard',
    series: '35-40 Ton',
  },
  '35-40-ton-lowboy-beavertail': {
    tonnageMin: 35,
    tonnageMax: 40,
    deckHeightInches: 20,
    deckLengthFeetMin: 20,
    deckLengthFeetMax: 29,
    overallLengthFeetMin: 41.92,
    overallLengthFeetMax: 51.08,
    axleCount: 2,
    emptyWeightLbs: 20840,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: 'Beavertail',
    series: '35-40 Ton',
  },
  '35-40-ton-lowboy-agricultural': {
    tonnageMin: 35,
    tonnageMax: 40,
    deckHeightInches: 20,
    deckLengthFeetMin: 20,
    deckLengthFeetMax: 29,
    overallLengthFeetMin: 41.92,
    overallLengthFeetMax: 51.08,
    axleCount: 2,
    emptyWeightLbs: 20840,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: 'Agricultural',
    series: '35-40 Ton',
  },
  '50-55-ton-lowboy': {
    tonnageMin: 50,
    tonnageMax: 55,
    deckHeightInches: 22,
    deckLengthFeetMin: 20,
    deckLengthFeetMax: 29,
    axleCount: 3,
    emptyWeightLbs: 24000,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: null,
    series: '50-55 Ton',
  },
  '50-55-ton-lowboy-standard': {
    tonnageMin: 50,
    tonnageMax: 55,
    deckHeightInches: 22,
    deckLengthFeetMin: 20,
    deckLengthFeetMax: 29,
    axleCount: 3,
    emptyWeightLbs: 24000,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: 'Standard',
    series: '50-55 Ton',
  },
  '50-55-ton-lowboy-beavertail': {
    tonnageMin: 50,
    tonnageMax: 55,
    deckHeightInches: 22,
    deckLengthFeetMin: 20,
    deckLengthFeetMax: 29,
    axleCount: 3,
    emptyWeightLbs: 24000,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: 'Beavertail',
    series: '50-55 Ton',
  },
  '50-55-ton-lowboy-paver': {
    tonnageMin: 50,
    tonnageMax: 55,
    deckHeightInches: 18,
    deckLengthFeetMin: 20,
    deckLengthFeetMax: 29,
    axleCount: 3,
    emptyWeightLbs: 24000,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: 'Paver',
    series: '50-55 Ton',
  },
  '60-80-ton-lowboy': {
    tonnageMin: 60,
    tonnageMax: 80,
    deckHeightInches: 22,
    deckLengthFeetMin: 28,
    deckLengthFeetMax: 30,
    axleCount: 5,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: null,
    series: '60-80 Ton',
  },
  '60-80-ton-lowboy-standard': {
    tonnageMin: 60,
    tonnageMax: 80,
    deckHeightInches: 22,
    deckLengthFeetMin: 28,
    deckLengthFeetMax: 30,
    axleCount: 5,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: 'Standard',
    series: '60-80 Ton',
  },
  '60-80-ton-lowboy-beavertail': {
    tonnageMin: 60,
    tonnageMax: 80,
    deckHeightInches: 22,
    deckLengthFeetMin: 28,
    deckLengthFeetMax: 30,
    axleCount: 5,
    productType: 'lowboy',
    gooseneckType: 'hydraulic-detachable',
    config: 'Beavertail',
    series: '60-80 Ton',
  },
  'extendable': {
    tonnageMin: 60,
    tonnageMax: 60,
    deckHeightInches: 22,
    deckLengthFeetMin: 24,
    deckLengthFeetMax: 50,
    axleCount: 5,
    productType: 'extendable',
    gooseneckType: 'hydraulic-detachable',
    config: 'Extendable',
    series: 'Extendable',
  },
  '60-ton-extendable': {
    tonnageMin: 60,
    tonnageMax: 60,
    deckHeightInches: 22,
    deckLengthFeetMin: 24,
    deckLengthFeetMax: 50,
    axleCount: 5,
    productType: 'extendable',
    gooseneckType: 'hydraulic-detachable',
    config: 'Extendable',
    series: 'Extendable',
  },
  'extendable-lowboy': {
    tonnageMin: 60,
    tonnageMax: 60,
    deckHeightInches: 22,
    deckLengthFeetMin: 24,
    deckLengthFeetMax: 50,
    axleCount: 5,
    productType: 'extendable',
    gooseneckType: 'hydraulic-detachable',
    config: 'Extendable',
    series: 'Extendable',
  },
};

/**
 * Globe standard features – appended to every product description when the
 * scraped description doesn't already mention them.
 */
const GLOBE_STANDARD_FEATURES = [
  'T-1 100K PSI yield strength steel construction',
  'Patented hydraulic flip axle',
  'Air lock safety system with safety bar',
  'Centralized fittings (protected from equipment contact)',
  '30K-lb air bags standard',
  '12" cross member spacing',
  '10-year structural warranty',
  '5-year STEMCO wheel warranty',
  '100% US-made with locally sourced steel (Bradenton, FL)',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomDelay() {
  return PAGE_DELAY_MIN + Math.random() * (PAGE_DELAY_MAX - PAGE_DELAY_MIN);
}

/**
 * Match a URL to a known configuration by checking its path against
 * KNOWN_CONFIGS keys. Returns the matching config or null.
 */
function matchKnownConfig(url) {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, '');
  // Try exact match first
  if (KNOWN_CONFIGS[path]) return KNOWN_CONFIGS[path];
  // Try partial/fuzzy match
  for (const [key, config] of Object.entries(KNOWN_CONFIGS)) {
    if (path.includes(key) || key.includes(path)) return config;
  }
  return null;
}

/**
 * Determine the product_type from a product name / description / URL.
 */
function classifyProductType(name, description = '', url = '') {
  const text = `${name} ${description} ${url}`.toLowerCase();
  if (/extendable|extend/.test(text)) return 'extendable';
  // Default everything else to lowboy – Globe only makes lowboys
  return 'lowboy';
}

/**
 * Determine the gooseneck_type. Globe lowboys all use hydraulic-detachable
 * goosenecks, so this is the default.
 */
function classifyGooseneckType(name, specsText = '') {
  const text = `${name} ${specsText}`.toLowerCase();
  if (/fixed/.test(text)) return 'fixed';
  if (/mechanical.?detach/.test(text)) return 'mechanical-detachable';
  // Globe standard: hydraulic detachable
  return 'hydraulic-detachable';
}

/**
 * Detect series/tonnage class from the product name or URL.
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toLowerCase();
  if (/60.?(?:ton)?.*extendable|extendable.*60.?ton/.test(text)) return 'Extendable';
  if (/extendable/.test(text)) return 'Extendable';
  if (/60.?[-–]?\s*80\s*ton/.test(text)) return '60-80 Ton';
  if (/50.?[-–]?\s*55\s*ton/.test(text)) return '50-55 Ton';
  if (/35.?[-–]?\s*40\s*ton/.test(text)) return '35-40 Ton';
  if (/80\s*ton/.test(text)) return '60-80 Ton';
  if (/60\s*ton/.test(text)) return '60-80 Ton';
  if (/55\s*ton/.test(text)) return '50-55 Ton';
  if (/50\s*ton/.test(text)) return '50-55 Ton';
  if (/40\s*ton/.test(text)) return '35-40 Ton';
  if (/35\s*ton/.test(text)) return '35-40 Ton';
  return null;
}

/**
 * Detect the configuration variant from name / URL.
 */
function detectConfiguration(name, url = '') {
  const text = `${name} ${url}`.toLowerCase();
  if (/paver/.test(text)) return 'Paver';
  if (/agricultural|agri/.test(text)) return 'Agricultural';
  if (/beavertail|beaver.?tail/.test(text)) return 'Beavertail';
  if (/extendable/.test(text)) return 'Extendable';
  if (/standard/.test(text)) return 'Standard';
  return null;
}

/**
 * Extract model number from a product name.
 * Globe doesn't use traditional model numbers, so we synthesize one from
 * the tonnage class and configuration.
 */
function extractModelNumber(name, url = '') {
  const series = detectSeries(name, url);
  const config = detectConfiguration(name, url);
  if (!series) return null;
  const seriesPart = series.replace(/\s+/g, '').replace('Ton', 'T');
  const configPart = config ? `-${config.substring(0, 3).toUpperCase()}` : '';
  return `GLOBE-${seriesPart}${configPart}`;
}

/**
 * Parse axle count from spec text.
 */
function parseAxleCount(text) {
  if (!text) return null;
  // 3+2 pattern (e.g. "3+2 axle")
  const plusMatch = text.match(/(\d)\s*\+\s*(\d)\s*(?:axle)?/i);
  if (plusMatch) return parseInt(plusMatch[1], 10) + parseInt(plusMatch[2], 10);
  // "tri-axle" / "tri axle"
  if (/tri.?axle/i.test(text)) return 3;
  // "tandem" = 2 axles
  if (/tandem/i.test(text)) return 2;
  // Direct count
  const match = text.match(/(\d+)\s*(?:axle|axles)/i);
  if (match) return parseInt(match[1], 10);
  const numMatch = text.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return null;
}

// ---------------------------------------------------------------------------
// Scraper Logic
// ---------------------------------------------------------------------------

/**
 * Discover product page URLs from seed pages by crawling links.
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
          // Only keep links on globetrailers.com
          if (fullUrl.includes('globetrailers.com')) {
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

  // Filter to pages likely about lowboy / heavy-haul products
  const filtered = [...allLinks].filter((url) => {
    const path = new URL(url).pathname.toLowerCase();

    // Skip top-level homepage
    if (path === '/' || path === '') return false;

    // Skip clearly non-product pages
    if (/\/contact|\/about|\/blog|\/news|\/careers|\/warranty|\/privacy|\/terms|\/gallery|\/videos|\/parts|\/service|\/dealer/i.test(path)) {
      return false;
    }

    // Keep pages that match lowboy-related keywords in their URL path
    const pathLower = path.toLowerCase();
    const matchesKeyword = LOWBOY_KEYWORDS.some((kw) => pathLower.includes(kw.replace(/\s+/g, '-')));
    const matchesTonnage = /\d+.*ton/.test(pathLower);
    const matchesExtendable = /extendab/.test(pathLower);
    const matchesLowboy = /lowboy/.test(pathLower);

    return matchesKeyword || matchesTonnage || matchesExtendable || matchesLowboy;
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

    // --- Tagline (subtitle or first h2) ---
    let tagline = '';
    const subtitle = document.querySelector('.entry-subtitle, .page-subtitle, h2, .tagline');
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
      '.elementor-text-editor p',
      'section p',
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

    // --- Specs: tables, definition lists, key:value in list items ---
    const specs = [];

    // Specification tables
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

    // Definition lists
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

    // Key: Value patterns in list items
    document.querySelectorAll('li, .spec-item, .feature-item').forEach((li) => {
      const text = li.textContent.trim();
      const kvMatch = text.match(/^([^:]{3,50}):\s*(.+)$/);
      if (kvMatch) {
        specs.push({ rawKey: kvMatch[1].trim(), rawValue: kvMatch[2].trim() });
      }
    });

    // Strong/bold tags followed by text (common spec format)
    document.querySelectorAll('p, div').forEach((el) => {
      const strongs = el.querySelectorAll('strong, b');
      strongs.forEach((strong) => {
        const key = strong.textContent.trim().replace(/:$/, '');
        const fullText = el.textContent.trim();
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const valueMatch = fullText.match(new RegExp(escaped + '[:\\s]+(.+)', 'i'));
        if (valueMatch && key.length > 2 && key.length < 80) {
          specs.push({ rawKey: key, rawValue: valueMatch[1].trim() });
        }
      });
    });

    // Elementor icon-list items (Globe may use Elementor)
    document.querySelectorAll('.elementor-icon-list-text').forEach((el) => {
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
      // Skip icons, logos, tiny images, etc.
      if (src.includes('logo') || src.includes('icon') || src.includes('favicon')) return;
      if (src.includes('.gif') || src.includes('.svg')) return;
      if (src.includes('gravatar') || src.includes('wp-content/plugins')) return;
      // Only keep images from Globe domain or CDN
      if (!src.includes('globetrailers.com') && !src.includes('wp-content') && !src.includes('uploads')) {
        return;
      }

      const width = img.naturalWidth || img.width || 0;
      if (width > 0 && width < 50) return;

      const normalizedSrc = src.split('?')[0];
      if (seenUrls.has(normalizedSrc)) return;
      seenUrls.add(normalizedSrc);

      images.push({
        url: src,
        alt: img.alt || '',
      });
    });

    // Also check background images in divs (common in Elementor-based sites)
    document.querySelectorAll('[style*="background-image"]').forEach((el) => {
      const style = el.getAttribute('style') || '';
      const bgMatch = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
      if (bgMatch) {
        const src = bgMatch[1];
        if (src.includes('globetrailers') || src.includes('wp-content')) {
          const normalizedSrc = src.split('?')[0];
          if (!seenUrls.has(normalizedSrc)) {
            seenUrls.add(normalizedSrc);
            images.push({ url: src, alt: '' });
          }
        }
      }
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
 * Categorize raw specs into structured spec objects with category/unit.
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

    let category = 'General';
    let unit = null;

    if (/capacity|payload|gvwr|weight|tonnage|ton/i.test(keyLower)) {
      category = 'Capacity';
      if (/lbs?|pounds?/i.test(value)) unit = 'lbs';
      else if (/ton/i.test(value)) unit = 'tons';
    } else if (/deck|height|length|width|clearance|swing|overall/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
    } else if (/axle|suspension|tire|wheel|brake|air.?bag/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch|detach/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump|flip/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform|cross.?member/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural|yield|t-1/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    } else if (/warranty/i.test(keyLower)) {
      category = 'Warranty';
    } else if (/safety|lock|bar/i.test(keyLower)) {
      category = 'Safety';
    }

    specs.push({ category, key, value, unit });
  }

  return specs;
}

/**
 * Build structured product data from scraped page data, enriched with
 * domain knowledge from KNOWN_CONFIGS where the page doesn't provide
 * adequate machine-readable data.
 */
function buildProduct(pageData) {
  const { name, tagline, description, shortDescription, specs: rawSpecs, sourceUrl } = pageData;
  const knownConfig = matchKnownConfig(sourceUrl);

  // Combine all spec values for searching
  const allSpecText = rawSpecs.map((s) => `${s.rawKey}: ${s.rawValue}`).join(' ');
  const combinedText = `${name} ${description} ${allSpecText}`;

  // --- Tonnage ---
  let tonnageMin = null;
  let tonnageMax = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/capacity|tonnage|ton|payload/i.test(rawKey)) {
      const t = parseTonnage(rawValue);
      if (t.min) { tonnageMin = t.min; tonnageMax = t.max; break; }
    }
  }
  // Fallback: search combined text
  if (!tonnageMin) {
    const tonMatch = combinedText.match(/(\d+)\s*[-–]?\s*(?:to\s*)?(\d+)?\s*ton/i);
    if (tonMatch) {
      tonnageMin = parseInt(tonMatch[1], 10);
      tonnageMax = tonMatch[2] ? parseInt(tonMatch[2], 10) : tonnageMin;
    }
  }
  // Fallback: known config
  if (!tonnageMin && knownConfig) {
    tonnageMin = knownConfig.tonnageMin;
    tonnageMax = knownConfig.tonnageMax;
  }

  // --- Deck height ---
  let deckHeightInches = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?height|loaded.?height/i.test(rawKey)) {
      deckHeightInches = parseDeckHeight(rawValue);
      if (deckHeightInches) break;
    }
  }
  if (!deckHeightInches && knownConfig) {
    deckHeightInches = knownConfig.deckHeightInches;
  }

  // --- Deck length ---
  let deckLengthFeet = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?length|well.?length|loading.?length/i.test(rawKey)) {
      deckLengthFeet = parseLength(rawValue);
      if (deckLengthFeet) break;
    }
  }
  // For deck length, use the most popular/max value from known config
  if (!deckLengthFeet && knownConfig?.deckLengthFeetMax) {
    deckLengthFeet = knownConfig.deckLengthFeetMax;
  }

  // --- Overall length ---
  let overallLengthFeet = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/overall.?length|total.?length/i.test(rawKey)) {
      overallLengthFeet = parseLength(rawValue);
      if (overallLengthFeet) break;
    }
  }
  if (!overallLengthFeet && knownConfig?.overallLengthFeetMax) {
    overallLengthFeet = knownConfig.overallLengthFeetMax;
  }

  // --- Axle count ---
  let axleCount = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/axle/i.test(rawKey)) {
      axleCount = parseAxleCount(rawValue);
      if (axleCount) break;
    }
  }
  // Detect from body text
  if (!axleCount) {
    axleCount = parseAxleCount(combinedText);
  }
  if (!axleCount && knownConfig) {
    axleCount = knownConfig.axleCount;
  }

  // --- Empty weight ---
  let emptyWeightLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/empty.?weight|tare.?weight|unladen/i.test(rawKey)) {
      emptyWeightLbs = parseWeight(rawValue);
      if (emptyWeightLbs) break;
    }
  }
  if (!emptyWeightLbs && knownConfig?.emptyWeightLbs) {
    emptyWeightLbs = knownConfig.emptyWeightLbs;
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

  // --- Classification ---
  const series = detectSeries(name, sourceUrl) || (knownConfig?.series ?? null);
  const modelNumber = extractModelNumber(name, sourceUrl);
  const productType = knownConfig?.productType || classifyProductType(name, description, sourceUrl);
  const gooseneckType = knownConfig?.gooseneckType || classifyGooseneckType(name, allSpecText);
  const config = detectConfiguration(name, sourceUrl) || (knownConfig?.config ?? null);

  // --- Enrich description with Globe standard features if sparse ---
  let enrichedDescription = cleanText(description) || null;
  if (!enrichedDescription || enrichedDescription.length < 100) {
    const configLabel = config ? ` ${config}` : '';
    const seriesLabel = series || '';
    const parts = [
      `Globe Trailers ${seriesLabel}${configLabel} Lowboy Trailer.`,
    ];
    if (enrichedDescription) parts.push(enrichedDescription);
    parts.push('Standard features include:');
    GLOBE_STANDARD_FEATURES.forEach((f) => parts.push(`- ${f}`));
    enrichedDescription = parts.join('\n');
  }

  // --- Product name: ensure it's descriptive ---
  let productName = cleanText(name);
  if (!productName || productName.length < 5) {
    const configLabel = config ? ` ${config}` : '';
    productName = `Globe ${series || ''}${configLabel} Lowboy`;
  }

  return {
    name: productName,
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
    alt_text: img.alt || `${pageData.name} Globe Trailer`,
    source_url: pageData.sourceUrl,
  }));
}

/**
 * Build additional specs from KNOWN_CONFIGS that might not have been
 * picked up from the page.  These are appended to any scraped specs.
 */
function buildKnownSpecs(url) {
  const config = matchKnownConfig(url);
  if (!config) return [];

  const extra = [];

  extra.push({
    category: 'Frame',
    key: 'Steel Type',
    value: 'T-1 100K PSI yield strength steel',
    unit: null,
  });

  extra.push({
    category: 'Safety',
    key: 'Safety System',
    value: 'Air lock safety system with safety bar',
    unit: null,
  });

  extra.push({
    category: 'Hydraulics',
    key: 'Flip Axle',
    value: 'Patented hydraulic flip axle',
    unit: null,
  });

  extra.push({
    category: 'Running Gear',
    key: 'Air Bags',
    value: '30K-lb air bags standard',
    unit: 'lbs',
  });

  extra.push({
    category: 'Decking',
    key: 'Cross Member Spacing',
    value: '12 inches',
    unit: 'in',
  });

  extra.push({
    category: 'General',
    key: 'Fittings',
    value: 'Centralized fittings (protected from equipment contact)',
    unit: null,
  });

  extra.push({
    category: 'Warranty',
    key: 'Structural Warranty',
    value: '10-year structural warranty',
    unit: null,
  });

  extra.push({
    category: 'Warranty',
    key: 'Wheel Warranty',
    value: '5-year STEMCO wheel warranty',
    unit: null,
  });

  extra.push({
    category: 'General',
    key: 'Manufacturing',
    value: '100% US-made, locally sourced steel, Bradenton, FL',
    unit: null,
  });

  if (config.tonnageMin != null) {
    extra.push({
      category: 'Capacity',
      key: 'Rated Capacity',
      value: config.tonnageMin === config.tonnageMax
        ? `${config.tonnageMin} ton`
        : `${config.tonnageMin}-${config.tonnageMax} ton`,
      unit: 'tons',
    });
  }

  if (config.deckHeightInches != null) {
    extra.push({
      category: 'Dimensions',
      key: 'Deck Height',
      value: `${config.deckHeightInches}"`,
      unit: 'in',
    });
  }

  if (config.deckLengthFeetMin != null) {
    extra.push({
      category: 'Dimensions',
      key: 'Deck Length Range',
      value: config.deckLengthFeetMin === config.deckLengthFeetMax
        ? `${config.deckLengthFeetMin}'`
        : `${config.deckLengthFeetMin}' to ${config.deckLengthFeetMax}'`,
      unit: 'ft',
    });
  }

  if (config.axleCount != null) {
    const axleLabel = config.axleCount === 2 ? 'Tandem'
      : config.axleCount === 3 ? 'Tri-axle'
      : config.axleCount === 5 ? '3+2 (5 axles)'
      : `${config.axleCount} axles`;
    extra.push({
      category: 'Running Gear',
      key: 'Axle Configuration',
      value: axleLabel,
      unit: null,
    });
  }

  if (config.emptyWeightLbs != null) {
    extra.push({
      category: 'Capacity',
      key: 'Empty Weight',
      value: `${config.emptyWeightLbs.toLocaleString()} lbs`,
      unit: 'lbs',
    });
  }

  return extra;
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
      console.error('  No product pages discovered! Falling back to known pages only.');
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
          stats.errors++;
          continue;
        }
        stats.scraped++;

        // Build structured data
        const product = buildProduct(pageData);
        const images = buildImages(pageData);
        const scrapedSpecs = categorizeSpecs(pageData.specs);
        const knownSpecs = buildKnownSpecs(url);

        // Merge specs: scraped specs first, then known specs that don't duplicate
        const seenSpecKeys = new Set(scrapedSpecs.map((s) => s.key.toLowerCase()));
        const mergedSpecs = [...scrapedSpecs];
        for (const ks of knownSpecs) {
          if (!seenSpecKeys.has(ks.key.toLowerCase())) {
            mergedSpecs.push(ks);
            seenSpecKeys.add(ks.key.toLowerCase());
          }
        }

        console.log(`    Product type: ${product.product_type}`);
        console.log(`    Series: ${product.series || 'N/A'}`);
        console.log(`    Model: ${product.model_number || 'N/A'}`);
        console.log(`    Tonnage: ${product.tonnage_min || '?'}-${product.tonnage_max || '?'} ton`);
        console.log(`    Gooseneck: ${product.gooseneck_type || 'N/A'}`);
        console.log(`    Deck height: ${product.deck_height_inches || '?'}"`);
        console.log(`    Axles: ${product.axle_count || '?'}`);
        console.log(`    Specs: ${mergedSpecs.length}, Images: ${images.length}`);

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
        await upsertProductSpecs(supabase, productId, mergedSpecs);

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
