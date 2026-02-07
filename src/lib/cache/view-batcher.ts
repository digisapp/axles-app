import { createClient } from '@supabase/supabase-js';
import {
  getRedis,
  CACHE_KEYS,
  CACHE_TTL,
  cacheIncr,
  cacheKeys,
  isRedisConfigured,
} from './redis';
import { logger } from '@/lib/logger';

const BATCH_KEY_PREFIX = CACHE_KEYS.VIEW_BATCH;
const FLUSH_THRESHOLD = 10; // Flush after this many views per listing
const FLUSH_INTERVAL = CACHE_TTL.VIEW_BATCH_FLUSH * 1000; // Flush interval in ms

/**
 * Record a view in the batch (Redis)
 * Returns the current batch count
 */
export async function recordViewBatch(listingId: string): Promise<number> {
  if (!isRedisConfigured()) {
    return 0;
  }

  const key = `${BATCH_KEY_PREFIX}${listingId}`;
  const count = await cacheIncr(key, CACHE_TTL.VIEW_BATCH_FLUSH * 2);

  // Auto-flush if threshold reached
  if (count >= FLUSH_THRESHOLD) {
    // Fire and forget - don't wait for flush
    flushViewBatch(listingId).catch((err) => logger.error('Error auto-flushing view batch', { error: err }));
  }

  return count;
}

/**
 * Flush a single listing's view batch to the database
 */
export async function flushViewBatch(listingId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  const key = `${BATCH_KEY_PREFIX}${listingId}`;

  try {
    // Get and delete atomically using GETDEL
    const count = await redis.getdel(key);
    const viewCount = typeof count === 'number' ? count : parseInt(count as string) || 0;

    if (viewCount > 0) {
      // Update database with batched count
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabase.rpc('increment_views_by', {
        listing_id: listingId,
        count: viewCount,
      });

      logger.debug('Flushed views for listing', { viewCount, listingId });
    }

    return viewCount;
  } catch (error) {
    logger.error('Error flushing views for listing', { listingId, error });
    return 0;
  }
}

/**
 * Flush all pending view batches to the database
 * Call this periodically (e.g., via cron or serverless function)
 */
export async function flushAllViewBatches(): Promise<{
  flushed: number;
  totalViews: number;
}> {
  const redis = getRedis();
  if (!redis) return { flushed: 0, totalViews: 0 };

  try {
    const keys = await cacheKeys(`${BATCH_KEY_PREFIX}*`);

    if (keys.length === 0) {
      return { flushed: 0, totalViews: 0 };
    }

    let totalViews = 0;

    // Process in batches to avoid overwhelming the database
    for (const key of keys) {
      const listingId = key.replace(BATCH_KEY_PREFIX, '');
      const views = await flushViewBatch(listingId);
      totalViews += views;
    }

    logger.info('Flushed all view batches', { totalViews, listingCount: keys.length });

    return {
      flushed: keys.length,
      totalViews,
    };
  } catch (error) {
    logger.error('Error flushing all view batches', { error });
    return { flushed: 0, totalViews: 0 };
  }
}

/**
 * Get the current batched view count for a listing (not yet flushed)
 */
export async function getBatchedViewCount(listingId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    const key = `${BATCH_KEY_PREFIX}${listingId}`;
    const count = await redis.get(key);
    return typeof count === 'number' ? count : parseInt(count as string) || 0;
  } catch (error) {
    logger.error('Error getting batched view count', { error });
    return 0;
  }
}

// Export flush interval for external scheduling
export { FLUSH_INTERVAL, FLUSH_THRESHOLD };
