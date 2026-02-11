// @ts-nocheck
/**
 * Scrape Pitts Trailers lowboy / heavy-haul product catalog
 *
 * Pitts Trailers (pittstrailers.com) manufactures LB25, LB35, LB51, and LB55
 * series lowboy trailers out of Pittsview, Alabama. Their naming convention
 * encodes tonnage + deck height + gooseneck code:
 *   FN = Fixed Neck
 *   DC = Detachable (Hydraulic Removable)
 *   CS = Contractor Special
 *   GT = Gooseneck Turntable (heaviest-duty)
 *
 * This scraper visits known product pages on pittstrailers.com, extracts specs,
 * images, and descriptions, and upserts them into the manufacturer_products
 * tables via shared utilities.
 *
 * Usage:  node scripts/scrape-mfr-pitts.mjs
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

const MANUFACTURER_SLUG = 'pitts';
const MANUFACTURER_NAME = 'Pitts Trailers';
const WEBSITE = 'https://pittstrailers.com';

/** Seed pages used to discover additional product links */
const SEED_URLS = [
  'https://pittstrailers.com/heavy-haul/',
  'https://pittstrailers.com/lowboy-fn/',
  'https://pittstrailers.com/lowboy-rgn/',
];

/** Direct product pages we know about (fallbacks if discovery misses them) */
const KNOWN_PRODUCT_PAGES = [
  // LB55 Series – 55 Ton (Flagship)
  'https://pittstrailers.com/lb55-dc/',
  'https://pittstrailers.com/lb55-18gt/',
  'https://pittstrailers.com/lb55-22gt/',
  // LB51 Series – 51 Ton
  'https://pittstrailers.com/lb51-dc/',
  'https://pittstrailers.com/lb51-cs/',
  // LB35 Series – 35 Ton
  'https://pittstrailers.com/lb35/',
  'https://pittstrailers.com/lb35-dc/',
  'https://pittstrailers.com/lb35-cs/',
  // LB25 Series – 25 Ton
  'https://pittstrailers.com/lb25-33/',
  // Category / listing pages (used for discovery only)
  'https://pittstrailers.com/lowboy-fn/',
  'https://pittstrailers.com/lowboy-rgn/',
  'https://pittstrailers.com/heavy-haul/',
];

/**
 * Keywords that signal a page is a lowboy / heavy-haul product (vs. other
 * trailer types or non-product pages).  Used to filter discovered links.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'lb25', 'lb35', 'lb51', 'lb55',
  'detachable', 'gooseneck', 'heavy haul', 'rgn',
  'fixed neck', 'contractor special', 'turntable',
  'hydraulic removable', 'motor grader',
];

/** Delay between page loads (ms) – be polite */
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
 * All Pitts lowboy models are product_type: 'lowboy'.
 */
function classifyProductType(name, description = '') {
  // All Pitts heavy-haul trailers are lowboys
  return 'lowboy';
}

/**
 * Determine the gooseneck_type from product name / url / spec text.
 *
 * FN  = Fixed Neck             -> 'fixed'
 * DC  = Detachable (Hydraulic) -> 'hydraulic-detachable'
 * CS  = Contractor Special     -> 'fixed'
 * GT  = Gooseneck Turntable    -> 'hydraulic-detachable'
 */
function classifyGooseneckType(name, specsText = '') {
  const text = `${name} ${specsText}`.toUpperCase();

  // GT models – heaviest duty, hydraulic detachable with turntable
  if (/\bGT\b/.test(text) || /GOOSENECK\s*TURNTABLE/i.test(text)) {
    return 'hydraulic-detachable';
  }
  // DC models – hydraulic removable / detachable
  if (/\bDC\b/.test(text) || /HYDRAULIC.?REMOV/i.test(text) || /DETACHABLE/i.test(text)) {
    return 'hydraulic-detachable';
  }
  // CS models – Contractor Special (fixed neck variant)
  if (/\bCS\b/.test(text) || /CONTRACTOR\s*SPECIAL/i.test(text)) {
    return 'fixed';
  }
  // FN models – Fixed Neck
  if (/\bFN\b/.test(text) || /FIXED\s*NECK/i.test(text)) {
    return 'fixed';
  }
  // Fallback: check for generic clues
  if (/HYDRAULIC.?DETACH/i.test(text)) return 'hydraulic-detachable';
  if (/FIXED/i.test(text)) return 'fixed';

  return null;
}

