// @ts-nocheck
/**
 * Cleanup Listing Images
 * - Remove logo images from listings
 * - Remove placeholder/default images
 * - Ensure primary image is a full vehicle shot (not close-up or logo)
 * - Uses XAI (Grok) Vision API with base64 images
 */

import { createClient } from '@supabase/supabase-js';
import { createXai } from '@ai-sdk/xai';
import { generateObject } from 'ai';
import { z } from 'zod';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getXai() {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }
  return createXai({
    apiKey: process.env.XAI_API_KEY,
  });
}

// URL patterns that indicate logos/placeholders
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fetch image and convert to base64
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Check image size (skip tiny images that are likely icons)
    if (buffer.byteLength < 5000) {
      return { skip: true, reason: 'tiny image' };
    }

    return {
      base64: `data:${contentType};base64,${base64}`,
      size: buffer.byteLength,
    };
  } catch (err) {
    return { skip: true, reason: err.message };
  }
}

const imageAnalysisSchema = z.object({
  type: z.enum(['logo', 'closeup', 'partial', 'full_vehicle', 'other']).describe('Type of image'),
  is_logo: z.boolean().describe('Is this a company logo or brand image'),
  is_closeup: z.boolean().describe('Is this an extreme close-up of a small part'),
  is_full_vehicle: z.boolean().describe('Shows most or all of a truck/trailer from outside'),
  is_good_primary: z.boolean().describe('Suitable as main listing display image'),
  confidence: z.number().min(0).max(1).describe('Confidence score'),
  description: z.string().describe('Brief description of the image'),
});

