// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get categories structure
  const { data: cats } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .order('parent_id', { nullsFirst: true })
    .order('name');

  console.log('=== CATEGORIES ===');
  const parents = cats?.filter(c => c.parent_id === null) || [];
  for (const p of parents) {
    console.log(`\n${p.name} (${p.slug})`);
    const children = cats?.filter(c => c.parent_id === p.id) || [];
    for (const c of children) {
      console.log(`  - ${c.name} (${c.slug})`);
    }
  }

  // Check total listings by category
  console.log('\n\n=== LISTINGS BY CATEGORY ===');
  const { data: listings } = await supabase
    .from('listings')
    .select('category_id, title')
    .eq('status', 'active');

  const catCounts = {};
  for (const l of listings || []) {
    const cat = cats?.find(c => c.id === l.category_id);
    const catName = cat?.name || 'NO CATEGORY';
    catCounts[catName] = (catCounts[catName] || 0) + 1;
  }

  for (const [name, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`${name}: ${count}`);
  }

  // Check for 'trailer' text search
  console.log('\n\n=== SEARCH TEST: "trailer" ===');
  const { data: trailerSearch, error } = await supabase
    .from('listings')
    .select('title, category_id')
    .textSearch('search_vector', 'trailer', { type: 'websearch', config: 'english' })
    .eq('status', 'active')
    .limit(15);

  if (error) {
    console.log('Search error:', error.message);
  } else {
    for (const l of trailerSearch || []) {
      const cat = cats?.find(c => c.id === l.category_id);
      console.log(`${cat?.name || 'NO CAT'}: ${l.title?.substring(0, 60)}`);
    }
  }

  // Check search_vector column exists
  console.log('\n\n=== CHECKING SEARCH VECTOR ===');
  const { data: sample } = await supabase
    .from('listings')
    .select('id, title, search_vector')
    .limit(1);

  if (sample?.[0]?.search_vector) {
    console.log('search_vector exists:', typeof sample[0].search_vector);
  } else {
    console.log('search_vector is NULL or missing - this is the problem!');
  }
}

check().catch(console.error);