/**
 * Detect the series from the product name / URL.
 * Pitts uses LB + tonnage number: LB25, LB35, LB51, LB55.
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toUpperCase();
  if (/LB55/.test(text)) return 'LB55';
  if (/LB51/.test(text)) return 'LB51';
  if (/LB35/.test(text)) return 'LB35';
  if (/LB25/.test(text)) return 'LB25';
  return null;
}

/**
 * Extract the model number from a product name / heading.
 * E.g. "LB55-22DC", "LB35-CS", "LB25-33", "LB51-DC"
 */
function extractModelNumber(name, url = '') {
  const text = `${name} ${url}`.toUpperCase();

  // Match patterns like LB55-22DC, LB55-18GT, LB35-DC, LB51-CS, LB25-33
  const fullMatch = text.match(/LB\d{2,3}-?\d{0,2}\s*[-]?\s*(?:DC|GT|CS|FN)/);
  if (fullMatch) return fullMatch[0].replace(/\s+/g, '').replace(/-+/g, '-');

  // Match LB25-33 pattern (tonnage + deck height, no gooseneck code)
  const lbDeckMatch = text.match(/LB\d{2,3}-\d{2,3}/);
  if (lbDeckMatch) return lbDeckMatch[0];

  // Match bare series like LB35 (Fixed Neck base model has no suffix)
  const bareMatch = text.match(/LB\d{2,3}/);
  if (bareMatch) return bareMatch[0];

  return null;
}

/**
 * Infer tonnage from the series name when specs don't explicitly state it.
 */
function inferTonnageFromSeries(series) {
  switch (series) {
    case 'LB25': return { min: 25, max: 25 };
    case 'LB35': return { min: 35, max: 35 };
    case 'LB51': return { min: 51, max: 51 };
    case 'LB55': return { min: 55, max: 55 };
    default: return { min: null, max: null };
  }
}

/**
 * Infer deck height from model number when specs don't provide it.
 * E.g. LB55-22DC -> 22", LB55-18GT -> 18", LB25-33 -> 33"
 */
function inferDeckHeightFromModel(modelNumber) {
  if (!modelNumber) return null;
  const text = modelNumber.toUpperCase();

  // LB55-22DC, LB55-22GT -> 22
  const match22 = text.match(/LB\d{2,3}-22/);
  if (match22) return 22;

  // LB55-18GT -> 18
  const match18 = text.match(/LB\d{2,3}-18/);
  if (match18) return 18;

  // LB25-33 -> 33
  const match33 = text.match(/LB\d{2,3}-33/);
  if (match33) return 33;

  // LB35 base models may have 26"/33"/38" deck but need specs page
  return null;
}

/**
 * Parse axle count from spec text.
 */
