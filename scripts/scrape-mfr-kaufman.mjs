// @ts-nocheck
/**
 * Scrape Kaufman Trailers lowboy / heavy-haul product catalog
 *
 * Kaufman Trailers (kaufmantrailers.com) is a factory-direct trailer
 * manufacturer based in South Carolina, operating since 1987. They produce
 * detachable gooseneck (lowboy) trailers across several series: Standard
 * Construction, Deluxe Construction, Paver Special, Ag (Agricultural),
 * Commercial, Drop Rail/Drop Side Heavy Haul, and Fixed Neck.
 *
 * This scraper discovers product pages from their /detachable-gooseneck-trailers/
 * sections, extracts specs, images, and descriptions, and upserts them into
 * the manufacturer_products tables via shared utilities.
 *
 * Usage:  node scripts/scrape-mfr-kaufman.mjs
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

const MANUFACTURER_SLUG = 'kaufman';
const MANUFACTURER_NAME = 'Kaufman Trailers';
const WEBSITE = 'https://www.kaufmantrailers.com';

/** Starting pages to discover lowboy / heavy-haul products */
const SEED_URLS = [
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/lowboy-trailers/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-ag-trailers/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-commercial-trailers/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-paver-special-trailer/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/fix-neck-low-boy-gooseneck-trailers/',
];

/** Direct product pages we know about (fallbacks in case discovery misses them) */
const KNOWN_PRODUCT_PAGES = [
  // Standard Construction lowboys
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/lowboy-trailers/35-ton-detachable-gooseneck-spring-ride-trailer/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/lowboy-trailers/50-ton-lowboy-trailer/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/lowboy-trailers/55-ton-lowboy-trailer/',
  // Deluxe Construction lowboys
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/lowboy-trailers/50-ton-deluxe-lowboy-trailer/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/lowboy-trailers/55-ton-deluxe-lowboy-trailer/',
  // Paver Special
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-paver-special-trailer/35-ton-paver-special/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-paver-special-trailer/50-ton-paver-special/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-paver-special-trailer/55-ton-paver-special/',
  // Ag (Agricultural)
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-ag-trailers/35-ton-ag-lowboy/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-ag-trailers/50-ton-ag-lowboy/',
  // Commercial
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-commercial-trailers/30-ton-commercial-lowboy/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/detachable-gooseneck-commercial-trailers/40-ton-commercial-lowboy/',
  // Drop Rail / Drop Side Heavy Haul
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/lowboy-trailers/55-ton-drop-side-lowboy/',
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/lowboy-trailers/55-ton-drop-rail-lowboy/',
  // Fixed Neck
  'https://www.kaufmantrailers.com/detachable-gooseneck-trailers/fix-neck-low-boy-gooseneck-trailers/fixed-neck-lowboy/',
];

/**
 * Keywords that signal a page is a lowboy / heavy-haul product
 * (vs. car trailers, equipment trailers, etc.)
 * Used to filter discovered links.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'low-boy', 'detachable', 'gooseneck',
  'paver', 'heavy haul', 'rgn', 'ton', 'drop rail', 'drop side',
  'fixed neck', 'fix neck', 'ag trailer', 'ag lowboy', 'commercial lowboy',
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
 * Kaufman's detachable gooseneck trailers are all lowboys.
 */
function classifyProductType(name, description = '') {
  const text = `${name} ${description}`.toLowerCase();
  if (/double.?drop|extendable/.test(text)) return 'double-drop';
  if (/step.?deck/.test(text)) return 'step-deck';
  if (/flatbed/.test(text)) return 'flatbed';
  // All Kaufman detachable gooseneck models are lowboys
  return 'lowboy';
}

/**
 * Determine the gooseneck_type from product name / specs text.
 * Kaufman's detachable models use hydraulic detach; fixed neck is fixed.
 */
function classifyGooseneckType(name, specsText = '') {
  const text = `${name} ${specsText}`.toLowerCase();
  if (/fixed.?neck|fix.?neck/.test(text)) return 'fixed';
  if (/non.?ground.?bearing/.test(text)) return 'non-ground-bearing';
  // All Kaufman detachable gooseneck models are hydraulic-detachable
  if (/detach|lowboy|low.?boy|paver|commercial|drop.?rail|drop.?side|ag\s/.test(text)) {
    return 'hydraulic-detachable';
  }
  return 'hydraulic-detachable'; // default for Kaufman
}

