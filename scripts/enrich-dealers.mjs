/**
 * Dealer Data Enrichment Script
 *
 * Options:
 *   --delete    Delete orphaned profiles (no listings, no company name)
 *   --enrich    Try to find business info using phone numbers
 *   --dry-run   Show what would happen without making changes
 *
 * Usage:
 *   node scripts/enrich-dealers.mjs --dry-run
 *   node scripts/enrich-dealers.mjs --delete
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const shouldDelete = args.includes('--delete');
const shouldEnrich = args.includes('--enrich');

async function getOrphanedProfiles() {
  // Get placeholder profiles with no company name
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, created_at')
    .like('email', '%@dealers.axlon.ai')
    .is('company_name', null);

  if (!profiles || profiles.length === 0) {
    return [];
  }

  // Check which ones have listings
  const orphaned = [];
  for (const profile of profiles) {
    const { count } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id);

    if (!count || count === 0) {
      // Extract phone from email
      const phone = profile.email.split('@')[0];
      orphaned.push({
        id: profile.id,
        email: profile.email,
        phone,
        formattedPhone: phone.length === 10
          ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
          : phone,
        created_at: profile.created_at,
      });
    }
  }

  return orphaned;
}

async function deleteProfiles(profiles) {
  console.log(`\nDeleting ${profiles.length} orphaned profiles...`);

  let deleted = 0;
  let errors = 0;

  for (const profile of profiles) {
    if (dryRun) {
      console.log(`  Would delete: ${profile.formattedPhone}`);
      deleted++;
      continue;
    }

    try {
      // Delete auth user (cascades to profile)
      const { error } = await supabase.auth.admin.deleteUser(profile.id);
      if (error) {
        console.log(`  Error deleting ${profile.formattedPhone}: ${error.message}`);
        errors++;
      } else {
        deleted++;
        process.stdout.write(`\r  Deleted: ${deleted}/${profiles.length}`);
      }
    } catch (e) {
      console.log(`  Exception deleting ${profile.formattedPhone}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n\nResults:`);
  console.log(`  Deleted: ${deleted}`);
  console.log(`  Errors: ${errors}`);
}

async function main() {
  console.log('🔍 Dealer Data Analysis\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Action: ${shouldDelete ? 'DELETE' : shouldEnrich ? 'ENRICH' : 'ANALYZE ONLY'}\n`);

  const orphaned = await getOrphanedProfiles();

  console.log(`Found ${orphaned.length} orphaned profiles (no listings, no company name)\n`);

  if (orphaned.length === 0) {
    console.log('✅ No orphaned profiles to clean up!');
    return;
  }

  // Show sample
  console.log('Sample phone numbers from orphaned profiles:');
  orphaned.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.formattedPhone}`);
  });
  if (orphaned.length > 10) {
    console.log(`  ... and ${orphaned.length - 10} more`);
  }

  // Export phone numbers for manual lookup
  if (!shouldDelete && !shouldEnrich) {
    const phones = orphaned.map(p => p.formattedPhone).join('\n');
    const filename = `orphaned-phones-${new Date().toISOString().split('T')[0]}.txt`;
    await import('fs').then(fs => fs.writeFileSync(filename, phones));
    console.log(`\n📄 Phone numbers exported to: ${filename}`);
    console.log('\nTo delete these profiles, run:');
    console.log('  node scripts/enrich-dealers.mjs --delete --dry-run');
    console.log('  node scripts/enrich-dealers.mjs --delete');
    return;
  }

  if (shouldDelete) {
    await deleteProfiles(orphaned);
  }

  if (shouldEnrich) {
    console.log('\n⚠️  Enrichment not implemented yet.');
    console.log('To enrich, you would need to:');
    console.log('  1. Use a phone lookup API (Twilio, NumVerify, etc.)');
    console.log('  2. Search Google for business by phone number');
    console.log('  3. Scrape business directories');
  }
}

main().catch(console.error);
