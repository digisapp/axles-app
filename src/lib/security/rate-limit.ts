import { getRedis } from '@/lib/cache/redis';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional key prefix for different rate limit buckets */
  prefix?: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

// In-memory fallback rate limiter when Redis is unavailable
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkMemoryRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const { limit, windowSeconds, prefix = 'ratelimit' } = config;
  const key = `${prefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);

  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds });
    return { success: true, remaining: limit - 1, reset: now + windowSeconds, limit };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  return {
    success: entry.count <= limit,
    remaining,
    reset: entry.resetAt,
    limit,
  };
}

// Periodically clean up expired entries (every 60s)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt <= now) memoryStore.delete(key);
    }
  }, 60_000);
}

/**
 * Get a unique identifier for rate limiting
 * Uses IP address, falling back to a hash of headers
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0]?.trim() || 'unknown';

  return ip;
}

/**
 * Check rate limit using sliding window algorithm
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedis();
  const { limit, windowSeconds, prefix = 'ratelimit' } = config;

  // If Redis is not configured, use in-memory fallback
  if (!redis) {
    return checkMemoryRateLimit(identifier, config);
  }

  const key = `${prefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  try {
    // Use a sorted set with timestamps as scores
    const pipeline = redis.pipeline();

    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current entries in window
    pipeline.zcard(key);

    // Add current request
    pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` });

    // Set expiry on the key
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();

    // Get count from second command (index 1)
    const currentCount = (results[1] as number) || 0;

    const remaining = Math.max(0, limit - currentCount - 1);
    const success = currentCount < limit;

    return {
      success,
      remaining,
      reset: now + windowSeconds,
      limit,
    };
  } catch (error) {
    logger.error('Rate limit check error', { error });
    // Fall back to in-memory rate limiting on Redis errors
    return checkMemoryRateLimit(identifier, config);
  }
}

/**
 * Create a rate-limited response with proper headers
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests. Please try again later.',
      retryAfter: result.reset - Math.floor(Date.now() / 1000),
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
        'Retry-After': (result.reset - Math.floor(Date.now() / 1000)).toString(),
      },
    }
  );
}

/**
 * Common rate limit configurations
 */
export const RATE_LIMITS = {
  // Standard API endpoints
  standard: { limit: 100, windowSeconds: 60 },

  // AI/expensive operations
  ai: { limit: 20, windowSeconds: 60 },

  // Authentication/sensitive operations
  auth: { limit: 10, windowSeconds: 60 },

  // Search operations
  search: { limit: 60, windowSeconds: 60 },

  // Lead submission
  leads: { limit: 10, windowSeconds: 60 },

  // PIN verification (strict to prevent brute force)
  pinVerify: { limit: 5, windowSeconds: 300 }, // 5 attempts per 5 minutes
} as const;

/**
 * Middleware helper to apply rate limiting to a route
 */
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const identifier = getClientIdentifier(request);
  const result = await checkRateLimit(identifier, config);

  if (!result.success) {
    return rateLimitResponse(result);
  }

  const response = await handler();

  // Add rate limit headers to successful responses
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());

  return response;
}
