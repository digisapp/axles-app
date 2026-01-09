import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkImageUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageChecker/1.0)'
      }
    });

    clearTimeout(timeout);

    return {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type')
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

async function findBrokenImages() {
  console.log('Fetching all listing images...\n');

  // Get all images with their listing info
  const { data: images, error } = await supabase
    .from('listing_images')
    .select(`
      id,
      url,
      thumbnail_url,
      listing_id,
      listings!inner(id, title, status)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching images:', error);
    return;
  }

  console.log(`Found ${images.length} images to check\n`);

  const brokenImages = [];
  const urlIssues = [];
  const checkedUrls = new Map(); // Cache results for duplicate URLs

  // First pass: Check URL format issues
  for (const image of images) {
    const url = image.url;

    // Check for common URL format issues
    if (!url) {
      urlIssues.push({ ...image, issue: 'Empty URL' });
      continue;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      urlIssues.push({ ...image, issue: 'Missing protocol' });
      continue;
    }
    if (url.startsWith('http://') && !url.includes('localhost')) {
      urlIssues.push({ ...image, issue: 'HTTP instead of HTTPS (may be blocked)' });
    }
  }

  console.log('=== URL FORMAT ISSUES ===');
  console.log(`Found ${urlIssues.length} images with URL format issues:\n`);
  for (const img of urlIssues.slice(0, 20)) {
    console.log(`- [${img.issue}] Listing: ${img.listings?.title?.slice(0, 40)}...`);
    console.log(`  URL: ${img.url?.slice(0, 80)}...`);
    console.log(`  Image ID: ${img.id}\n`);
  }
  if (urlIssues.length > 20) {
    console.log(`... and ${urlIssues.length - 20} more\n`);
  }

  // Second pass: Check accessibility (sample of images)
  console.log('\n=== CHECKING IMAGE ACCESSIBILITY ===');
  console.log('Testing a sample of images (this may take a minute)...\n');

  // Group by domain to identify patterns
  const domainStats = {};

  // Sample check - test up to 100 images
  const samplesToCheck = images
    .filter(img => img.url && img.url.startsWith('http'))
    .slice(0, 100);

  let checked = 0;
  for (const image of samplesToCheck) {
    const url = image.url;

    // Skip if already checked this URL
    if (checkedUrls.has(url)) {
      const cached = checkedUrls.get(url);
      if (!cached.ok) {
        brokenImages.push({ ...image, result: cached });
      }
      continue;
    }

    // Extract domain
    try {
      const domain = new URL(url).hostname;
      domainStats[domain] = domainStats[domain] || { total: 0, broken: 0 };
      domainStats[domain].total++;
    } catch (e) {
      // Invalid URL
    }

    const result = await checkImageUrl(url);
    checkedUrls.set(url, result);

    if (!result.ok) {
      brokenImages.push({ ...image, result });
      try {
        const domain = new URL(url).hostname;
        domainStats[domain].broken++;
      } catch (e) {}
    }

    checked++;
    if (checked % 20 === 0) {
      console.log(`Checked ${checked}/${samplesToCheck.length}...`);
    }
  }

  console.log('\n=== BROKEN IMAGES ===');
  console.log(`Found ${brokenImages.length} broken images:\n`);

  for (const img of brokenImages.slice(0, 30)) {
    console.log(`- Listing: ${img.listings?.title?.slice(0, 50)}...`);
    console.log(`  URL: ${img.url?.slice(0, 100)}...`);
    console.log(`  Status: ${img.result.status} | Error: ${img.result.error || 'N/A'}`);
    console.log(`  Image ID: ${img.id}`);
    console.log(`  Listing ID: ${img.listing_id}\n`);
  }

  if (brokenImages.length > 30) {
    console.log(`... and ${brokenImages.length - 30} more broken images\n`);
  }

  console.log('\n=== DOMAIN STATISTICS ===');
  const sortedDomains = Object.entries(domainStats)
    .sort((a, b) => b[1].broken - a[1].broken);

  for (const [domain, stats] of sortedDomains.slice(0, 15)) {
    const brokenPct = ((stats.broken / stats.total) * 100).toFixed(1);
    console.log(`${domain}: ${stats.broken}/${stats.total} broken (${brokenPct}%)`);
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total images: ${images.length}`);
  console.log(`URL format issues: ${urlIssues.length}`);
  console.log(`Broken (from sample): ${brokenImages.length}`);
  console.log(`Sample size checked: ${samplesToCheck.length}`);

  // Return data for potential fixes
  return {
    urlIssues,
    brokenImages,
    domainStats
  };
}

// Run
findBrokenImages().then(result => {
  if (result) {
    console.log('\n=== RECOMMENDATIONS ===');

    // Find domains with high failure rates
    const problematicDomains = Object.entries(result.domainStats)
      .filter(([_, stats]) => stats.broken > 0 && (stats.broken / stats.total) > 0.5)
      .map(([domain]) => domain);

    if (problematicDomains.length > 0) {
      console.log('\nProblematic domains (>50% broken):');
      problematicDomains.forEach(d => console.log(`  - ${d}`));
      console.log('\nConsider: Re-scraping listings from these sources or removing them.');
    }

    if (result.urlIssues.length > 0) {
      console.log('\nTo fix URL format issues, run:');
      console.log('  node scripts/fix-image-urls.mjs');
    }

    if (result.brokenImages.length > 0) {
      console.log('\nTo remove broken images, run:');
      console.log('  node scripts/remove-broken-images.mjs');
    }
  }
});