function parseAxleCount(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/tri[\s-]?axle/i.test(lower)) return 3;
  if (/tandem/i.test(lower)) return 2;
  if (/quad/i.test(lower)) return 4;
  const match = lower.match(/(\d+)\s*(?:axle|axles)/i);
  if (match) return parseInt(match[1], 10);
  const numMatch = lower.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 2 && n <= 6) return n;
  }
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
          // Only keep links on pittstrailers.com
          if (fullUrl.includes('pittstrailers.com')) {
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
    const normalized = url.replace(/\/$/, '') + '/';
    allLinks.add(normalized);
  });

  // Filter to likely lowboy / heavy-haul product detail pages
  const filtered = [...allLinks].filter((url) => {
    // Skip homepage
    if (url === 'https://pittstrailers.com/' || url === 'https://www.pittstrailers.com/') {
      return false;
    }

    // Skip obvious non-product pages
    const lower = url.toLowerCase();
    if (/\/(contact|about|news|blog|careers|dealers|parts|service|warranty|privacy|terms)\//i.test(lower)) {
      return false;
    }

    // Must contain a lowboy keyword in the URL or be a known product page
    const isKnown = KNOWN_PRODUCT_PAGES.some(
      (kp) => kp.replace(/\/$/, '') === url.replace(/\/$/, '')
    );
    if (isKnown) return true;

    // Check URL path for lowboy-relevant keywords
    const path = new URL(url).pathname.toLowerCase();
    return LOWBOY_KEYWORDS.some((kw) => path.includes(kw.replace(/\s+/g, '-')) || path.includes(kw.replace(/\s+/g, ''))) ||
      /lb\d{2}/.test(path);
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

    // --- Tagline (often in a subtitle or first prominent element after h1) ---
    let tagline = '';
    const subtitle = document.querySelector(
      '.entry-subtitle, .page-subtitle, .hero-subtitle, .product-tagline'
    );
    if (subtitle) {
      tagline = subtitle.textContent.trim();
    } else {
      // Try the first h2 as tagline
      const h2 = document.querySelector('h2');
      if (h2) {
        const h2Text = h2.textContent.trim();
        if (h2Text.length < 200) tagline = h2Text;
      }
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
      '.wp-block-paragraph',
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

    // --- Features / bullet points (capture as additional description) ---
    const featureLists = document.querySelectorAll(
      '.features ul, .product-features ul, .entry-content ul, article ul, main ul'
    );
    const features = [];
    featureLists.forEach((ul) => {
      ul.querySelectorAll('li').forEach((li) => {
        const t = li.textContent.trim();
        if (t.length > 5 && t.length < 500) features.push(t);
      });
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
      // Only keep Pitts domain images or CDN images
      if (!src.includes('pittstrailers.com') && !src.includes('wp-content') && !src.includes('pitts')) return;

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

    return { name, tagline, description, shortDescription, specs, images, bodyText, features };
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
 * Categorize raw specs into structured spec objects with category, key, value, unit.
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
    } else if (/deck|height|length|width|clearance|swing|well/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
    } else if (/axle|suspension|tire|wheel|brake/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch|neck/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform|apitong/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural|i-beam/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating|ppg|urethane/i.test(keyLower)) {
      category = 'Finish';
    } else if (/lock|pin|air/i.test(keyLower)) {
      category = 'Locking System';
    }

    specs.push({ category, key, value, unit });
  }

  return specs;
}

/**
 * Build structured product data from scraped page data.
 */
function buildProduct(pageData) {
  const { name, tagline, description, shortDescription, specs: rawSpecs, sourceUrl, features } = pageData;

  // Combine all spec values for searching
  const allSpecText = rawSpecs.map((s) => `${s.rawKey}: ${s.rawValue}`).join(' ');
  const combinedText = `${name} ${description} ${allSpecText}`;

  const series = detectSeries(name, sourceUrl);
  const modelNumber = extractModelNumber(name, sourceUrl);

  // Tonnage – try from specs first, then infer from series
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
  // Final fallback: infer from series
  if (!tonnageMin && series) {
    const inferred = inferTonnageFromSeries(series);
    tonnageMin = inferred.min;
    tonnageMax = inferred.max;
  }

  // Deck height – try from specs first, then infer from model number
  let deckHeightInches = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?height|loaded.?height/i.test(rawKey)) {
      deckHeightInches = parseDeckHeight(rawValue);
      if (deckHeightInches) break;
    }
  }
  if (!deckHeightInches) {
    deckHeightInches = inferDeckHeightFromModel(modelNumber);
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
  // Infer axle count for LB51/LB55 tri-axle models if not found
  if (!axleCount) {
    const lower = combinedText.toLowerCase();
    if (/tri[\s-]?axle/i.test(lower)) axleCount = 3;
    else if (/tandem/i.test(lower)) axleCount = 2;
  }

  // Empty weight
  let emptyWeightLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/empty.?weight|tare.?weight|unladen|approx.?weight/i.test(rawKey)) {
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

  // Concentrated capacity (e.g. "102,000 lbs in 12'" or "110,000 lbs in 12'")
  let concentratedCapacityLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/concentrated|max.?payload|capacity.*lbs/i.test(rawKey)) {
      concentratedCapacityLbs = parseWeight(rawValue);
      if (concentratedCapacityLbs) break;
    }
  }
  // Try parsing from combined text: "102,000 lbs in 12'" or "110,000 lbs"
  if (!concentratedCapacityLbs) {
    const capMatch = combinedText.match(/([\d,]+)\s*lbs?\s*(?:in\s*\d+)/i);
    if (capMatch) {
      concentratedCapacityLbs = parseWeight(capMatch[0]);
    }
  }

  const productType = classifyProductType(name, description);
  const gooseneckType = classifyGooseneckType(name, allSpecText);

  // Build a richer description by appending key features if available
  let fullDescription = cleanText(description) || null;
  if (features && features.length > 0 && fullDescription) {
    const featureBlock = features.map((f) => `- ${cleanText(f)}`).join('\n');
    fullDescription = `${fullDescription}\n\nKey Features:\n${featureBlock}`;
  }

  return {
    name: cleanText(name),
    series,
    model_number: modelNumber,
    tagline: cleanText(tagline) || null,
    description: fullDescription,
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
    alt_text: img.alt || `${pageData.name} Pitts Trailers lowboy`,
    source_url: pageData.sourceUrl,
  }));
}

