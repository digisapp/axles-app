#!/usr/bin/env node
/**
 * PIN Migration Script
 *
 * Migrates all plaintext voice_pin values to secure hashed pin_hash values
 * in the dealer_staff table.
 *
 * Usage: node scripts/migrate-pins-to-hashed.mjs
 *
 * This script:
 * 1. Fetches all staff with plaintext PINs (voice_pin set, pin_hash not set)
 * 2. Hashes each PIN using SHA-256 with the staff ID as salt
 * 3. Updates the pin_hash field
 * 4. Optionally clears the plaintext voice_pin field
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Hash a PIN using SHA-256 with salt (matches the verify endpoint)
 */
function hashPin(pin, salt) {
  const data = `${salt}:${pin}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function migratePins() {
  console.log('Starting PIN migration...\n');

  // Fetch all staff with plaintext PINs that haven't been migrated
  const { data: staffWithPlaintextPins, error: fetchError } = await supabase
    .from('dealer_staff')
    .select('id, name, voice_pin, pin_hash')
    .not('voice_pin', 'is', null)
    .is('pin_hash', null);

  if (fetchError) {
    console.error('Error fetching staff:', fetchError);
    process.exit(1);
  }

  if (!staffWithPlaintextPins || staffWithPlaintextPins.length === 0) {
    console.log('No staff members with plaintext PINs found. Migration complete!');
    return;
  }

  console.log(`Found ${staffWithPlaintextPins.length} staff member(s) with plaintext PINs to migrate.\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const staff of staffWithPlaintextPins) {
    try {
      // Hash the PIN using staff ID as salt
      const hashedPin = hashPin(staff.voice_pin, staff.id);

      // Update the record with the hashed PIN
      const { error: updateError } = await supabase
        .from('dealer_staff')
        .update({
          pin_hash: hashedPin,
          // Keep voice_pin for now as backup - can be cleared in a separate migration
          // voice_pin: null, // Uncomment to clear plaintext PIN
        })
        .eq('id', staff.id);

      if (updateError) {
        console.error(`  Error migrating ${staff.name} (${staff.id}):`, updateError.message);
        errorCount++;
      } else {
        console.log(`  Migrated: ${staff.name} (${staff.id})`);
        successCount++;
      }
    } catch (err) {
      console.error(`  Error processing ${staff.name} (${staff.id}):`, err.message);
      errorCount++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total: ${staffWithPlaintextPins.length}`);

  if (errorCount === 0) {
    console.log('\nMigration completed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Test PIN verification with affected staff members');
    console.log('  2. Once verified, run the cleanup script to remove plaintext PINs');
  } else {
    console.log('\nMigration completed with errors. Please review and retry failed records.');
  }
}

// Run migration
migratePins().catch(console.error);
