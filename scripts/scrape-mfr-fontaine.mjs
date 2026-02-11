// @ts-nocheck
/**
 * Fontaine Specialized — Lowboy / Heavy-Haul Product Catalog Scraper
 *
 * Scrapes product data from fontainespecialized.com and upserts into
 * the manufacturer_products, manufacturer_product_images, and
 * manufacturer_product_specs tables via the shared scraper utilities.
 *
 * Product lines covered:
 *   - Magnitude Series (40, 55, 55L, 55MX, 60, 60HD, 65, etc.)
 *   - Workhorse (fixed-gooseneck / HDG lowboy)
 *   - Renegade (removable gooseneck double-drop)
 *   - Traverse HT (hydraulic tail)
 *   - Xcalibur (extendable)
 *
 * Usage:
 *   node scripts/scrape-mfr-fontaine.mjs
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

const MANUFACTURER_NAME = 'Fontaine Specialized';
const WEBSITE = 'https://www.fontainespecialized.com';
const MANUFACTURER_SLUGS = ['fontaine-specialized', 'fontaine'];

/** Delay between page navigations (ms) */
const NAV_DELAY = 2500;

/**
 * Top-level product-line pages to scan for individual model links.
 * Each entry also carries metadata that helps classify products found
 * on that page when the page itself does not provide enough detail.
 */
