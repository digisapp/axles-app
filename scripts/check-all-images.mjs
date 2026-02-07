import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllImages() {
  console.log('Fetching ALL listing images...\n');

  // Get total count
  const { count: totalCount } = await supabase
    .from('listing_images')
    .select('*', { count: 'exact', head: true });

  console.log(`Total images in database: ${totalCount}\n`);

  // Get all unique domains
  const { data: allImages } = await supabase
    .from('listing_images')
    .select('url')
    .limit(10000);

  const domainCounts = {};
  const protocolIssues = [];
  const badPatterns = [];

  // Known bad patterns from scraping
  const BAD_PATTERNS = [
    'placeholder', 'no-image', 'noimage', 'default',
    'icon', 'logo', 'flag', 'badge', 'banner',
    '.svg', '.gif', 'spacer', 'pixel', '1x1'
  ];

  for (const img of allImages || []) {
    const url = img.url;
    if (!url) continue;

    // Check protocol
    if (url.startsWith('http://')) {
      protocolIssues.push(url);
    }

    // Check for bad patterns
    const lowerUrl = url.toLowerCase();
    for (const pattern of BAD_PATTERNS) {
      if (lowerUrl.includes(pattern)) {
        badPatterns.push({ url, pattern });
        break;
      }
    }

    // Count domains
    try {
      const domain = new URL(url).hostname;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    } catch (e) {
      console.log('Invalid URL:', url.slice(0, 100));
    }
  }

  console.log('=== DOMAIN DISTRIBUTION ===');
  const sortedDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1]);

  for (const [domain, count] of sortedDomains.slice(0, 20)) {
    console.log(`${domain}: ${count} images`);
  }

  console.log('\n=== HTTP (not HTTPS) URLS ===');
  console.log(`Found ${protocolIssues.length} HTTP URLs`);
  if (protocolIssues.length > 0) {
    console.log('Examples:');
    protocolIssues.slice(0, 5).forEach(url => console.log(`  ${url.slice(0, 100)}`));
  }

  console.log('\n=== BAD PATTERN MATCHES ===');
  console.log(`Found ${badPatterns.length} images with bad patterns`);
  if (badPatterns.length > 0) {
    console.log('Examples:');
    badPatterns.slice(0, 10).forEach(({ url, pattern }) =>
      console.log(`  [${pattern}] ${url.slice(0, 80)}...`)
    );
  }

  // Check for external domains that might have issues
  const externalDomains = sortedDomains.filter(([domain]) =>
    !domain.includes('supabase') &&
    !domain.includes('axlon.ai')
  );

  console.log('\n=== EXTERNAL IMAGE SOURCES ===');
  console.log('Images hosted externally (not on Supabase):');
  for (const [domain, count] of externalDomains.slice(0, 15)) {
    console.log(`  ${domain}: ${count}`);
  }

  // Sample test some external images
  console.log('\n=== TESTING EXTERNAL IMAGES ===');
  const externalUrls = (allImages || [])
    .filter(img => img.url && !img.url.includes('supabase'))
    .slice(0, 50);

  let brokenCount = 0;
  const brokenUrls = [];

  for (const img of externalUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(img.url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        brokenCount++;
        brokenUrls.push({ url: img.url, status: response.status });
      }
    } catch (e) {
      brokenCount++;
      brokenUrls.push({ url: img.url, error: e.message });
    }
  }

  console.log(`Tested ${externalUrls.length} external images`);
  console.log(`Broken: ${brokenCount}`);

  if (brokenUrls.length > 0) {
    console.log('\nBroken external images:');
    brokenUrls.slice(0, 20).forEach(({ url, status, error }) =>
      console.log(`  [${status || error}] ${url.slice(0, 80)}...`)
    );
  }

  // Check Supabase storage images
  console.log('\n=== TESTING SUPABASE IMAGES ===');
  const supabaseUrls = (allImages || [])
    .filter(img => img.url && img.url.includes('supabase'))
    .slice(0, 50);

  let supabaseBroken = 0;
  const supabaseBrokenUrls = [];

  for (const img of supabaseUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(img.url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        supabaseBroken++;
        supabaseBrokenUrls.push({ url: img.url, status: response.status });
      }
    } catch (e) {
      supabaseBroken++;
      supabaseBrokenUrls.push({ url: img.url, error: e.message });
    }
  }

  console.log(`Tested ${supabaseUrls.length} Supabase images`);
  console.log(`Broken: ${supabaseBroken}`);

  if (supabaseBrokenUrls.length > 0) {
    console.log('\nBroken Supabase images:');
    supabaseBrokenUrls.forEach(({ url, status, error }) =>
      console.log(`  [${status || error}] ${url.slice(0, 100)}...`)
    );
  }
}

checkAllImages();
