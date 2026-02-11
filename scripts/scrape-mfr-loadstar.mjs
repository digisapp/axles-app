// @ts-nocheck
/**
 * Scrape Loadstar Trailers lowboy/heavy-haul product catalog
 *
 * Loadstar Trailers (loadstartrailers.com) is a custom heavy-haul trailer
 * manufacturer based in Cobourg, Ontario, Canada. Operating since 1985 from
 * a 20,000 sq/ft facility, they build lowboys, heavy-duty step decks, heavy
 * tag trailers, and specialized heavy hauling systems rated from 20 to 80+ tons.
 *
 * This scraper visits their product category pages, extracts specs, images,
 * and descriptions, and upserts them into the manufacturer_products tables
 * via shared utilities.
 *
 * Note: Loadstar is a smaller custom manufacturer with fewer product pages
 * than larger OEMs. The scraper may yield fewer products — that is expected.
 *
 * Usage:  node scripts/scrape-mfr-loadstar.mjs
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

const MANUFACTURER_SLUG = 'loadstar';
const MANUFACTURER_NAME = 'Loadstar Trailers';
const WEBSITE = 'https://loadstartrailers.com';

/** Starting pages to discover lowboy / heavy-haul products */
const SEED_URLS = [
  'https://loadstartrailers.com/',
  'https://loadstartrailers.com/lowboy-trailers/',
  'https://loadstartrailers.com/heavy-duty-step-deck-trailers/',
  'https://loadstartrailers.com/heavy-tag-trailers/',
  'https://loadstartrailers.com/specialized-lowboy-heavy-hauling-systems/',
  'https://loadstartrailers.com/heavy-haul-trailers-for-sale/',
];

/**
 * Known product category pages — these double as product pages since Loadstar
 * is a smaller manufacturer with category-level detail rather than individual
 * model pages.
 */
const KNOWN_PRODUCT_PAGES = [
  'https://loadstartrailers.com/lowboy-trailers/',
  'https://loadstartrailers.com/heavy-duty-step-deck-trailers/',
  'https://loadstartrailers.com/heavy-tag-trailers/',
  'https://loadstartrailers.com/specialized-lowboy-heavy-hauling-systems/',
  'https://loadstartrailers.com/heavy-haul-trailers-for-sale/',
];

/**
 * Keywords that signal a page is a lowboy / heavy-haul product.
 * Used to filter discovered links.
 */
const LOWBOY_KEYWORDS = [
  'lowboy', 'low boy', 'detachable', 'gooseneck', 'step deck', 'step-deck',
  'tag trailer', 'heavy tag', 'heavy haul', 'hauling system', 'rgn',
  'booster', 'jeep', 'dolly', 'flip neck', 'multi-axle', 'specialized',
  'tonnage', 'axle', 'trailer',
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
 * Determine the product_type from a product name / description / URL.
 */
function classifyProductType(name, description = '', url = '') {
  const text = `${name} ${description} ${url}`.toLowerCase();
  if (/specialized|hauling.?system|80\+?\s*ton|9\+?\s*axle/.test(text)) return 'lowboy';
  if (/step.?deck/.test(text)) return 'step-deck';
  if (/tag.?trailer|heavy.?tag/.test(text)) return 'tag-along';
  if (/lowboy|low.?boy|rgn|detachable.?gooseneck/.test(text)) return 'lowboy';
  if (/for.?sale/.test(text)) return 'lowboy'; // their for-sale page features lowboys
  return 'lowboy'; // default for Loadstar heavy-haul
}

/**
 * Determine the gooseneck_type from product name / URL / description.
 */
function classifyGooseneckType(name, description = '', url = '') {
  const text = `${name} ${description} ${url}`.toLowerCase();
  if (/step.?deck/.test(text)) return 'fixed';
  if (/tag.?trailer|heavy.?tag/.test(text)) return 'fixed';
  if (/hydraulic.?detach/.test(text)) return 'hydraulic-detachable';
  if (/rgn|lowboy|low.?boy|specialized|hauling.?system/.test(text)) return 'hydraulic-detachable';
  if (/detach/.test(text)) return 'detachable';
  return null;
}

/**
 * Detect a series / product-line name from the page name and URL.
 */
function detectSeries(name, url = '') {
  const text = `${name} ${url}`.toLowerCase();
  if (/specialized|hauling.?system/.test(text)) return 'Specialized Heavy Hauling Systems';
  if (/step.?deck/.test(text)) return 'Heavy Duty Step Deck';
  if (/heavy.?tag/.test(text)) return 'Heavy Tag';
  if (/lowboy/.test(text)) return 'Lowboy';
  return null;
}

/**
 * Try to extract a model number from the product name / heading.
 * Loadstar may not use formal model numbers on every page.
 */
function extractModelNumber(name) {
  const text = name.toUpperCase();
  // Match patterns like LS-50, LS50, LOADSTAR-85
  const lsMatch = text.match(/LS[-\s]?\d+/);
  if (lsMatch) return lsMatch[0].replace(/\s/g, '');
  // Match generic numeric model patterns
  const numMatch = text.match(/\b([A-Z]{1,4}[-\s]?\d{2,4})\b/);
  if (numMatch) return numMatch[1].replace(/\s/g, '');
  return null;
}

/**
 * Parse axle count from spec text.
 */
function parseAxleCount(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:axle|axles)/i);
  if (match) return parseInt(match[1], 10);
  // Ranges like "3 to 4"
  const rangeMatch = text.match(/(\d+)\s*(?:to|-|–)\s*(\d+)/i);
  if (rangeMatch) return parseInt(rangeMatch[2], 10); // return the higher count
  const numMatch = text.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return null;
}