const PRODUCT_LINE_PAGES = [
  {
    url: `${WEBSITE}/magnitude`,
    series: 'Magnitude',
    defaultType: 'lowboy',
    defaultGooseneck: 'hydraulic-detachable',
  },
  {
    url: `${WEBSITE}/workhorse`,
    series: 'Workhorse',
    defaultType: 'lowboy',
    defaultGooseneck: 'hydraulic-detachable',
  },
  {
    url: `${WEBSITE}/renegade`,
    series: 'Renegade',
    defaultType: 'rgn',
    defaultGooseneck: 'mechanical-detachable',
  },
  {
    url: `${WEBSITE}/xcalibur`,
    series: 'Xcalibur',
    defaultType: 'extendable',
    defaultGooseneck: 'fixed',
  },
  {
    url: `${WEBSITE}/solution/construction`,
    series: null,
    defaultType: 'lowboy',
    defaultGooseneck: 'hydraulic-detachable',
  },
  {
    url: `${WEBSITE}/solution/commercial`,
    series: null,
    defaultType: 'double-drop',
    defaultGooseneck: 'mechanical-detachable',
  },
  {
    url: `${WEBSITE}/solution/extendable`,
    series: null,
    defaultType: 'extendable',
    defaultGooseneck: 'fixed',
  },
  {
    url: `${WEBSITE}/solution/hydraulic-tail`,
    series: null,
    defaultType: 'lowboy',
    defaultGooseneck: 'hydraulic-detachable',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to resolve the manufacturer ID from one of the known slugs.
 */
async function resolveManufacturerId(supabase) {
  for (const slug of MANUFACTURER_SLUGS) {
    try {
      const id = await getManufacturerId(supabase, slug);
      console.log(`  Manufacturer found with slug "${slug}" -> ${id}`);
      return id;
    } catch {
      // slug not found, try next
    }
  }
  throw new Error(
    `Manufacturer not found for any of: ${MANUFACTURER_SLUGS.join(', ')}`
  );
}

/**
 * Classify a product by its name / URL into a product_type and gooseneck_type.
 */
function classifyProduct(name, url, fallbackType, fallbackGooseneck) {
  const lower = (name + ' ' + url).toLowerCase();

  let productType = fallbackType || 'lowboy';
  let gooseneckType = fallbackGooseneck || 'hydraulic-detachable';

  // Product type classification
  if (/step[\s-]?deck/i.test(lower)) {
    productType = 'step-deck';
  } else if (/flatbed/i.test(lower) || /flat[\s-]?level[\s-]?deck/i.test(lower) || /\bmfld\b/i.test(lower)) {
    productType = 'lowboy'; // MFLD is still a lowboy variant
  } else if (/double[\s-]?drop/i.test(lower)) {
    productType = 'double-drop';
  } else if (/extendab/i.test(lower) || /xcalibur/i.test(lower) || /\bmx\b/i.test(lower)) {
    productType = 'extendable';
  } else if (/rgn|removable[\s-]?gooseneck/i.test(lower)) {
    productType = 'rgn';
  } else if (/tag[\s-]?along/i.test(lower)) {
    productType = 'tag-along';
  } else if (/modular/i.test(lower) && !/magnitude/i.test(lower)) {
    productType = 'modular';
  } else if (/traveling[\s-]?axle/i.test(lower)) {
    productType = 'traveling-axle';
  } else if (/hydraulic[\s-]?tail/i.test(lower) || /traverse/i.test(lower)) {
    productType = 'lowboy';
  } else if (/renegade/i.test(lower)) {
    productType = 'rgn';
  } else if (/magnitude|workhorse/i.test(lower)) {
    productType = 'lowboy';
  }

  // Gooseneck type classification
  if (/\bhdg\b|hydraulic[\s-]?detach/i.test(lower)) {
    gooseneckType = 'hydraulic-detachable';
  } else if (/mechanical[\s-]?detach/i.test(lower)) {
    gooseneckType = 'mechanical-detachable';
  } else if (/removable[\s-]?gooseneck|rgn/i.test(lower)) {
    gooseneckType = 'mechanical-detachable';
  } else if (/fixed[\s-]?gooseneck|fixed[\s-]?neck/i.test(lower)) {
    gooseneckType = 'fixed';
  } else if (/folding/i.test(lower)) {
    gooseneckType = 'folding';
  } else if (/non[\s-]?ground[\s-]?bearing/i.test(lower)) {
    gooseneckType = 'non-ground-bearing';
  } else if (/renegade/i.test(lower)) {
    // Renegade uses hook & shaft hydraulic removable
    gooseneckType = 'hydraulic-detachable';
  } else if (/magnitude|workhorse/i.test(lower)) {
    gooseneckType = 'hydraulic-detachable';
  }

  return { productType, gooseneckType };
}

/**
 * Detect the series from name or URL when not explicitly provided.
 */
function detectSeries(name, url) {
  const lower = (name + ' ' + url).toLowerCase();
  if (/magnitude/i.test(lower)) return 'Magnitude';
  if (/workhorse/i.test(lower)) return 'Workhorse';
  if (/renegade/i.test(lower)) return 'Renegade';
  if (/xcalibur/i.test(lower)) return 'Xcalibur';
  if (/traverse/i.test(lower)) return 'Traverse';
  return null;
}

/**
 * Extract model number from name, e.g. "Magnitude 55MX" -> "55MX"
 */
function extractModelNumber(name) {
  // Try pattern like "Magnitude 55MX" or "Workhorse 55PVR Pro"
  const match = name.match(/(?:Magnitude|Workhorse|Renegade|Xcalibur|Traverse)\s+([\w\d]+(?:\s+\w+)?)/i);
  if (match) return match[1].trim();

  // Try pattern like "55 Ton" numbers at start
  const numMatch = name.match(/^(\d+[\w]*)/);
  if (numMatch) return numMatch[1];

  return null;
}

/**
 * Safe page.goto with retry logic.
 */
async function safeGoto(page, url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000,
      });
      if (response && response.status() === 403) {
        console.warn(`  [WARN] 403 Forbidden: ${url}`);
        if (attempt < retries) {
          console.log(`  Retrying in 5s... (attempt ${attempt + 2}/${retries + 1})`);
          await sleep(5000);
          continue;
        }
        return null;
      }
      return response;
    } catch (err) {
      if (attempt < retries) {
        console.warn(`  [WARN] Navigation failed for ${url}: ${err.message}`);
        console.log(`  Retrying in 5s... (attempt ${attempt + 2}/${retries + 1})`);
        await sleep(5000);
      } else {
        console.error(`  [ERROR] Failed to load ${url} after ${retries + 1} attempts: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core scraping functions
// ---------------------------------------------------------------------------

/**
 * Discover product links from a product-line page.
 * Returns an array of { url, name, series, defaultType, defaultGooseneck }.
 */
async function discoverProductLinks(page, linePageConfig) {
  const { url, series, defaultType, defaultGooseneck } = linePageConfig;

  console.log(`\n  Discovering products on: ${url}`);
  const response = await safeGoto(page, url);
  if (!response) return [];

  await sleep(1500);

  // Extract all links that look like product / compare-trailer pages
  const links = await page.evaluate((baseUrl) => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const results = [];
    const seen = new Set();

    for (const a of anchors) {
      let href = a.href;
      if (!href) continue;

      // Normalize
      try {
        const u = new URL(href, baseUrl);
        href = u.href;
      } catch {
        continue;
      }

      // Only links on fontainespecialized.com
      if (!href.includes('fontainespecialized.com')) continue;

      // Filter for product-ish URLs
      const isProductLink =
        href.includes('/compare-trailers/') ||
        href.includes('/workhorse-') ||
        href.includes('/renegade-') ||
        href.includes('/xcalibur-') ||
        href.includes('/traverse-') ||
        href.includes('/magnitude-');

      // Also look for links that go to named product pages but not top-level sections
      const isSubPage =
        !href.endsWith('/magnitude') &&
        !href.endsWith('/workhorse') &&
        !href.endsWith('/renegade') &&
        !href.endsWith('/xcalibur') &&
        !href.endsWith('/solution/construction') &&
        !href.endsWith('/solution/commercial') &&
        !href.endsWith('/solution/extendable') &&
        !href.endsWith('/solution/hydraulic-tail') &&
        !href.endsWith('/about-us') &&
        !href.endsWith('/literature') &&
        !href.endsWith('/news') &&
        !href.endsWith('/contact') &&
        !href.endsWith('/flip-axles') &&
        !href.endsWith('/build-my-trailer/all') &&
        !href.endsWith('/');

      if (isProductLink && isSubPage && !seen.has(href)) {
        seen.add(href);
        const text = (a.textContent || '').trim();
        results.push({ url: href, linkText: text });
      }
    }
    return results;
  }, WEBSITE);

  console.log(`    Found ${links.length} product link(s)`);

  return links.map((link) => ({
    url: link.url,
    name: link.linkText || '',
    series: series || detectSeries(link.linkText, link.url),
    defaultType,
    defaultGooseneck,
  }));
}

/**
 * Also discover products by scraping the "Build My Trailer" / compare pages.
 */
async function discoverFromBuildPage(page) {
  const buildUrl = `${WEBSITE}/build-my-trailer/all`;
  console.log(`\n  Discovering products from Build My Trailer: ${buildUrl}`);

  const response = await safeGoto(page, buildUrl);
  if (!response) return [];

  await sleep(2000);

  const links = await page.evaluate((baseUrl) => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const results = [];
    const seen = new Set();

    for (const a of anchors) {
      let href = a.href;
      if (!href) continue;
      try {
        const u = new URL(href, baseUrl);
        href = u.href;
      } catch {
        continue;
      }

      if (!href.includes('fontainespecialized.com')) continue;
      if (href.includes('/compare-trailers/') && !seen.has(href)) {
        seen.add(href);
        const text = (a.textContent || '').trim();
        results.push({ url: href, linkText: text });
      }
    }
    return results;
  }, WEBSITE);

  console.log(`    Found ${links.length} product link(s) from Build page`);

  return links.map((link) => ({
    url: link.url,
    name: link.linkText || '',
    series: detectSeries(link.linkText, link.url),
    defaultType: 'lowboy',
    defaultGooseneck: 'hydraulic-detachable',
  }));
}

/**
 * Scrape a single product detail page and return structured data.
 */
async function scrapeProductPage(page, productLink) {
  const { url: productUrl, series: fallbackSeries, defaultType, defaultGooseneck } = productLink;

  console.log(`\n  Scraping: ${productUrl}`);
  const response = await safeGoto(page, productUrl);
  if (!response) {
    return null;
  }

  await sleep(1000);

  // Extract data from the page
  const rawData = await page.evaluate(() => {
    // Helper to get text content safely
    const getText = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : '';
    };

    // Product name: try several selectors
    let name =
      getText('h1') ||
      getText('.product-title') ||
      getText('.hero-title') ||
      getText('[class*="title"]') ||
      document.title.split('|')[0].trim();

    // Description: look for body text / descriptions
    let description = '';
    const descSelectors = [
      '.product-description',
      '.product-content p',
      '.hero-description',
      '.content-section p',
      'main p',
      '[class*="description"]',
      '.entry-content p',
    ];
    for (const sel of descSelectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        description = Array.from(els)
          .map((el) => el.textContent.trim())
          .filter(Boolean)
          .join(' ')
          .substring(0, 2000);
        if (description.length > 50) break;
      }
    }

    // Tagline: typically a subtitle or short phrase
    let tagline =
      getText('.hero-subtitle') ||
      getText('.product-subtitle') ||
      getText('[class*="subtitle"]') ||
      getText('[class*="tagline"]') ||
      '';

    // Specs: look for spec tables, definition lists, or key-value pairs
    const specsRaw = [];

    // Try table rows
    const specTables = document.querySelectorAll('table');
    for (const table of specTables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          specsRaw.push({
            key: cells[0].textContent.trim(),
            value: cells[1].textContent.trim(),
          });
        }
      }
    }

    // Try definition lists
    const dlElements = document.querySelectorAll('dl');
    for (const dl of dlElements) {
      const dts = dl.querySelectorAll('dt');
      const dds = dl.querySelectorAll('dd');
      for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
        specsRaw.push({
          key: dts[i].textContent.trim(),
          value: dds[i].textContent.trim(),
        });
      }
    }

    // Try key-value pairs in spec sections
    const specSections = document.querySelectorAll(
      '[class*="spec"], [class*="Spec"], [class*="feature"], [class*="detail"]'
    );
    for (const section of specSections) {
      const items = section.querySelectorAll('li, div, p');
      for (const item of items) {
        const text = item.textContent.trim();
        // Match patterns like "Capacity: 55 tons" or "Deck Width: 8'6\""
        const kvMatch = text.match(/^([^:]+):\s*(.+)$/);
        if (kvMatch) {
          specsRaw.push({
            key: kvMatch[1].trim(),
            value: kvMatch[2].trim(),
          });
        }
      }
    }

    // Also scan all text for spec-like patterns in the main content
    const allText = document.body ? document.body.innerText : '';

    // Images
    const images = [];
    const imgSelectors = [
      '.product-image img',
      '.hero-image img',
      '.gallery img',
      '[class*="gallery"] img',
      '[class*="slider"] img',
      '[class*="carousel"] img',
      'main img',
      '.content img',
      'article img',
      'picture source',
      'img[src*="fontaine"]',
      'img[src*="trailer"]',
      'img[data-src]',
    ];

    const seenUrls = new Set();
    for (const sel of imgSelectors) {
      const imgs = document.querySelectorAll(sel);
      for (const img of imgs) {
        const src =
          img.getAttribute('src') ||
          img.getAttribute('data-src') ||
          img.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0] ||
          '';
        if (!src) continue;
        let fullUrl = src;
        try {
          fullUrl = new URL(src, window.location.origin).href;
        } catch {
          continue;
        }
        // Filter out tiny icons, svgs, tracking pixels
        if (
          fullUrl.includes('.svg') ||
          fullUrl.includes('icon') ||
          fullUrl.includes('logo') ||
          fullUrl.includes('favicon') ||
          fullUrl.includes('pixel') ||
          fullUrl.includes('1x1') ||
          fullUrl.includes('spacer')
        ) {
          continue;
        }
        if (!seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          images.push({
            url: fullUrl,
            alt: img.getAttribute('alt') || '',
          });
        }
      }
    }

    return {
      name,
      tagline,
      description,
      specsRaw,
      images,
      allText: allText.substring(0, 5000),
      pageUrl: window.location.href,
    };
  });

  if (!rawData || !rawData.name) {
    console.warn('    [WARN] Could not extract product name, skipping.');
    return null;
  }

  // Build the final product name — clean it up
  let productName = cleanText(rawData.name);
  // If the name is the site title, try to derive from URL
  if (
    !productName ||
    productName.toLowerCase().includes('fontaine specialized') ||
    productName.toLowerCase() === 'submit your inquiry'
  ) {
    // Derive name from URL slug
    const urlSlug = productUrl.split('/').pop() || '';
    productName = urlSlug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .substring(0, 120);
  }

  // Trim common suffixes
  productName = productName
    .replace(/\|\s*Fontaine.*/i, '')
    .replace(/\|\s*Submit.*/i, '')
    .replace(/Submit your inquiry/i, '')
    .trim();

  // If name is still super long (from URL-based compare pages), shorten
  if (productName.length > 80) {
    // Try to extract just the model designation
    const shortMatch = productName.match(
      /(Magnitude\s+\w+|Workhorse\s+\w+|Renegade\s+\w+|Xcalibur\s+\w+|Traverse\s+\w+)/i
    );
    if (shortMatch) {
      productName = shortMatch[1];
    } else {
      productName = productName.substring(0, 80).trim();
    }
  }

  const series = fallbackSeries || detectSeries(productName, productUrl);
  const modelNumber = extractModelNumber(productName);
  const { productType, gooseneckType } = classifyProduct(
    productName,
    productUrl,
    defaultType,
    defaultGooseneck
  );

  // Parse specs from raw data
  const specs = [];
  let tonnageMin = null;
  let tonnageMax = null;
  let deckHeightInches = null;
  let deckLengthFeet = null;
  let overallLengthFeet = null;
  let axleCount = null;
  let emptyWeightLbs = null;
  let gvwrLbs = null;
  let concentratedCapacityLbs = null;

  for (const spec of rawData.specsRaw) {
    const keyLower = spec.key.toLowerCase();
    const val = spec.value;

    // Categorize and parse
    if (/capacity|tonnage|payload|rating/i.test(keyLower)) {
      const tonnage = parseTonnage(val);
      if (tonnage.min) {
        tonnageMin = tonnageMin ? Math.min(tonnageMin, tonnage.min) : tonnage.min;
        tonnageMax = tonnageMax ? Math.max(tonnageMax, tonnage.max) : tonnage.max;
      }
      const weight = parseWeight(val);
      if (weight && weight > 10000) {
        concentratedCapacityLbs = concentratedCapacityLbs
          ? Math.max(concentratedCapacityLbs, weight)
          : weight;
      }
      const unit = /ton/i.test(val) ? 'tons' : /lbs?|pound/i.test(val) ? 'lbs' : '';
      specs.push({ category: 'Capacity', key: cleanText(spec.key), value: cleanText(val), unit });
    } else if (/deck\s*height|loaded\s*deck/i.test(keyLower)) {
      const dh = parseDeckHeight(val);
      if (dh) deckHeightInches = dh;
      specs.push({ category: 'Dimensions', key: cleanText(spec.key), value: cleanText(val), unit: 'in' });
    } else if (/deck\s*(?:length|len)/i.test(keyLower)) {
      const dl = parseLength(val);
      if (dl) deckLengthFeet = dl;
      specs.push({ category: 'Dimensions', key: cleanText(spec.key), value: cleanText(val), unit: 'ft' });
    } else if (/overall\s*length|total\s*length/i.test(keyLower)) {
      const ol = parseLength(val);
      if (ol) overallLengthFeet = ol;
      specs.push({ category: 'Dimensions', key: cleanText(spec.key), value: cleanText(val), unit: 'ft' });
    } else if (/deck\s*width/i.test(keyLower)) {
      specs.push({ category: 'Dimensions', key: cleanText(spec.key), value: cleanText(val), unit: 'ft' });
    } else if (/axle/i.test(keyLower) && /count|number|qty|configuration/i.test(keyLower)) {
      const axleMatch = val.match(/(\d+)/);
      if (axleMatch) axleCount = parseInt(axleMatch[1], 10);
      specs.push({ category: 'Axles', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    } else if (/axle\s*spread/i.test(keyLower)) {
      specs.push({ category: 'Axles', key: cleanText(spec.key), value: cleanText(val), unit: 'in' });
    } else if (/axle/i.test(keyLower)) {
      // General axle spec
      const axleMatch = val.match(/(\d+)\s*(?:axle|[-+])/i);
      if (axleMatch && !axleCount) axleCount = parseInt(axleMatch[1], 10);
      specs.push({ category: 'Axles', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    } else if (/empty\s*weight|tare\s*weight|trailer\s*weight/i.test(keyLower)) {
      const w = parseWeight(val);
      if (w) emptyWeightLbs = w;
      specs.push({ category: 'Weight', key: cleanText(spec.key), value: cleanText(val), unit: 'lbs' });
    } else if (/gvwr|gross\s*vehicle/i.test(keyLower)) {
      const w = parseWeight(val);
      if (w) gvwrLbs = w;
      specs.push({ category: 'Weight', key: cleanText(spec.key), value: cleanText(val), unit: 'lbs' });
    } else if (/weight/i.test(keyLower)) {
      const w = parseWeight(val);
      if (w && !emptyWeightLbs) emptyWeightLbs = w;
      specs.push({ category: 'Weight', key: cleanText(spec.key), value: cleanText(val), unit: 'lbs' });
    } else if (/gooseneck|neck\s*type|detach/i.test(keyLower)) {
      specs.push({ category: 'Gooseneck', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    } else if (/suspension|ride/i.test(keyLower)) {
      specs.push({ category: 'Suspension', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    } else if (/tire|wheel/i.test(keyLower)) {
      specs.push({ category: 'Tires & Wheels', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    } else if (/brake/i.test(keyLower)) {
      specs.push({ category: 'Brakes', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    } else if (/light|electric/i.test(keyLower)) {
      specs.push({ category: 'Electrical', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    } else if (/king\s*pin|fifth\s*wheel/i.test(keyLower)) {
      specs.push({ category: 'Coupling', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    } else {
      specs.push({ category: 'General', key: cleanText(spec.key), value: cleanText(val), unit: '' });
    }
  }

  // Try to extract specs from free text if we didn't get them from structured data
  const allText = rawData.allText || '';

  if (!tonnageMin) {
    const tonMatch = allText.match(/(\d+)\s*ton/i);
    if (tonMatch) {
      const t = parseInt(tonMatch[1], 10);
      if (t >= 20 && t <= 200) {
        tonnageMin = t;
        tonnageMax = t;
      }
    }
  }

  if (!deckHeightInches) {
    const dhMatch = allText.match(/deck\s*height[:\s]*(\d+(?:\.\d+)?)\s*(?:"|in)/i);
    if (dhMatch) deckHeightInches = parseFloat(dhMatch[1]);
  }

  if (!deckLengthFeet) {
    const dlMatch = allText.match(/deck\s*length[:\s]*([\d.']+)/i);
    if (dlMatch) deckLengthFeet = parseLength(dlMatch[1]);
  }

  if (!axleCount) {
    // Try patterns like "3+1" or "3+2" (front+rear axle config)
    const axleCfgMatch = allText.match(/(\d)\s*\+\s*(\d)\s*(?:axle|tridem|tandem)/i);
    if (axleCfgMatch) {
      axleCount = parseInt(axleCfgMatch[1], 10) + parseInt(axleCfgMatch[2], 10);
    } else {
      const axleSimpleMatch = allText.match(/(\d+)\s*[-\s]?axle/i);
      if (axleSimpleMatch) {
        const a = parseInt(axleSimpleMatch[1], 10);
        if (a >= 2 && a <= 13) axleCount = a;
      }
    }
  }

  // Also try to extract tonnage from the URL (common pattern in compare-trailers URLs)
  if (!tonnageMin) {
    const urlTonMatch = productUrl.match(/(\d+)-ton/i);
    if (urlTonMatch) {
      const t = parseInt(urlTonMatch[1], 10);
      if (t >= 20 && t <= 200) {
        tonnageMin = t;
        tonnageMax = t;
      }
    }
  }

  // Extract axle config from URL patterns like "3-1-tridem" or "3-2-tridem"
  if (!axleCount) {
    const urlAxleMatch = productUrl.match(/(\d)-(\d)-(?:tridem|tandem)/i);
    if (urlAxleMatch) {
      axleCount = parseInt(urlAxleMatch[1], 10) + parseInt(urlAxleMatch[2], 10);
    }
  }

  // Extract deck length from URL pattern like "26-deck-length"
  if (!deckLengthFeet) {
    const urlDeckMatch = productUrl.match(/(\d+)-deck-length/i);
    if (urlDeckMatch) {
      const dl = parseInt(urlDeckMatch[1], 10);
      if (dl >= 10 && dl <= 60) deckLengthFeet = dl;
    }
  }

  // Extract deck width from URL pattern like "8-6-deck-width" (8'6")
  const urlDeckWidthMatch = productUrl.match(/([\d]+)-([\d]+)-deck-width/i);
  if (urlDeckWidthMatch) {
    const feet = parseInt(urlDeckWidthMatch[1], 10);
    const inches = parseInt(urlDeckWidthMatch[2], 10);
    const widthStr = `${feet}'${inches}"`;
    // Add as spec if not already present
    if (!specs.find((s) => /deck\s*width/i.test(s.key))) {
      specs.push({ category: 'Dimensions', key: 'Deck Width', value: widthStr, unit: 'ft' });
    }
  }

  // Extract axle spread from URL pattern like "54-5-axle-spread"
  const urlAxleSpreadMatch = productUrl.match(/([\d]+)(?:-([\d]+))?-axle-spread/i);
  if (urlAxleSpreadMatch) {
    const spreadVal = urlAxleSpreadMatch[2]
      ? `${urlAxleSpreadMatch[1]}.${urlAxleSpreadMatch[2]}"`
      : `${urlAxleSpreadMatch[1]}"`;
    if (!specs.find((s) => /axle\s*spread/i.test(s.key))) {
      specs.push({ category: 'Axles', key: 'Axle Spread', value: spreadVal, unit: 'in' });
    }
  }

  // Build description
  let description = cleanText(rawData.description);
  let shortDescription = '';
  if (description) {
    shortDescription =
      description.length > 200 ? description.substring(0, 197) + '...' : description;
  }

  // Build images
  const images = rawData.images
    .filter((img) => {
      // Only keep meaningful images (not tiny or tracking)
      return img.url && img.url.startsWith('http');
    })
    .map((img) => ({
      url: img.url,
      alt_text: img.alt || `${productName} trailer`,
      source_url: productUrl,
    }));

  const product = {
    name: productName,
    series: series || null,
    model_number: modelNumber || null,
    tagline: cleanText(rawData.tagline) || null,
    description: description || null,
    short_description: shortDescription || null,
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
    source_url: productUrl,
  };

  console.log(`    Name: ${product.name}`);
  console.log(`    Series: ${product.series || '(none)'} | Model: ${product.model_number || '(none)'}`);
  console.log(`    Type: ${product.product_type} | Gooseneck: ${product.gooseneck_type}`);
  console.log(`    Tonnage: ${product.tonnage_min || '?'}-${product.tonnage_max || '?'} tons`);
  console.log(`    Specs: ${specs.length} | Images: ${images.length}`);

  return { product, specs, images };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  printBanner(MANUFACTURER_NAME, WEBSITE);

  // ----- Database setup -----
  const supabase = getSupabaseClient();
  const manufacturerId = await resolveManufacturerId(supabase);
  console.log(`  Manufacturer ID: ${manufacturerId}\n`);

  // ----- Browser setup -----
  const browser = await createBrowser('new');
  const page = await createPage(browser);

  const stats = { scraped: 0, upserted: 0, errors: 0 };

  try {
    // ----- Phase 1: Discover all product links -----
    console.log('Phase 1: Discovering product links...');

    const allProductLinks = new Map(); // url -> productLink object (dedup by URL)

    // Scan each product line page
    for (const lineConfig of PRODUCT_LINE_PAGES) {
      try {
        const links = await discoverProductLinks(page, lineConfig);
        for (const link of links) {
          if (!allProductLinks.has(link.url)) {
            allProductLinks.set(link.url, link);
          }
        }
        await sleep(NAV_DELAY);
      } catch (err) {
        console.error(`  [ERROR] Failed discovering from ${lineConfig.url}: ${err.message}`);
        stats.errors++;
      }
    }

    // Also try the build-my-trailer page
    try {
      const buildLinks = await discoverFromBuildPage(page);
      for (const link of buildLinks) {
        if (!allProductLinks.has(link.url)) {
          allProductLinks.set(link.url, link);
        }
      }
    } catch (err) {
      console.error(`  [ERROR] Failed discovering from Build page: ${err.message}`);
      stats.errors++;
    }

    // If we found zero links from navigation, try known product-line detail pages directly
    if (allProductLinks.size === 0) {
      console.log('\n  No product links discovered from navigation. Trying known product pages...');
      const knownPages = [
        { url: `${WEBSITE}/workhorse-55pvr-pro`, series: 'Workhorse', defaultType: 'lowboy', defaultGooseneck: 'hydraulic-detachable' },
        { url: `${WEBSITE}/magnitude`, series: 'Magnitude', defaultType: 'lowboy', defaultGooseneck: 'hydraulic-detachable' },
        { url: `${WEBSITE}/renegade`, series: 'Renegade', defaultType: 'rgn', defaultGooseneck: 'hydraulic-detachable' },
        { url: `${WEBSITE}/workhorse`, series: 'Workhorse', defaultType: 'lowboy', defaultGooseneck: 'hydraulic-detachable' },
        { url: `${WEBSITE}/xcalibur`, series: 'Xcalibur', defaultType: 'extendable', defaultGooseneck: 'fixed' },
      ];
      for (const known of knownPages) {
        allProductLinks.set(known.url, known);
      }
    }

    console.log(`\nTotal unique product links discovered: ${allProductLinks.size}`);

    // ----- Phase 2: Scrape each product page -----
    console.log('\nPhase 2: Scraping individual product pages...');
    console.log('='.repeat(60));

    const productEntries = Array.from(allProductLinks.values());

    for (let i = 0; i < productEntries.length; i++) {
      const entry = productEntries[i];
      console.log(`\n[${i + 1}/${productEntries.length}] ${entry.url}`);

      try {
        const result = await scrapeProductPage(page, entry);
        stats.scraped++;

        if (!result) {
          console.warn('    Skipped (no data extracted).');
          stats.errors++;
          continue;
        }

        const { product, specs, images } = result;

        // Upsert product
        const productId = await upsertProduct(supabase, manufacturerId, product);
        if (!productId) {
          console.error(`    [ERROR] Failed to upsert product: ${product.name}`);
          stats.errors++;
          continue;
        }

        stats.upserted++;
        console.log(`    Upserted product ID: ${productId}`);

        // Upsert images
        if (images.length > 0) {
          await upsertProductImages(supabase, productId, images);
          console.log(`    Saved ${images.length} image(s)`);
        }

        // Upsert specs
        if (specs.length > 0) {
          await upsertProductSpecs(supabase, productId, specs);
          console.log(`    Saved ${specs.length} spec(s)`);
        }
      } catch (err) {
        console.error(`    [ERROR] ${err.message}`);
        stats.errors++;
      }

      // Delay between products
      await sleep(NAV_DELAY);
    }

    // ----- Phase 3: Update product count -----
    console.log('\nPhase 3: Updating product count...');
    const count = await updateProductCount(supabase, manufacturerId);
    console.log(`  Active product count: ${count}`);
  } catch (err) {
    console.error(`\n[FATAL] ${err.message}`);
    stats.errors++;
  } finally {
    await browser.close();
  }

  printSummary(MANUFACTURER_NAME, stats);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch(console.error);
