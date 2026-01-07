// @ts-nocheck
/**
 * Clean up listing issues:
 * 1. Fix ALL CAPS titles -> Title Case
 * 2. Remove "FOR SALE" from titles
 * 3. Fix double spaces
 * 4. Assign missing categories
 * 5. Extract missing makes from titles
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Known makes for extraction
const KNOWN_MAKES = [
  'Volvo', 'Mack', 'Freightliner', 'Kenworth', 'Peterbilt', 'International',
  'Western Star', 'Hino', 'Isuzu', 'Wabash', 'Great Dane', 'Utility', 'Vanguard',
  'Hyundai', 'Stoughton', 'Fontaine', 'Trail King', 'Kentucky', 'Wilson',
  'Reitnouer', 'East', 'Manac', 'MAC', 'Talbert', 'Felling', 'Landoll', 'XL Specialized',
  'Dorsey', 'Eager Beaver', 'Liddell', 'SmithCo', 'Ranco', 'Choice', 'Dragon',
  'Cottrell', 'Sun Country', 'BWS', 'Benson', 'Transcraft', 'Travis', 'Rogers',
  'Trailmobile', 'Strick', 'Doonan', 'Etnyre', 'Heil', 'Polar', 'Brenner', 'Beall',
  'Innovative', 'Goldhofer', 'Pitts', 'Load King', 'Armor Lite', 'Prestige',
  'Alpha', 'Midland', 'Valew', 'CPS', 'Extreme', 'Valor', 'Gallegos', 'Deloupe'
];

// Category mapping for auto-assignment
const CATEGORY_KEYWORDS = {
  'car-hauler-trailers': ['car carrier', 'car hauler', 'auto transport', '5-car', '3-car', '4-car', '6-car', '7-car', '8-car', 'cottrell', 'sun country', 'take 3', 'infinity', 'wedge'],
  'lowboy-trailers': ['lowboy', 'low boy', 'double drop', 'detachable', 'traveling axle', 'rgn', 'hrgn'],
  'drop-deck-trailers': ['drop deck', 'dropdeck'],
  'step-deck-trailers': ['step deck', 'stepdeck'],
  'flatbed-trailers': ['flatbed', 'flat bed', 'aluminum flatbed', 'combo flat'],
  'dump-trailers': ['end dump', 'dump trailer', 'half round', 'tippermax', 'frameless dump'],
  'bottom-dump-trailers': ['bottom dump', 'belly dump'],
  'side-dump-trailers': ['side dump'],
  'live-floor-trailers': ['live floor', 'walking floor', 'moving floor', 'mvp ss', 'movingfloor'],
  'tank-trailers': ['tank', 'tanker', 'pneumatic', 'vac trailer', 'vacuum', 'dry bulk', 'fertilizer'],
  'reefer-trailers': ['reefer', 'refrigerated', 'econex'],
  'dry-van-trailers': ['dry van', 'van trailer', 'plate van', 'duraplate'],
  'tag-trailers': ['tag trailer', 'tag-along', 'tilt trailer', 'tilt/no ramp'],
  'log-trailers': ['log trailer', 'logging'],
  'chip-trailers': ['chip trailer', 'chipper'],
  'container-chassis': ['container chassis', 'chassis', 'cont. 40'],
  'specialty-trailers': ['support trailer', 'utility trailer', 'specialty'],
};

function toTitleCase(str) {
  // Words that should stay lowercase (except at start)
  const lowerWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in', 'with'];

  // Words/patterns that should stay uppercase
  const upperWords = ['VNL', 'VHD', 'NPR', 'NRR', 'NQR', 'MD', 'HD', 'LT', 'MV', 'MT', 'USA', 'II', 'III', 'IV', 'XL', 'LP', 'GVWR', 'BBL'];
  const stateAbbrevs = ['CA', 'TX', 'NY', 'VT', 'NH', 'PA', 'OR', 'UT', 'NV', 'AZ', 'TN', 'OH', 'IA', 'MO', 'MI', 'WA', 'CO', 'MT', 'ID'];

  // Split by spaces but preserve special characters
  return str
    .split(' ')
    .map((word, index) => {
      const wordUpper = word.toUpperCase();
      const wordLower = word.toLowerCase();

      // Keep dimensions like 48′, 102″, 13'6″
      if (/^\d+['′″"]+$/.test(word) || /^\d+'?\d*″?$/.test(word)) {
        return word;
      }

      // Keep model numbers with mixed letters/numbers (like 930E-51, VNL64T760)
      if (/[A-Z]+\d+|^\d+[A-Z]+/i.test(word) && word.length > 2) {
        return wordUpper;
      }

      // Check for known uppercase words
      if (upperWords.includes(wordUpper) || stateAbbrevs.includes(wordUpper)) {
        return wordUpper;
      }

      // Handle hyphenated words like "2027-INNOVATIVE"
      if (word.includes('-')) {
        return word.split('-').map((part, i) => {
          if (/^\d+$/.test(part)) return part;
          if (/[A-Z]+\d+|\d+[A-Z]+/i.test(part)) return part.toUpperCase();
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }).join('-');
      }

      // Keep lowercase words lowercase (except first word)
      if (index !== 0 && lowerWords.includes(wordLower)) {
        return wordLower;
      }

      // Standard title case: capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function cleanTitle(title) {
  let cleaned = title;

  // Remove "FOR SALE" variations (case insensitive)
  cleaned = cleaned.replace(/\s+for\s+sale\.?\s*$/i, '');
  cleaned = cleaned.replace(/\s+for\s+sale\s+/i, ' ');
  cleaned = cleaned.replace(/^For Sale:\s*/i, '');
  cleaned = cleaned.replace(/\s+–\s*for\s+sale$/i, '');
  cleaned = cleaned.replace(/\s+trailer\s+for\s+sale$/i, ' Trailer');
  cleaned = cleaned.replace(/\s+truck\s+for\s+sale$/i, ' Truck');

  // Remove trailing stock numbers like "#10506" or "... #10506"
  cleaned = cleaned.replace(/\s*#\d+\.?\.?\.?$/, '');
  cleaned = cleaned.replace(/\.\.\.$/, '');

  // Fix double spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // Trim
  cleaned = cleaned.trim();

  // Convert ALL CAPS to Title Case (if more than 70% uppercase)
  const upperCount = (cleaned.match(/[A-Z]/g) || []).length;
  const letterCount = (cleaned.match(/[A-Za-z]/g) || []).length;
  if (letterCount > 0 && upperCount / letterCount > 0.7) {
    cleaned = toTitleCase(cleaned);
  }

  return cleaned;
}