/**
 * Detect series from the product name / URL.
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toLowerCase();

  if (/deluxe/.test(text)) return 'Deluxe Construction';
  if (/paver/.test(text)) return 'Paver Special';
  if (/\bag\b|agricultural/.test(text)) return 'Ag';
  if (/commercial/.test(text)) return 'Commercial';
  if (/drop.?rail/.test(text)) return 'Drop Rail Heavy Haul';
  if (/drop.?side/.test(text)) return 'Drop Side Heavy Haul';
  if (/fixed.?neck|fix.?neck/.test(text)) return 'Fixed Neck';

  // Standard Construction is the default for plain lowboy models
  if (/lowboy|low.?boy|detachable.?gooseneck|spring.?ride/.test(text)) return 'Standard Construction';

  return null;
}

/**
 * Extract model number from a product name.
 * Kaufman uses tonnage-based names, e.g. "35 Ton", "55 Ton Deluxe"
 */
function extractModelNumber(name) {
  const text = name.toUpperCase();
  // Match patterns like "35 TON", "50-TON", "55T"
  const tonMatch = text.match(/(\d+)\s*[-]?\s*TON/);
  if (tonMatch) {
    // Build a model from tonnage and modifiers
    const tons = tonMatch[1];
    const lower = name.toLowerCase();
    if (/deluxe/.test(lower)) return `${tons}T-DLX`;
    if (/paver/.test(lower)) return `${tons}T-PVR`;
    if (/\bag\b|agricultural/.test(lower)) return `${tons}T-AG`;
    if (/commercial/.test(lower)) return `${tons}T-COM`;
    if (/drop.?rail/.test(lower)) return `${tons}T-DR`;
    if (/drop.?side/.test(lower)) return `${tons}T-DS`;
    if (/fixed.?neck|fix.?neck/.test(lower)) return `${tons}T-FN`;
    return `${tons}T-STD`;
  }
  return null;
}

/**
 * Parse axle count from spec text.
 */
function parseAxleCount(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  // Textual matches
  if (/tri[\s-]?axle/.test(lower)) return 3;
  if (/tandem/.test(lower)) return 2;
  if (/quad/.test(lower)) return 4;
  // Numeric match
  const match = lower.match(/(\d+)\s*(?:axle|axles)/i);
  if (match) return parseInt(match[1], 10);
  // Standalone number
  const numMatch = lower.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 2 && n <= 6) return n;
  }
  return null;
}

/**
 * Infer axle count from tonnage when not found in specs.
 * Kaufman uses tandem on 30-40T, tri-axle on 50-55T.
 */