// Analyze image with XAI Vision using base64
async function analyzeImage(base64Data) {
  try {
    const xai = getXai();

    const { object } = await generateObject({
      model: xai('grok-2-vision-1212'),
      schema: imageAnalysisSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image for a truck/trailer marketplace.

Classify the image:
- "logo": Company logo, brand image, dealer logo, manufacturer emblem, or icon - DELETE these
- "closeup": Extreme close-up of a small part (tire, hitch, VIN plate, gauge, serial number, etc) - NOT suitable as primary
- "partial": Shows part of vehicle but not a complete view
- "full_vehicle": Shows the whole truck/trailer or at least 50% from outside - BEST for primary image
- "other": Not a vehicle image (people, documents, scenery, buildings, etc) - DELETE these

"is_good_primary" = TRUE only for clear full vehicle exterior shots that would look good as the main listing thumbnail.
"is_closeup" = TRUE for extreme zooms on small parts - BAD for primary images.
"is_logo" = TRUE for any company logos, brand images, or icons - should be DELETED.`,
            },
            {
              type: 'image',
              image: base64Data,
            },
          ],
        },
      ],
    });

    return object;
  } catch (err) {
    console.error(`    AI error: ${err.message?.substring(0, 50)}`);
    return null;
  }
}

// Quick URL-based check for obvious bad images
function isObviouslyBadUrl(url) {
  for (const pattern of BAD_URL_PATTERNS) {
    if (pattern.test(url)) {
      return true;
    }
  }
  return false;
}

async function main() {
  console.log('Listing Image Cleanup Tool');
  console.log('==================================================\n');

  // Get all listings with their images
  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      listing_images (
        id,
        url,
        is_primary,
        sort_order
      )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching listings:', error.message);
    return;
  }

  // Filter to listings with images
  const listingsWithImages = listings.filter(l => l.listing_images?.length > 0);
  console.log(`Found ${listingsWithImages.length} listings with images\n`);

  let totalDeleted = 0;
  let totalUpdatedPrimary = 0;
  let listingsProcessed = 0;

  for (const listing of listingsWithImages) {
    const images = listing.listing_images || [];

    listingsProcessed++;
    const shortTitle = listing.title?.substring(0, 50) || 'Unknown';
    console.log(`\n[${listingsProcessed}/${listingsWithImages.length}] ${shortTitle}`);
    console.log(`    ${images.length} images`);

    const imagesToDelete = [];
    const imageAnalysis = [];

    // Analyze each image
    for (const img of images) {
      // Quick URL check first
      if (isObviouslyBadUrl(img.url)) {
        console.log(`    DELETE (bad URL): ${img.url.substring(0, 50)}...`);
        imagesToDelete.push(img.id);
        continue;
      }

      // Skip very short URLs (usually broken)
      if (img.url.length < 20) {
        console.log(`    DELETE (invalid URL): ${img.url}`);
        imagesToDelete.push(img.id);
        continue;
      }

      // Fetch image as base64
      const imageData = await fetchImageAsBase64(img.url);

      if (imageData.skip) {
        if (imageData.reason === 'tiny image') {
          console.log(`    DELETE (tiny): ${img.url.substring(0, 50)}...`);
          imagesToDelete.push(img.id);
        } else {
          console.log(`    SKIP (fetch failed): ${imageData.reason}`);
          // Keep the image but don't analyze it
          imageAnalysis.push({ ...img, analysis: null });
        }
        continue;
      }

      // Use AI for detailed analysis
      await sleep(200); // Rate limit
      const analysis = await analyzeImage(imageData.base64);

      if (analysis) {
        imageAnalysis.push({ ...img, analysis });

        if (analysis.is_logo || analysis.type === 'logo') {
          console.log(`    DELETE (logo): ${analysis.description?.substring(0, 50)}`);
          imagesToDelete.push(img.id);
        } else if (analysis.type === 'other' && analysis.confidence > 0.6) {
          console.log(`    DELETE (not vehicle): ${analysis.description?.substring(0, 50)}`);
          imagesToDelete.push(img.id);
        } else {
          const status = analysis.is_good_primary ? '✓ GOOD' : (analysis.is_closeup ? '~ closeup' : '~ partial');
          console.log(`    ${status}: ${analysis.description?.substring(0, 50) || 'vehicle image'}`);
        }
      } else {
        // If AI fails, keep the image
        imageAnalysis.push({ ...img, analysis: null });
        console.log(`    ? (AI failed): kept`);
      }
    }

    // Delete bad images
    if (imagesToDelete.length > 0) {
      const { error: delError } = await supabase
        .from('listing_images')
        .delete()
        .in('id', imagesToDelete);

      if (delError) {
        console.log(`    Error deleting: ${delError.message}`);
      } else {
        totalDeleted += imagesToDelete.length;
        console.log(`    Deleted ${imagesToDelete.length} images`);
      }
    }

    // Find best primary image from remaining
    const remainingImages = imageAnalysis.filter(img => !imagesToDelete.includes(img.id));

    if (remainingImages.length > 0) {
      // Sort by: is_good_primary first, then full_vehicle, then partial, then closeup
      remainingImages.sort((a, b) => {
        const scoreA = (a.analysis?.is_good_primary ? 100 : 0) +
                       (a.analysis?.is_full_vehicle ? 50 : 0) +
                       (a.analysis?.is_closeup ? -30 : 0) +
                       (a.analysis?.confidence || 0) * 10;
        const scoreB = (b.analysis?.is_good_primary ? 100 : 0) +
                       (b.analysis?.is_full_vehicle ? 50 : 0) +
                       (b.analysis?.is_closeup ? -30 : 0) +
                       (b.analysis?.confidence || 0) * 10;
        return scoreB - scoreA;
      });

      const bestImage = remainingImages[0];
      const currentPrimary = images.find(img => img.is_primary);

      // Update primary if best image is different and is actually good
      if (bestImage && bestImage.analysis?.is_good_primary &&
          (!currentPrimary || currentPrimary.id !== bestImage.id)) {
        // Unset current primary
        if (currentPrimary && !imagesToDelete.includes(currentPrimary.id)) {
          await supabase
            .from('listing_images')
            .update({ is_primary: false })
            .eq('id', currentPrimary.id);
        }

        // Set new primary
        const { error: updateError } = await supabase
          .from('listing_images')
          .update({ is_primary: true, sort_order: 0 })
          .eq('id', bestImage.id);

        if (!updateError) {
          totalUpdatedPrimary++;
          console.log(`    ★ New primary: ${bestImage.analysis?.description?.substring(0, 40) || 'best image'}`);
        }
      }

      // Update sort order for remaining images (non-closeups first)
      const sortedRemaining = remainingImages.filter(img => img.id !== bestImage?.id);
      for (let i = 0; i < sortedRemaining.length; i++) {
        const img = sortedRemaining[i];
        await supabase
          .from('listing_images')
          .update({ sort_order: i + 1 })
          .eq('id', img.id);
      }
    }
  }

  console.log('\n==================================================');
  console.log('Summary:');
  console.log(`   Listings processed: ${listingsProcessed}`);
  console.log(`   Images deleted: ${totalDeleted}`);
  console.log(`   Primary images updated: ${totalUpdatedPrimary}`);
  console.log('==================================================\n');
}

main().catch(console.error);
