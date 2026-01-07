// @ts-nocheck
/**
 * Analyze all listings for quality issues:
 * - Spelling/formatting in titles
 * - Missing categories
 * - Missing images
 * - Duplicate titles
 * - Invalid years
 * - Title case issues
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Analyzing All Listings...\n');
  console.log('='.repeat(60));

  // Get all listings with category info
  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id, title, year, make, condition, price, city, state, user_id,
      category:categories(id, name, slug),
      images:listing_images(id)
    `)
    .eq('status', 'active');

  // Get dealer names separately
  const dealerIds = [...new Set(listings?.map(l => l.user_id) || [])];
  const { data: dealers } = await supabase
    .from('profiles')
    .select('id, company_name')
    .in('id', dealerIds);

  const dealerMap = {};
  for (const d of dealers || []) {
    dealerMap[d.id] = d.company_name;
  }

  if (error) {
    console.error('Error fetching listings:', error.message);
    return;
  }

  console.log(`\nTotal listings: ${listings.length}\n`);

  const issues = {
    noCategory: [],
    noImages: [],
    duplicateTitles: [],
    invalidYear: [],
    titleIssues: [],
    allCaps: [],
    trailingJunk: [],
    missingMake: [],
    lowPrice: [],
  };

  const titleCounts = {};
  const categoryStats = {};

  for (const listing of listings) {
    const title = listing.title || '';
    const dealer = dealerMap[listing.user_id] || 'Unknown';

    // Track category stats
    const catName = listing.category?.name || 'NO CATEGORY';
    categoryStats[catName] = (categoryStats[catName] || 0) + 1;

    // Check for missing category
    if (!listing.category) {
      issues.noCategory.push({ id: listing.id, title, dealer });
    }

    // Check for missing images
    if (!listing.images || listing.images.length === 0) {
      issues.noImages.push({ id: listing.id, title, dealer });
    }

    // Track duplicate titles
    titleCounts[title] = (titleCounts[title] || 0) + 1;

    // Check for invalid year
    if (listing.year && (listing.year < 1980 || listing.year > 2027)) {
      issues.invalidYear.push({ id: listing.id, title, year: listing.year, dealer });
    }

    // Check for ALL CAPS titles (more than 50% uppercase)
    const upperCount = (title.match(/[A-Z]/g) || []).length;
    const letterCount = (title.match(/[A-Za-z]/g) || []).length;
    if (letterCount > 0 && upperCount / letterCount > 0.7) {
      issues.allCaps.push({ id: listing.id, title, dealer });
    }

    // Check for trailing junk like "FOR SALE" or stock numbers in title
    if (/FOR SALE|#\d+$|\s+FOR\s*$|TRAILER FOR SALE/i.test(title)) {
      issues.trailingJunk.push({ id: listing.id, title, dealer });
    }

    // Check for missing make
    if (!listing.make || listing.make.trim() === '') {
      issues.missingMake.push({ id: listing.id, title, dealer });
    }

    // Check for suspiciously low prices
    if (listing.price && listing.price < 1000) {
      issues.lowPrice.push({ id: listing.id, title, price: listing.price, dealer });
    }

    // Check for common title issues
    if (/\s{2,}/.test(title)) {
      issues.titleIssues.push({ id: listing.id, title, issue: 'Double spaces', dealer });
    }
    if (/^\s|\s$/.test(title)) {
      issues.titleIssues.push({ id: listing.id, title, issue: 'Leading/trailing spaces', dealer });
    }
  }

  // Find actual duplicates (same title more than once)
  for (const [title, count] of Object.entries(titleCounts)) {
    if (count > 1) {
      issues.duplicateTitles.push({ title, count });
    }
  }

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('CATEGORY DISTRIBUTION');
  console.log('='.repeat(60));
  const sortedCats = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const pct = ((count / listings.length) * 100).toFixed(1);
    console.log(`  ${cat}: ${count} (${pct}%)`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('ISSUES FOUND');
  console.log('='.repeat(60));

  // No Category
  console.log(`\n[NO CATEGORY] ${issues.noCategory.length} listings`);
  if (issues.noCategory.length > 0) {
    for (const item of issues.noCategory.slice(0, 20)) {
      console.log(`  - ${item.title.substring(0, 50)}... (${item.dealer})`);
    }
    if (issues.noCategory.length > 20) {
      console.log(`  ... and ${issues.noCategory.length - 20} more`);
    }
  }

  // No Images
  console.log(`\n[NO IMAGES] ${issues.noImages.length} listings`);
  if (issues.noImages.length > 0) {
    for (const item of issues.noImages.slice(0, 10)) {
      console.log(`  - ${item.title.substring(0, 50)}... (${item.dealer})`);
    }
  }

  // Duplicate Titles
  console.log(`\n[DUPLICATE TITLES] ${issues.duplicateTitles.length} unique titles with duplicates`);
  if (issues.duplicateTitles.length > 0) {
    for (const item of issues.duplicateTitles.slice(0, 15)) {
      console.log(`  - "${item.title.substring(0, 45)}..." (${item.count}x)`);
    }
    if (issues.duplicateTitles.length > 15) {
      console.log(`  ... and ${issues.duplicateTitles.length - 15} more`);
    }
  }

  // All Caps Titles
  console.log(`\n[ALL CAPS TITLES] ${issues.allCaps.length} listings`);
  if (issues.allCaps.length > 0) {
    for (const item of issues.allCaps.slice(0, 15)) {
      console.log(`  - ${item.title.substring(0, 50)}... (${item.dealer})`);
    }
    if (issues.allCaps.length > 15) {
      console.log(`  ... and ${issues.allCaps.length - 15} more`);
    }
  }

  // Trailing Junk
  console.log(`\n[TRAILING JUNK - "FOR SALE" etc] ${issues.trailingJunk.length} listings`);
  if (issues.trailingJunk.length > 0) {
    for (const item of issues.trailingJunk.slice(0, 15)) {
      console.log(`  - ${item.title.substring(0, 55)}... (${item.dealer})`);
    }
    if (issues.trailingJunk.length > 15) {
      console.log(`  ... and ${issues.trailingJunk.length - 15} more`);
    }
  }

  // Missing Make
  console.log(`\n[MISSING MAKE] ${issues.missingMake.length} listings`);
  if (issues.missingMake.length > 0) {
    for (const item of issues.missingMake.slice(0, 10)) {
      console.log(`  - ${item.title.substring(0, 50)}... (${item.dealer})`);
    }
    if (issues.missingMake.length > 10) {
      console.log(`  ... and ${issues.missingMake.length - 10} more`);
    }
  }

  // Invalid Years
  console.log(`\n[INVALID YEAR] ${issues.invalidYear.length} listings`);
  if (issues.invalidYear.length > 0) {
    for (const item of issues.invalidYear) {
      console.log(`  - Year ${item.year}: ${item.title.substring(0, 40)}... (${item.dealer})`);
    }
  }

  // Title formatting issues
  console.log(`\n[TITLE FORMATTING] ${issues.titleIssues.length} issues`);
  if (issues.titleIssues.length > 0) {
    for (const item of issues.titleIssues.slice(0, 10)) {
      console.log(`  - ${item.issue}: "${item.title.substring(0, 40)}..."`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  const totalIssues = issues.noCategory.length + issues.allCaps.length +
                      issues.trailingJunk.length + issues.duplicateTitles.length;
  console.log(`Total listings: ${listings.length}`);
  console.log(`Listings needing attention: ~${totalIssues}`);
  console.log(`  - No category: ${issues.noCategory.length}`);
  console.log(`  - All caps titles: ${issues.allCaps.length}`);
  console.log(`  - "FOR SALE" in title: ${issues.trailingJunk.length}`);
  console.log(`  - Duplicate titles: ${issues.duplicateTitles.length}`);
  console.log(`  - Missing make: ${issues.missingMake.length}`);
}

main().catch(console.error);