function inferAxleCountFromTonnage(tonnageMin) {
  if (!tonnageMin) return null;
  if (tonnageMin <= 40) return 2; // tandem
  if (tonnageMin >= 50) return 3; // tri-axle
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
          // Only keep links on kaufmantrailers.com under detachable-gooseneck-trailers
          if (
            fullUrl.includes('kaufmantrailers.com') &&
            fullUrl.includes('/detachable-gooseneck-trailers/')
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
  const categoryPages = new Set(SEED_URLS.map((u) => u.replace(/\/$/, '') + '/'));

  const filtered = [...allLinks].filter((url) => {
    // Skip top-level category pages (they list products, not a single product)
    if (categoryPages.has(url)) return false;

    // Must have enough path segments to be a product detail page
    // e.g. /detachable-gooseneck-trailers/lowboy-trailers/35-ton-xxx/ (3+ segments)
    const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
    if (pathSegments.length < 2) return false;

    // Check that the URL or its text includes relevant keywords
    const urlLower = url.toLowerCase();
    const hasKeyword = LOWBOY_KEYWORDS.some((kw) => urlLower.includes(kw.replace(/\s+/g, '-')));
    // Also accept any URL deeply nested under detachable-gooseneck-trailers
    const isDeepPage = pathSegments.length >= 3;

    return hasKeyword || isDeepPage;
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
      '.entry-subtitle, .page-subtitle, .product-tagline, h2'
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
      '.wpb_wrapper p',
      '.vc_column-inner p',
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

    // --- Features list (Kaufman often uses bullet lists for features) ---
    const features = [];
    document.querySelectorAll('ul li, ol li').forEach((li) => {
      const t = li.textContent.trim();
      if (t.length > 10 && t.length < 300) {
        features.push(t);
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
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const valueMatch = fullText.match(
          new RegExp(escaped + '[:\\s]+(.+)', 'i')
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
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('data-srcset')?.split(',')[0]?.trim()?.split(' ')[0];
      if (!src) return;
      // Skip tiny icons, logos, etc.
      if (src.includes('logo') || src.includes('icon') || src.includes('favicon')) return;
      if (src.includes('.gif') || src.includes('.svg')) return;
      if (src.includes('gravatar') || src.includes('wp-content/plugins')) return;
      // Only keep Kaufman domain images or CDN / wp-content images
      if (!src.includes('kaufmantrailers.com') && !src.includes('wp-content')) return;

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
    } else if (/deck|height|length|width|clearance|swing|well/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
    } else if (/axle|suspension|tire|wheel|brake|ride/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch|trough|hook/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform|oak|decking/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural|cross.?member/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    } else if (/tool.?box|storage/i.test(keyLower)) {
      category = 'Accessories';
    } else if (/boom.?well|boom.?trough/i.test(keyLower)) {
      category = 'Boom Well';
    } else if (/outrigger/i.test(keyLower)) {
      category = 'Outriggers';
    }

    specs.push({ category, key, value, unit });
  }

  // Add notable features as specs under "Features" category
  for (const feature of features) {
    const dedup = `Feature|${feature}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    // Only include features that are likely spec-relevant
    const featureLower = feature.toLowerCase();
    if (
      /v[\s-]?shaped|self[\s-]?align|trough|toolbox|tool.?box|oak|decking|boom|outrigger|cross.?member|drop|flip|axle/i.test(featureLower)
    ) {
      specs.push({
        category: 'Features',
        key: 'Feature',
        value: feature,
        unit: null,
      });
    }
  }

  return specs;
}

/**
 * Build structured product data from scraped page data.
 */
function buildProduct(pageData) {
  const { name, tagline, description, shortDescription, features, specs: rawSpecs, sourceUrl } =
    pageData;

  // Combine all spec values for searching
  const allSpecText = rawSpecs.map((s) => `${s.rawKey}: ${s.rawValue}`).join(' ');
  const featuresText = (features || []).join(' ');
  const combinedText = `${name} ${description} ${allSpecText} ${featuresText}`;

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
  // Fallback: search name/description for tonnage
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
    if (/deck.?height|loaded.?height|load.?height/i.test(rawKey)) {
      deckHeightInches = parseDeckHeight(rawValue);
      if (deckHeightInches) break;
    }
  }
  // Fallback: look for deck height in combined text
  if (!deckHeightInches) {
    const dhMatch = combinedText.match(/deck.?height[:\s]*(\d+(?:\.\d+)?)\s*["''in]/i);
    if (dhMatch) {
      deckHeightInches = parseFloat(dhMatch[1]);
    }
  }

  // Deck / well length
  let deckLengthFeet = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?length|well.?length|loading.?length/i.test(rawKey)) {
      deckLengthFeet = parseLength(rawValue);
      if (deckLengthFeet) break;
    }
  }
  // Fallback: look for well length in combined text
  if (!deckLengthFeet) {
    const wlMatch = combinedText.match(/well.?(?:length)?[:\s]*(\d+)['']\s*/i);
    if (wlMatch) {
      deckLengthFeet = parseFloat(wlMatch[1]);
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
  // Also check description/features for axle info
  if (!axleCount) {
    axleCount = parseAxleCount(combinedText);
  }
  // Infer from tonnage as last resort
  if (!axleCount) {
    axleCount = inferAxleCountFromTonnage(tonnageMin);
  }

  // Empty weight
  let emptyWeightLbs = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/empty.?weight|tare.?weight|unladen|trailer.?weight/i.test(rawKey)) {
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

  // Build an enriched description that includes Kaufman's unique features
  let enrichedDescription = cleanText(description) || null;
  if (enrichedDescription && features && features.length > 0) {
    // Check if description already includes key features; if not, append a summary
    const descLower = (enrichedDescription || '').toLowerCase();
    const uniqueFeatures = [];
    const kaufmanSignatures = [
      'self-aligning V-shaped gooseneck trough',
      'lockable toolbox',
      'boom well trough and cover plate',
      '2" nominal air-dried white oak decking',
      '14" drop cross-members over axles',
    ];
    for (const sig of kaufmanSignatures) {
      if (!descLower.includes(sig.toLowerCase())) {
        // Check if this feature is mentioned in the scraped features
        const found = features.some((f) =>
          f.toLowerCase().includes(sig.toLowerCase().split(' ')[0])
        );
        if (found) uniqueFeatures.push(sig);
      }
    }
    // We don't modify the description -- just store it clean
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
    alt_text: img.alt || `${pageData.name} - Kaufman Trailers`,
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