function extractMake(title) {
  const titleUpper = title.toUpperCase();
  for (const make of KNOWN_MAKES) {
    if (titleUpper.includes(make.toUpperCase())) {
      return make;
    }
  }
  return null;
}

async function getCategoryId(slug) {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .single();
  return data?.id;
}

async function findCategory(title) {
  const titleLower = title.toLowerCase();
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        return await getCategoryId(slug);
      }
    }
  }
  return null;
}

async function main() {
  console.log('Cleaning Up Listings...\n');
  console.log('='.repeat(60));

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, make, category_id')
    .eq('status', 'active');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Total listings: ${listings.length}\n`);

  let titlesCleaned = 0;
  let makesFixed = 0;
  let categoriesFixed = 0;

  for (const listing of listings) {
    const updates = {};
    const originalTitle = listing.title;

    // Clean title
    const cleanedTitle = cleanTitle(originalTitle);
    if (cleanedTitle !== originalTitle) {
      updates.title = cleanedTitle;
      titlesCleaned++;
    }

    // Fix missing make
    if (!listing.make || listing.make.trim() === '') {
      const extractedMake = extractMake(cleanedTitle || originalTitle);
      if (extractedMake) {
        updates.make = extractedMake;
        makesFixed++;
      }
    }

    // Fix missing category
    if (!listing.category_id) {
      const categoryId = await findCategory(cleanedTitle || originalTitle);
      if (categoryId) {
        updates.category_id = categoryId;
        categoriesFixed++;
      }
    }

    // Apply updates
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', listing.id);

      if (updateError) {
        console.log(`Error updating ${listing.id}: ${updateError.message}`);
      } else if (updates.title) {
        console.log(`Fixed: "${originalTitle.substring(0, 50)}..."`);
        console.log(`   -> "${updates.title.substring(0, 50)}..."`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`Titles cleaned: ${titlesCleaned}`);
  console.log(`Makes extracted: ${makesFixed}`);
  console.log(`Categories assigned: ${categoriesFixed}`);
}

main().catch(console.error);