/**
 * Check if a URL is a product detail page (not a category page).
 * Returns true if the URL looks like an individual product (e.g. /lb55-dc/)
 * rather than a category listing (e.g. /heavy-haul/).
 */
function isProductDetailPage(url) {
  const path = new URL(url).pathname.toLowerCase();
  // Known category/listing pages
  const categoryPaths = ['/heavy-haul/', '/lowboy-fn/', '/lowboy-rgn/'];
  if (categoryPaths.includes(path)) return false;
  // Must have lb prefix to be a product
  if (/\/lb\d{2}/.test(path)) return true;
  // Otherwise treat as potential product if it has lowboy keywords
  return false;
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
    const candidateUrls = await discoverProductLinks(page);

    if (candidateUrls.length === 0) {
      console.error('  No product pages discovered! Aborting.');
      await browser.close();
      return;
    }

    // Deduplicate and filter to product detail pages
    const uniqueUrls = [...new Set(candidateUrls.map((u) => u.replace(/\/$/, '') + '/'))];

    // Separate detail pages from category pages
    const productUrls = uniqueUrls.filter((url) => isProductDetailPage(url));
    const categoryUrls = uniqueUrls.filter((url) => !isProductDetailPage(url));

    console.log(`  ${productUrls.length} product detail pages to scrape`);
    console.log(`  ${categoryUrls.length} category pages (will scan for additional links)\n`);

    // ------------------------------------------------------------------
    // Step 1b: Scan category pages for additional product links
    // ------------------------------------------------------------------
    const additionalLinks = new Set();
    for (const catUrl of categoryUrls) {
      console.log(`  Scanning category page: ${catUrl}`);
      try {
        await page.goto(catUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await sleep(randomDelay());

        const links = await page.evaluate(() => {
          const found = [];
          document.querySelectorAll('a[href]').forEach((a) => {
            const href = a.href;
            if (href && href.includes('pittstrailers.com') && /\/lb\d{2}/i.test(href)) {
              found.push(href.replace(/\/$/, '') + '/');
            }
          });
          return [...new Set(found)];
        });

        links.forEach((l) => additionalLinks.add(l));
        console.log(`    Found ${links.length} product links`);
      } catch (err) {
        console.error(`    Error scanning ${catUrl}: ${err.message}`);
      }
    }

    // Merge additional links
    additionalLinks.forEach((l) => {
      if (!productUrls.includes(l)) productUrls.push(l);
    });

    console.log(`\n  Total unique product pages to scrape: ${productUrls.length}\n`);

    // ------------------------------------------------------------------
    // Step 2: Scrape each product page
    // ------------------------------------------------------------------
    console.log('Step 2: Scraping individual product pages...');

    for (let i = 0; i < productUrls.length; i++) {
      const url = productUrls[i];
      console.log(`\n[${i + 1}/${productUrls.length}] ${url}`);

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
        console.log(`    Deck height: ${product.deck_height_inches || '?'}"`);
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
      if (i < productUrls.length - 1) {
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
