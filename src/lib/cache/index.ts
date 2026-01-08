// Main cache utilities
export {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheIncr,
  cacheKeys,
  cacheMget,
  generateSearchCacheKey,
  generatePriceCacheKey,
  isRedisConfigured,
  CACHE_KEYS,
  CACHE_TTL,
} from './redis';

// View batching
export {
  recordViewBatch,
  flushViewBatch,
  flushAllViewBatches,
  getBatchedViewCount,
  FLUSH_INTERVAL,
  FLUSH_THRESHOLD,
} from './view-batcher';
