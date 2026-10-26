import { redisClient, isRedisConnected } from '../config/redis';
import detectionEngine from '../detection/detectionEngine';

// In-memory fallback cache when Redis is unavailable
interface InMemEntry {
  val: any;
  expiresAt: number;
}
const inMemoryCache = new Map<string, InMemEntry>();

export const CACHE_KEYS = {
  ANALYTICS_SUMMARY: 'security:analytics:summary',
};

/**
 * Retrieve cached JSON value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (err) {
      console.error(`[Cache] Redis GET error for key ${key}:`, err);
    }
  }

  // Fallback to in-memory cache
  const item = inMemoryCache.get(key);
  if (item) {
    if (Date.now() > item.expiresAt) {
      inMemoryCache.delete(key);
      return null;
    }
    return item.val as T;
  }

  return null;
}

/**
 * Store a value in cache with a TTL (in seconds)
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
      return;
    } catch (err) {
      console.error(`[Cache] Redis SET error for key ${key}:`, err);
    }
  }

  // Fallback in-memory cache
  inMemoryCache.set(key, {
    val: value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate a cached key
 */
export async function invalidateCache(key: string): Promise<void> {
  inMemoryCache.delete(key);

  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.error(`[Cache] Redis DEL error for key ${key}:`, err);
    }
  }
}

// Invalidate summary analytics cache whenever a new threat alert is triggered
detectionEngine.onAlertGenerated(async () => {
  await invalidateCache(CACHE_KEYS.ANALYTICS_SUMMARY);
});
