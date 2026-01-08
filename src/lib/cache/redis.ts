import { Redis } from '@upstash/redis';

// Lazy initialization - only create client when needed
let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  // Check if Redis is configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Redis not configured - caching disabled');
    return null;
  }

  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return redisClient;
}

// Cache key prefixes for organization
export const CACHE_KEYS = {
  SEARCH: 'search:',
  LISTING: 'listing:',
  PRICE_ESTIMATE: 'price:',
  VIEW_BATCH: 'views:batch:',
  VIEW_COUNT: 'views:count:',
  CATEGORIES: 'categories',
  DEALS: 'deals:',
} as const;

// TTL values in seconds
export const CACHE_TTL = {
  SEARCH_RESULTS: 60 * 5, // 5 minutes
  LISTING_DETAIL: 60 * 2, // 2 minutes
  PRICE_ESTIMATE: 60 * 60 * 24, // 24 hours
  VIEW_BATCH_FLUSH: 60, // 1 minute
  CATEGORIES: 60 * 60, // 1 hour
  DEALS: 60 * 5, // 5 minutes
} as const;

/**
 * Generic cache get with JSON parsing
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const data = await redis.get(key);
    return data as T | null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Generic cache set with JSON stringification
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

/**
 * Delete a cache key
 */
export async function cacheDelete(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Cache delete pattern error:', error);
    return false;
  }
}

/**
 * Increment a counter (for view batching)
 */
export async function cacheIncr(key: string, ttlSeconds?: number): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    const count = await redis.incr(key);
    if (ttlSeconds && count === 1) {
      // Set TTL only on first increment
      await redis.expire(key, ttlSeconds);
    }
    return count;
  } catch (error) {
    console.error('Cache incr error:', error);
    return 0;
  }
}

/**
 * Get all keys matching a pattern
 */
export async function cacheKeys(pattern: string): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    return await redis.keys(pattern);
  } catch (error) {
    console.error('Cache keys error:', error);
    return [];
  }
}

/**
 * Get multiple values at once
 */
export async function cacheMget<T>(...keys: string[]): Promise<(T | null)[]> {
  const redis = getRedis();
  if (!redis) return keys.map(() => null);

  try {
    const values = await redis.mget<(T | null)[]>(...keys);
    return values;
  } catch (error) {
    console.error('Cache mget error:', error);
    return keys.map(() => null);
  }
}

/**
 * Generate a hash for search query caching
 */
export function generateSearchCacheKey(params: Record<string, string | undefined>): string {
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < sortedParams.length; i++) {
    const char = sortedParams.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `${CACHE_KEYS.SEARCH}${Math.abs(hash).toString(36)}`;
}

/**
 * Generate cache key for price estimation
 */
export function generatePriceCacheKey(listing: {
  make?: string;
  model?: string;
  year?: number;
  condition?: string;
  mileage?: number;
  category_id?: string;
}): string {
  const key = [
    listing.make?.toLowerCase(),
    listing.model?.toLowerCase(),
    listing.year,
    listing.condition,
    listing.mileage ? Math.round(listing.mileage / 10000) * 10000 : 0, // Round to nearest 10k
    listing.category_id,
  ].filter(Boolean).join(':');

  return `${CACHE_KEYS.PRICE_ESTIMATE}${key}`;
}

/**
 * Check if Redis is available
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export { getRedis };
