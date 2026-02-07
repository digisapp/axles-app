/**
 * Cleanup Broken Images
 *
 * Finds and optionally deletes listing_images rows whose URLs are broken
 * (hotlink-protected, expired, unreachable, or match known bad patterns).
 *
 * Usage:
 *   node scripts/cleanup-broken-images.mjs           # dry-run (default)
 *   node scripts/cleanup-broken-images.mjs --delete   # actually delete rows
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DELETE_MODE = process.argv.includes('--delete');
const BATCH_SIZE = 20;
const TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Bad URL patterns (reused from cleanup-listing-images.mjs)
// ---------------------------------------------------------------------------
const BAD_URL_PATTERNS = [
  /logo/i,
  /icon/i,
  /placeholder/i,
  /no-image/i,
  /default/i,
  /woocommerce-placeholder/i,
  /avatar/i,
  /favicon/i,
  /badge/i,
  /sprite/i,
  /button/i,
  /widget/i,
];

// Known image magic bytes (first few bytes of common formats)
const IMAGE_SIGNATURES = [
  { bytes: [0xff, 0xd8, 0xff], type: 'jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], type: 'png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], type: 'gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], type: 'webp' }, // RIFF header (WebP)
  { bytes: [0x42, 0x4d], type: 'bmp' },
];

function hasImageMagicBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  return IMAGE_SIGNATURES.some((sig) =>
    sig.bytes.every((b, i) => bytes[i] === b)
  );
}

// ---------------------------------------------------------------------------
// Deep image check: GET with body inspection
// ---------------------------------------------------------------------------
async function checkImageUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Use GET with browser-like headers to catch hotlink protection
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { status: response.status, ok: false };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // If server explicitly says it's HTML, it's a redirect/block page
    if (contentType.includes('text/html') || contentType.includes('text/plain')) {
      return {
        status: response.status,
        ok: false,
        error: `Non-image content-type: ${contentType}`,
      };
    }

    // Read first 16 bytes to verify actual image data
    const reader = response.body.getReader();
    const { value } = await reader.read();
    reader.cancel(); // stop downloading the rest

    if (!value || value.length === 0) {
      return { status: response.status, ok: false, error: 'Empty body' };
    }

    // Tiny responses (< 100 bytes) are almost certainly not real images
    if (value.length < 100) {
      // Check if it looks like HTML (common for 1x1 tracking pixels or block pages)
      const text = new TextDecoder().decode(value.slice(0, 100));
      if (text.includes('<') || text.includes('html') || text.includes('HTTP')) {
        return { status: response.status, ok: false, error: 'HTML in body (likely block page)' };
      }
    }

    // Check magic bytes — if content-type claims image but bytes don't match, flag it
    if (!contentType.includes('image/') && !hasImageMagicBytes(value.buffer)) {
      return {
        status: response.status,
        ok: false,
        error: `No image signature in body (ct: ${contentType || 'none'})`,
      };
    }

    // Even if content-type says image, verify magic bytes to catch disguised HTML
    if (contentType.includes('image/') && !hasImageMagicBytes(value.buffer)) {
      // Some servers lie about content-type; check if body is actually HTML
      const text = new TextDecoder().decode(value.slice(0, 200));
      if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<HTML')) {
        return {
          status: response.status,
          ok: false,
          error: 'Body is HTML despite image content-type',
        };
      }
    }

    return {
      status: response.status,
      ok: true,
      contentType,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid-url';
  }
}

function isObviouslyBadUrl(url) {
  if (!url || url.length < 20) return true;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return true;
  return BAD_URL_PATTERNS.some((p) => p.test(url));
}

/** Run fn on items in concurrent batches of `size`. */
async function batchProcess(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + size < items.length) {
      process.stdout.write(
        `  Checked ${Math.min(i + size, items.length)}/${items.length}\r`
      );
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('==========================================================');
  console.log('  Broken Image Cleanup');
  console.log(`  Mode: ${DELETE_MODE ? 'DELETE' : 'DRY RUN (pass --delete to remove)'}`);
  console.log('==========================================================\n');

  // 1. Fetch all listing_images with parent listing info
  console.log('Fetching listing images...');
  const { data: images, error } = await supabase
    .from('listing_images')
    .select(`
      id,
      url,
      listing_id,
      listings!inner(id, title, status)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching images:', error.message);
    process.exit(1);
  }

  console.log(`Found ${images.length} listing image records\n`);

  // 2. Fast pre-filter: flag images matching known bad URL patterns
  const patternBroken = [];
  const toCheck = [];

  for (const img of images) {
    if (isObviouslyBadUrl(img.url)) {
      patternBroken.push({ ...img, reason: 'bad URL pattern / invalid' });
    } else {
      toCheck.push(img);
    }
  }

  console.log(`Pre-filter: ${patternBroken.length} images flagged by URL pattern`);
  console.log(`Remaining:  ${toCheck.length} images to HTTP-check\n`);

  // 3. Concurrent HEAD checks with URL caching
  console.log(`Running HEAD checks (batch=${BATCH_SIZE}, timeout=${TIMEOUT_MS}ms)...`);
  const urlCache = new Map();
  const httpBroken = [];

  await batchProcess(toCheck, BATCH_SIZE, async (img) => {
    const url = img.url;

    // Use cached result for duplicate URLs
    let result;
    if (urlCache.has(url)) {
      result = urlCache.get(url);
    } else {
      result = await checkImageUrl(url);
      urlCache.set(url, result);
    }

    if (!result.ok) {
      httpBroken.push({
        ...img,
        reason: result.error
          ? `Network error: ${result.error}`
          : `HTTP ${result.status}`,
      });
    }
  });

  console.log(`\nHTTP check: ${httpBroken.length} broken images found\n`);

  // Combine all broken images
  const allBroken = [...patternBroken, ...httpBroken];

  if (allBroken.length === 0) {
    console.log('No broken images found. Nothing to do.');
    return;
  }

  // 4. Build report
  // Domain breakdown
  const domainCounts = {};
  for (const img of allBroken) {
    const domain = extractDomain(img.url);
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }

  // Listings that will lose ALL images
  const imageCountByListing = {};
  for (const img of images) {
    imageCountByListing[img.listing_id] =
      (imageCountByListing[img.listing_id] || 0) + 1;
  }
  const brokenCountByListing = {};
  for (const img of allBroken) {
    brokenCountByListing[img.listing_id] =
      (brokenCountByListing[img.listing_id] || 0) + 1;
  }

  const listingsLosingAll = [];
  for (const [listingId, brokenCount] of Object.entries(brokenCountByListing)) {
    if (brokenCount >= imageCountByListing[listingId]) {
      const sample = allBroken.find((b) => b.listing_id === listingId);
      listingsLosingAll.push({
        listingId,
        title: sample?.listings?.title || 'Unknown',
        status: sample?.listings?.status || 'unknown',
        imageCount: imageCountByListing[listingId],
      });
    }
  }

  // Print broken images (capped at 30)
  console.log('--- Broken Images (first 30) ---');
  for (const img of allBroken.slice(0, 30)) {
    const title = img.listings?.title?.slice(0, 45) || 'Unknown';
    console.log(
      `  [${img.reason}] ${title} | ${img.url?.slice(0, 80)}`
    );
  }
  if (allBroken.length > 30) {
    console.log(`  ... and ${allBroken.length - 30} more\n`);
  }

  // Listings losing all images
  if (listingsLosingAll.length > 0) {
    console.log(`\n--- Listings that will lose ALL images (${listingsLosingAll.length}) ---`);
    for (const l of listingsLosingAll.slice(0, 20)) {
      console.log(`  ${l.title.slice(0, 55)} (${l.imageCount} images, status: ${l.status})`);
    }
    if (listingsLosingAll.length > 20) {
      console.log(`  ... and ${listingsLosingAll.length - 20} more`);
    }
  }

  // Domain breakdown
  const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  console.log('\n--- Broken by Domain ---');
  for (const [domain, count] of sortedDomains.slice(0, 15)) {
    console.log(`  ${domain}: ${count}`);
  }
  if (sortedDomains.length > 15) {
    console.log(`  ... and ${sortedDomains.length - 15} more domains`);
  }

  // Summary
  console.log('\n==========================================================');
  console.log('  Summary');
  console.log('==========================================================');
  console.log(`  Total images checked:      ${images.length}`);
  console.log(`  Broken (pattern match):    ${patternBroken.length}`);
  console.log(`  Broken (HTTP check):       ${httpBroken.length}`);
  console.log(`  Total broken:              ${allBroken.length}`);
  console.log(`  Unique URLs cached:        ${urlCache.size}`);
  console.log(`  Listings losing all imgs:  ${listingsLosingAll.length}`);
  console.log('==========================================================\n');

  // 5. Delete if --delete flag is set
  if (!DELETE_MODE) {
    console.log('Dry run complete. Re-run with --delete to remove broken image records.');
    return;
  }

  console.log(`Deleting ${allBroken.length} broken image records...`);
  const brokenIds = allBroken.map((img) => img.id);

  // Delete in batches to avoid hitting Supabase limits
  let deleted = 0;
  for (let i = 0; i < brokenIds.length; i += 100) {
    const batch = brokenIds.slice(i, i + 100);
    const { error: delError } = await supabase
      .from('listing_images')
      .delete()
      .in('id', batch);

    if (delError) {
      console.error(`  Error deleting batch at offset ${i}: ${delError.message}`);
    } else {
      deleted += batch.length;
      console.log(`  Deleted ${deleted}/${brokenIds.length}`);
    }
  }

  console.log(`\nDone. Removed ${deleted} broken image records.`);
  if (listingsLosingAll.length > 0) {
    console.log(
      `${listingsLosingAll.length} listings now have zero images and will show the "No Image" fallback.`
    );
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