/**
 * Try to extract tonnage info from descriptive text when specs tables
 * are absent. Handles patterns like "50 to 85 tons" or "80+ tons".
 */
function extractTonnageFromText(text) {
  if (!text) return { min: null, max: null };
  const lower = text.toLowerCase();

  // Range: "50 to 85 tons" / "50-85 ton"
  const rangeMatch = lower.match(/(\d+)\s*(?:to|[-–])\s*(\d+)\s*ton/i);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1], 10),
      max: parseInt(rangeMatch[2], 10),
    };
  }

  // "80+ tons" / "80 plus tons"
  const plusMatch = lower.match(/(\d+)\+?\s*(?:plus\s+)?ton/i);
  if (plusMatch) {
    const val = parseInt(plusMatch[1], 10);
    return { min: val, max: val };
  }

  return { min: null, max: null };
}

/**
 * Try to extract deck height from descriptive text.
 */
function extractDeckHeightFromText(text) {
  if (!text) return null;
  // "18-24 inches" / "deck height: 18""
  const match = text.match(/(\d+)\s*(?:[-–]?\s*\d+\s*)?(?:"|in(?:ch|ches)?)\s*(?:deck|loaded)?/i);
  if (match) return parseFloat(match[1]);
  const deckMatch = text.match(/deck\s*height[:\s]*(\d+)/i);
  if (deckMatch) return parseFloat(deckMatch[1]);
  return null;
}

/**
 * Try to extract axle count from descriptive text.
 */
function extractAxleCountFromText(text) {
  if (!text) return null;
  // "3-axle and 4-axle" → take the higher
  const multiMatch = text.match(/(\d+)\s*[-–]?\s*axle\s*(?:and|&|\/)\s*(\d+)\s*[-–]?\s*axle/i);
  if (multiMatch) return parseInt(multiMatch[2], 10);
  // "5 to 9+ axles"
  const rangeMatch = text.match(/(\d+)\s*(?:to|[-–])\s*(\d+)\+?\s*axle/i);
  if (rangeMatch) return parseInt(rangeMatch[2], 10);
  // Single: "3-axle"
  const singleMatch = text.match(/(\d+)\s*[-–]?\s*axle/i);
  if (singleMatch) return parseInt(singleMatch[1], 10);
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
          // Only keep links on loadstartrailers.com
          if (fullUrl.includes('loadstartrailers.com')) {
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

  // Filter to product pages using keyword matching
  const filtered = [...allLinks].filter((url) => {
    const urlLower = url.toLowerCase();

    // Skip obvious non-product pages
    if (urlLower === 'https://loadstartrailers.com/') return false;
    if (urlLower.includes('/contact')) return false;
    if (urlLower.includes('/about')) return false;
    if (urlLower.includes('/privacy')) return false;
    if (urlLower.includes('/terms')) return false;
    if (urlLower.includes('/blog')) return false;
    if (urlLower.includes('/news')) return false;
    if (urlLower.includes('/cart')) return false;
    if (urlLower.includes('/checkout')) return false;
    if (urlLower.includes('/my-account')) return false;
    if (urlLower.includes('/wp-admin')) return false;
    if (urlLower.includes('/wp-content')) return false;
    if (urlLower.includes('/wp-includes')) return false;
    if (urlLower.includes('#')) return false;
    if (urlLower.includes('?')) return false;
    if (urlLower.endsWith('.pdf/') || urlLower.endsWith('.pdf')) return false;

    // Check if any keyword appears in the URL
    return LOWBOY_KEYWORDS.some((kw) => urlLower.includes(kw.replace(/\s/g, '-')) || urlLower.includes(kw.replace(/\s/g, '')));
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
      '.elementor-widget-text-editor p',
      '.wpb_text_column p',
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

    // Spec-like key/value pairs in list items
    document.querySelectorAll('li, .spec-item, .feature-item').forEach((li) => {
      const text = li.textContent.trim();
      const kvMatch = text.match(/^([^:]{3,50}):\s*(.+)$/);
      if (kvMatch) {
        specs.push({ rawKey: kvMatch[1].trim(), rawValue: kvMatch[2].trim() });
      }
    });

    // strong/b tags followed by text (common spec format)
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

    // --- Feature bullets (non-key/value list items for features list) ---
    const features = [];
    document.querySelectorAll('li').forEach((li) => {
      const text = li.textContent.trim();
      // Only capture items that look like feature descriptions (not key:value)
      if (text.length > 10 && text.length < 300 && !text.includes(':')) {
        features.push(text);
      }
    });

    // --- Headings for sub-product detection ---
    const headings = [];
    document.querySelectorAll('h2, h3, h4').forEach((h) => {
      const t = h.textContent.trim();
      if (t.length > 3) headings.push(t);
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
      // Only keep Loadstar domain images or CDN / wp-content images
      if (!src.includes('loadstartrailers.com') && !src.includes('wp-content')) return;

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

    // --- Body text for classification ---
    const bodyText = document.body ? document.body.textContent.substring(0, 8000) : '';

    return {
      name,
      tagline,
      description,
      shortDescription,
      specs,
      features,
      headings,
      images,
      bodyText,
    };
  });

  if (!pageData || !pageData.name) {
    console.log('    No product name found, skipping');
    return null;
  }

  console.log(`    Name: ${pageData.name}`);
  console.log(`    Specs found: ${pageData.specs.length}`);
  console.log(`    Features found: ${pageData.features.length}`);
  console.log(`    Headings found: ${pageData.headings.length}`);
  console.log(`    Images found: ${pageData.images.length}`);

  return { ...pageData, sourceUrl: url };
}

/**
 * Try to detect sub-products within a category page.
 * Loadstar often lists multiple configurations (e.g. 3-axle, 4-axle)
 * on a single category page. We split them into separate products
 * when we can identify distinct configurations from headings or text.
 */
function detectSubProducts(pageData) {
  const { name, headings, bodyText, description } = pageData;
  const nameLower = name.toLowerCase();
  const subProducts = [];

  // Check for axle-based sub-products in headings
  const axleHeadings = headings.filter((h) =>
    /\d\s*[-–]?\s*axle/i.test(h) || /\d\s*axle/i.test(h)
  );

  if (axleHeadings.length > 1) {
    // Multiple axle configurations found — split into sub-products
    for (const heading of axleHeadings) {
      const axleMatch = heading.match(/(\d+)\s*[-–]?\s*axle/i);
      if (axleMatch) {
        subProducts.push({
          suffix: `${axleMatch[1]}-Axle`,
          axleCount: parseInt(axleMatch[1], 10),
          heading,
        });
      }
    }
  }

  // If no sub-products detected from headings, try to detect from
  // description content
  if (subProducts.length === 0 && description) {
    const descLower = description.toLowerCase();

    // Lowboy page: 3-axle and 4-axle
    if (nameLower.includes('lowboy') && !nameLower.includes('specialized')) {
      if (/3\s*[-–]?\s*axle/i.test(descLower) && /4\s*[-–]?\s*axle/i.test(descLower)) {
        subProducts.push(
          { suffix: '3-Axle', axleCount: 3, heading: '' },
          { suffix: '4-Axle', axleCount: 4, heading: '' }
        );
      }
    }
  }

  return subProducts;
}

// ---------------------------------------------------------------------------
// Spec categorization
// ---------------------------------------------------------------------------

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

    let category = 'General';
    let unit = null;

    if (/capacity|payload|gvwr|weight|tonnage|ton|rating/i.test(keyLower)) {
      category = 'Capacity';
      if (/lbs?|pounds?/i.test(value)) unit = 'lbs';
      else if (/ton/i.test(value)) unit = 'tons';
    } else if (/deck|height|length|width|clearance|swing|spread/i.test(keyLower)) {
      category = 'Dimensions';
      if (/["'']/i.test(value) || /inch/i.test(value)) unit = 'in';
      else if (/['']/i.test(value) || /feet|ft/i.test(value)) unit = 'ft';
    } else if (/axle|suspension|tire|wheel|brake|steer/i.test(keyLower)) {
      category = 'Running Gear';
    } else if (/gooseneck|kingpin|hitch|neck/i.test(keyLower)) {
      category = 'Gooseneck';
    } else if (/hydraulic|cylinder|pump/i.test(keyLower)) {
      category = 'Hydraulics';
    } else if (/deck|floor|wood|platform/i.test(keyLower)) {
      category = 'Decking';
    } else if (/light|electric|wiring|harness/i.test(keyLower)) {
      category = 'Electrical';
    } else if (/frame|beam|steel|structural|rail|main.?rail|sill/i.test(keyLower)) {
      category = 'Frame';
    } else if (/paint|finish|coating/i.test(keyLower)) {
      category = 'Finish';
    } else if (/certif|cmvss|fmvss|approv/i.test(keyLower)) {
      category = 'Certifications';
    }

    specs.push({ category, key, value, unit });
  }

  return specs;
}

// ---------------------------------------------------------------------------
// Product builders
// ---------------------------------------------------------------------------

/**
 * Build default product-level tonnage/deckHeight/axle info
 * based on product line when page data is sparse.
 */
function applyProductLineDefaults(product, url) {
  const urlLower = url.toLowerCase();

  // Lowboy trailers
  if (urlLower.includes('lowboy-trailer') && !urlLower.includes('specialized')) {
    if (!product.tonnage_min) { product.tonnage_min = 50; product.tonnage_max = 85; }
    if (!product.deck_height_inches) product.deck_height_inches = 18;
  }

  // Heavy duty step deck
  if (urlLower.includes('step-deck')) {
    if (!product.tonnage_min) { product.tonnage_min = 35; product.tonnage_max = 50; }
  }

  // Heavy tag trailers
  if (urlLower.includes('heavy-tag')) {
    if (!product.tonnage_min) { product.tonnage_min = 20; product.tonnage_max = 40; }
  }

  // Specialized heavy hauling systems
  if (urlLower.includes('specialized')) {
    if (!product.tonnage_min) { product.tonnage_min = 80; product.tonnage_max = 80; }
  }

  return product;
}

/**
 * Build structured product data from scraped page data.
 */
function buildProduct(pageData) {
  const {
    name,
    tagline,
    description,
    shortDescription,
    specs: rawSpecs,
    features,
    bodyText,
    sourceUrl,
  } = pageData;

  // Combine all spec values for searching
  const allSpecText = rawSpecs.map((s) => `${s.rawKey}: ${s.rawValue}`).join(' ');
  const combinedText = `${name} ${description} ${allSpecText} ${bodyText}`;

  // Tonnage
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
  // Fallback: search combined text for tonnage
  if (!tonnageMin) {
    const t = extractTonnageFromText(combinedText);
    tonnageMin = t.min;
    tonnageMax = t.max;
  }

  // Deck height
  let deckHeightInches = null;
  for (const { rawKey, rawValue } of rawSpecs) {
    if (/deck.?height|loaded.?height/i.test(rawKey)) {
      deckHeightInches = parseDeckHeight(rawValue);
      if (deckHeightInches) break;
    }
  }
  if (!deckHeightInches) {
    deckHeightInches = extractDeckHeightFromText(combinedText);
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
  if (!axleCount) {
    axleCount = extractAxleCountFromText(combinedText);
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
  const productType = classifyProductType(name, description, sourceUrl);
  const gooseneckType = classifyGooseneckType(name, description, sourceUrl);

  // Build enriched description with features if available
  let fullDescription = cleanText(description) || null;
  if (features && features.length > 0) {
    const featureText = features.map((f) => `- ${f}`).join('\n');
    fullDescription = fullDescription
      ? `${fullDescription}\n\nKey Features:\n${featureText}`
      : `Key Features:\n${featureText}`;
  }

  let product = {
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

  // Apply sensible defaults from known product line specs when page data
  // is sparse (common for smaller manufacturers)
  product = applyProductLineDefaults(product, sourceUrl);

  return product;
}

/**
 * Build a sub-product by cloning the base product and overriding axle-specific fields.
 */
function buildSubProduct(baseProduct, subConfig, sourceUrl) {
  const subName = `${baseProduct.name} ${subConfig.suffix}`;
  const product = { ...baseProduct };
  product.name = subName;
  product.axle_count = subConfig.axleCount;
  product.source_url = sourceUrl;

  // Adjust tonnage ranges for known sub-configurations
  const nameLower = baseProduct.name.toLowerCase();

  if (nameLower.includes('lowboy') && !nameLower.includes('specialized')) {
    if (subConfig.axleCount === 3) {
      product.tonnage_min = 50;
      product.tonnage_max = 65;
    } else if (subConfig.axleCount === 4) {
      product.tonnage_min = 65;
      product.tonnage_max = 85;
    }
  }

  if (nameLower.includes('step deck') || nameLower.includes('step-deck')) {
    if (subConfig.axleCount <= 3) {
      product.tonnage_min = 35;
      product.tonnage_max = 40;
    } else if (subConfig.axleCount === 4) {
      product.tonnage_min = 40;
      product.tonnage_max = 45;
    } else if (subConfig.axleCount >= 5) {
      product.tonnage_min = 45;
      product.tonnage_max = 50;
    }
  }

  if (nameLower.includes('tag')) {
    if (subConfig.axleCount === 2) {
      product.tonnage_min = 20;
      product.tonnage_max = 30;
    } else if (subConfig.axleCount === 3) {
      product.tonnage_min = 30;
      product.tonnage_max = 40;
    }
  }

  return product;
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
      console.warn('  No product pages discovered via crawling. Using known pages only.');
    }

    // Merge with known product pages and deduplicate
    const allUrls = new Set(productUrls.map((u) => u.replace(/\/$/, '') + '/'));
    KNOWN_PRODUCT_PAGES.forEach((u) => allUrls.add(u));
    const uniqueUrls = [...allUrls];

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

        // Check for sub-products (e.g. 3-axle vs 4-axle variants)
        const subProducts = detectSubProducts(pageData);

        if (subProducts.length > 1) {
          console.log(`    Detected ${subProducts.length} sub-product configurations`);

          // Build base product data
          const baseProduct = buildProduct(pageData);
          const images = buildImages(pageData);
          const specs = categorizeSpecs(pageData.specs);

          // Create a product for each sub-configuration
          for (const subConfig of subProducts) {
            const product = buildSubProduct(baseProduct, subConfig, url);

            console.log(`\n    Sub-product: ${product.name}`);
            console.log(`      Product type: ${product.product_type}`);
            console.log(`      Series: ${product.series || 'N/A'}`);
            console.log(`      Axles: ${product.axle_count || 'N/A'}`);
            console.log(`      Tonnage: ${product.tonnage_min || '?'}-${product.tonnage_max || '?'} ton`);
            console.log(`      Gooseneck: ${product.gooseneck_type || 'N/A'}`);

            const productId = await upsertProduct(supabase, manufacturerId, product);
            if (!productId) {
              console.error(`      Failed to upsert sub-product: ${product.name}`);
              stats.errors++;
              continue;
            }

            await upsertProductImages(supabase, productId, images);
            await upsertProductSpecs(supabase, productId, specs);
            stats.upserted++;
            console.log(`      Upserted product ID: ${productId}`);
          }
        } else {
          // Single product from this page
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
        }
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
