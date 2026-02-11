// @ts-nocheck
/**
 * Master runner for all manufacturer product catalog scrapers.
 *
 * Runs all 13 manufacturer scrapers sequentially with error isolation —
 * if one manufacturer fails, the rest still run.
 *
 * Usage:
 *   node scripts/scrape-all-manufacturers.mjs                     # Run all
 *   node scripts/scrape-all-manufacturers.mjs --manufacturer=pitts # Run one
 *   node scripts/scrape-all-manufacturers.mjs --list               # List available
 *
 * Each scraper is a standalone .mjs file that handles its own browser
 * lifecycle and Supabase upserts via the shared utility library.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Manufacturer registry — order matches the plan document
// ---------------------------------------------------------------------------

const MANUFACTURERS = [
  { slug: 'trail-king',      script: 'scrape-mfr-trailking.mjs' },
  { slug: 'fontaine',        script: 'scrape-mfr-fontaine.mjs' },
  { slug: 'talbert',         script: 'scrape-mfr-talbert.mjs' },
  { slug: 'xl-specialized',  script: 'scrape-mfr-xl-specialized.mjs' },
  { slug: 'pitts',           script: 'scrape-mfr-pitts.mjs' },
  { slug: 'eager-beaver',    script: 'scrape-mfr-eager-beaver.mjs' },
  { slug: 'kaufman',         script: 'scrape-mfr-kaufman.mjs' },
  { slug: 'witzco',          script: 'scrape-mfr-witzco.mjs' },
  { slug: 'globe',           script: 'scrape-mfr-globe.mjs' },
  { slug: 'etnyre',          script: 'scrape-mfr-etnyre.mjs' },
  { slug: 'landoll',         script: 'scrape-mfr-landoll.mjs' },
  { slug: 'faymonville',     script: 'scrape-mfr-faymonville.mjs' },
  { slug: 'loadstar',        script: 'scrape-mfr-loadstar.mjs' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = execFile('node', [scriptPath], {
      cwd: __dirname,
      env: process.env,
      timeout: 10 * 60 * 1000, // 10 minute timeout per manufacturer
    }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (error) reject(error);
      else resolve();
    });
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};

  for (const arg of args) {
    if (arg === '--list') {
      flags.list = true;
    } else if (arg.startsWith('--manufacturer=')) {
      flags.manufacturer = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    }
  }

  return flags;
}

function printHelp() {
  console.log(`
Usage: node scripts/scrape-all-manufacturers.mjs [options]

Options:
  --manufacturer=SLUG   Run only the scraper for the given manufacturer slug
  --list                List all available manufacturer scrapers
  --help, -h            Show this help message

Available manufacturer slugs:
${MANUFACTURERS.map((m) => `  ${m.slug}`).join('\n')}
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const flags = parseArgs();

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  if (flags.list) {
    console.log('\nAvailable manufacturer scrapers:\n');
    for (const mfr of MANUFACTURERS) {
      const scriptPath = resolve(__dirname, mfr.script);
      const exists = existsSync(scriptPath);
      const status = exists ? '✓' : '✗ (missing)';
      console.log(`  ${status}  ${mfr.slug.padEnd(18)} → ${mfr.script}`);
    }
    console.log('');
    process.exit(0);
  }

  // Filter to a single manufacturer if requested
  let targets = MANUFACTURERS;
  if (flags.manufacturer) {
    const match = MANUFACTURERS.find((m) => m.slug === flags.manufacturer);
    if (!match) {
      console.error(`\n❌ Unknown manufacturer slug: "${flags.manufacturer}"`);
      console.error(`   Run with --list to see available options.\n`);
      process.exit(1);
    }
    targets = [match];
  }

  const startTime = Date.now();
  const results = [];

  console.log('\n' + '═'.repeat(60));
  console.log('🏭 Manufacturer Product Catalog Scraper — Master Runner');
  console.log(`   Targets: ${targets.length} manufacturer(s)`);
  console.log('═'.repeat(60) + '\n');

  for (const mfr of targets) {
    const scriptPath = resolve(__dirname, mfr.script);

    if (!existsSync(scriptPath)) {
      console.log(`⚠️  Skipping ${mfr.slug} — script not found: ${mfr.script}`);
      results.push({ slug: mfr.slug, status: 'skipped', reason: 'script not found' });
      continue;
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`▶ Starting: ${mfr.slug} (${mfr.script})`);
    console.log('─'.repeat(60));

    const mfrStart = Date.now();

    try {
      await runScript(scriptPath);
      const elapsed = ((Date.now() - mfrStart) / 1000).toFixed(1);
      console.log(`✅ Completed: ${mfr.slug} (${elapsed}s)`);
      results.push({ slug: mfr.slug, status: 'success', elapsed });
    } catch (error) {
      const elapsed = ((Date.now() - mfrStart) / 1000).toFixed(1);
      console.error(`❌ Failed: ${mfr.slug} (${elapsed}s) — ${error.message}`);
      results.push({ slug: mfr.slug, status: 'failed', elapsed, error: error.message });
    }
  }

  // Print summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const succeeded = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Master Runner Summary');
  console.log('═'.repeat(60));
  console.log(`   Total time:  ${totalElapsed}s`);
  console.log(`   Succeeded:   ${succeeded}`);
  console.log(`   Failed:      ${failed}`);
  console.log(`   Skipped:     ${skipped}`);

  if (failed > 0) {
    console.log('\n   Failed manufacturers:');
    for (const r of results.filter((r) => r.status === 'failed')) {
      console.log(`     ❌ ${r.slug}: ${r.error}`);
    }
  }

  if (skipped > 0) {
    console.log('\n   Skipped manufacturers:');
    for (const r of results.filter((r) => r.status === 'skipped')) {
      console.log(`     ⚠️  ${r.slug}: ${r.reason}`);
    }
  }

  console.log('═'.repeat(60) + '\n');

  // Exit with error code if any failed
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error in master runner:', error);
  process.exit(1);
});
