// @ts-nocheck
/**
 * Fix listing categories based on title keywords
 * TruckPaper scraper was putting trucks in trailer categories
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Map keywords in title to correct category slugs
const CATEGORY_KEYWORDS = {
  // Trucks - check these first (more specific)
  'sleeper trucks': 'sleeper-trucks',
  'sleeper truck': 'sleeper-trucks',
  'day cab trucks': 'day-cab-trucks',
  'day cab truck': 'day-cab-trucks',
  'daycab': 'day-cab-trucks',
  'dump trucks': 'dump-trucks',
  'dump truck': 'dump-trucks',
  'box trucks': 'box-trucks',
  'box truck': 'box-trucks',
  'tow trucks': 'wrecker-trucks',
  'tow truck': 'wrecker-trucks',
  'wrecker trucks': 'wrecker-trucks',
  'wrecker truck': 'wrecker-trucks',
  'cab & chassis trucks': 'cab-chassis',
  'cab chassis trucks': 'cab-chassis',
  'cab & chassis': 'cab-chassis',
  'service trucks': 'service-trucks',
  'service truck': 'service-trucks',
  'utility trucks': 'service-trucks',
  'utility truck': 'service-trucks',
  'flatbed trucks': 'flatbed-trucks',
  'flatbed truck': 'flatbed-trucks',
  'tanker trucks': 'fuel-trucks',
  'tanker truck': 'fuel-trucks',
  'fuel trucks': 'fuel-trucks',
  'fuel truck': 'fuel-trucks',
  'garbage trucks': 'vacuum-trucks',
  'garbage truck': 'vacuum-trucks',
  'refuse trucks': 'vacuum-trucks',
  'concrete trucks': 'medium-duty-trucks',
  'concrete truck': 'medium-duty-trucks',
  'mixer trucks': 'medium-duty-trucks',
  'bucket trucks': 'bucket-trucks',
  'bucket truck': 'bucket-trucks',
  'yard spotter trucks': 'yard-spotter-trucks',
  'yard spotter': 'yard-spotter-trucks',
  'spotter truck': 'yard-spotter-trucks',
  'terminal tractor': 'terminal-tractors',
  'yard tractor': 'yard-tractors',
  'winch trucks': 'winch-trucks',
  'winch truck': 'winch-trucks',
  'hot shot': 'hot-shot-trucks',
  'rollback': 'rollback-trucks',
  'boom truck': 'boom-trucks',
  'boom trucks': 'boom-trucks',
  'rv hauler': 'rv-hauler-trucks',
  'toter': 'rv-hauler-trucks',
  'water truck': 'water-trucks',
  'vacuum truck': 'vacuum-trucks',

  // Trailers
  'lowboy trailers': 'lowboy-trailers',
  'lowboy trailer': 'lowboy-trailers',
  'lowboy': 'lowboy-trailers',
  'drop deck trailers': 'step-deck-trailers',
  'drop deck trailer': 'step-deck-trailers',
  'step deck': 'step-deck-trailers',
  'double drop': 'double-drop-trailers',
  'reefer trailers': 'reefer-trailers',
  'reefer trailer': 'reefer-trailers',
  'refrigerated': 'reefer-trailers',
  'dry van trailers': 'dry-van-trailers',
  'dry van trailer': 'dry-van-trailers',
  'dry van': 'dry-van-trailers',
  'flatbed trailers': 'flatbed-trailers',
  'flatbed trailer': 'flatbed-trailers',
  'dump trailers': 'dump-trailers',
  'dump trailer': 'dump-trailers',
  'end dump': 'end-dump-trailers',
  'side dump': 'side-dump-trailers',
  'bottom dump': 'bottom-dump-trailers',
  'tank trailers': 'tank-trailers',
  'tank trailer': 'tank-trailers',
  'tanker trailer': 'tank-trailers',
  'hopper trailers': 'grain-trailers',
  'hopper trailer': 'grain-trailers',
  'grain trailer': 'grain-trailers',
  'livestock trailers': 'specialty-trailers',
  'livestock trailer': 'specialty-trailers',
  'car hauler': 'specialty-trailers',
  'auto carrier': 'specialty-trailers',
  'curtain side': 'curtain-side-trailers',
  'curtainside': 'curtain-side-trailers',
  'live floor': 'live-floor-trailers',
  'walking floor': 'live-floor-trailers',
  'log trailers': 'log-trailers',
  'log trailer': 'log-trailers',
  'belt trailer': 'belt-trailers',
  'chip trailer': 'chip-trailers',
  'tag trailer': 'tag-trailers',
  'traveling axle': 'traveling-axle-trailers',
  'container chassis': 'container-chassis',
  'chassis trailer': 'container-chassis',
  'storage trailer': 'storage-trailers',
  'oilfield trailer': 'oilfield-trailers',
  'oil field trailer': 'oilfield-trailers',
  'utility trailer': 'landscape-trailers',
  'enclosed trailer': 'cargo-trailers',
  'cargo trailer': 'cargo-trailers',
  'horse trailer': 'horse-trailers',
  'tilt trailer': 'tilt-trailers',
  'landscape trailer': 'landscape-trailers',
  'gooseneck': 'gooseneck-trailers',
  'pneumatic': 'pneumatic-trailers',
};

async function fixCategories() {
  console.log('🔧 Fixing listing categories...\n');

  // Get all categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id');

  const catBySlug = {};
  for (const c of categories || []) {
    catBySlug[c.slug] = c;
  }

  // Get all active listings
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, category_id')
    .eq('status', 'active');

  console.log(`Found ${listings?.length} active listings\n`);

  let fixed = 0;
  let unchanged = 0;

  for (const listing of listings || []) {
    const titleLower = listing.title?.toLowerCase() || '';
    const currentCat = categories?.find(c => c.id === listing.category_id);

    let newCatSlug = null;

    // Check keywords (longer/more specific first)
    const sortedKeywords = Object.keys(CATEGORY_KEYWORDS).sort((a, b) => b.length - a.length);

    for (const keyword of sortedKeywords) {
      if (titleLower.includes(keyword)) {
        newCatSlug = CATEGORY_KEYWORDS[keyword];
        break;
      }
    }

    // If no keyword match, try to infer from title structure
    if (!newCatSlug) {
      // Check if title ends with a category type
      if (titleLower.includes('truck') && !titleLower.includes('trailer')) {
        // It's some kind of truck - check make to help categorize
        if (titleLower.includes('peterbilt') || titleLower.includes('kenworth') ||
            titleLower.includes('freightliner') || titleLower.includes('international') ||
            titleLower.includes('mack') || titleLower.includes('volvo')) {
          // Heavy duty truck make - likely sleeper or day cab
          newCatSlug = 'heavy-duty-trucks';
        }
      }
    }

    if (newCatSlug && catBySlug[newCatSlug]) {
      const newCat = catBySlug[newCatSlug];

      // Only update if category is different
      if (listing.category_id !== newCat.id) {
        const { error } = await supabase
          .from('listings')
          .update({ category_id: newCat.id })
          .eq('id', listing.id);

        if (!error) {
          console.log(`✓ ${listing.title?.substring(0, 50)}`);
          console.log(`  ${currentCat?.name} → ${newCat.name}\n`);
          fixed++;
        }
      } else {
        unchanged++;
      }
    } else {
      unchanged++;
    }
  }

  console.log('\n==================================================');
  console.log(`📊 Summary:`);
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Unchanged: ${unchanged}`);
  console.log('==================================================\n');
}

fixCategories().catch(console.error);
