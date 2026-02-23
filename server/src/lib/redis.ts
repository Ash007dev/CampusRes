/**
 * =============================================================================
 * Campus Resource Engine - Redis Client
 * =============================================================================
 * Redis client for caching and pub/sub functionality
 * 
 * USES:
 * - Caching room availability
 * - Rate limiting
 * - Session storage
 * - Real-time pub/sub for Socket.io
 * - BullMQ job queue backend
 * =============================================================================
 */

import RedisModule from 'ioredis';

const Redis = RedisModule.default || RedisModule;
type RedisType = InstanceType<typeof Redis>;

import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Global variable to store Redis client instance
 */
const globalForRedis = globalThis as unknown as {
  redis: RedisType | undefined;
};


/**
 * Create Redis client with configuration
 * Made optional - server works without Redis (just no caching)
 */
function createRedisClient(): RedisType | null {
  try {
    let hasLoggedUnavailable = false;

    const client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,

      // Connection settings
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          if (!hasLoggedUnavailable) {
            logger.warn(`Redis unavailable at ${config.redis.host}:${config.redis.port} - running without cache`);
            hasLoggedUnavailable = true;
          }
          return null; // Stop retrying
        }
        return Math.min(times * 500, 2000);
      },

      // Use lazy connect to prevent blocking startup
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    // Event handlers
    client.on('connect', () => {
      logger.info(`Redis connected at ${config.redis.host}:${config.redis.port}`);
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    client.on('error', () => {
      // Silenced — retryStrategy handles logging
    });

    client.on('close', () => {
      logger.debug('Redis connection closed');
    });

    // Try to connect but don't block
    client.connect().catch(() => {
      if (!hasLoggedUnavailable) {
        logger.warn(`Redis not available at ${config.redis.host}:${config.redis.port} - caching disabled`);
        hasLoggedUnavailable = true;
      }
    });

    return client;
  } catch (error) {
    logger.warn('Redis initialization failed - running without cache');
    return null;
  }
}

/**
 * Singleton Redis client instance (may be null if Redis unavailable)
 */
export const redis: RedisType | null = globalForRedis.redis ?? createRedisClient();

// Prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis ?? undefined;
}

/**
 * Disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (!redis) return;
  try {
    await redis.quit();
    logger.info('Redis client disconnected');
  } catch (error) {
    logger.debug({ error }, 'Error disconnecting Redis (optional)');
  }
}

/**
 * Health check for Redis connection
 */
export async function isRedisHealthy(): Promise<boolean> {
  if (!redis) return false;
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * =============================================================================
 * Cache Helper Functions
 * =============================================================================
 */

/**
 * Get cached value with type safety
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.debug({ error, key }, 'Cache get error');
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.debug({ error, key }, 'Cache set error');
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    logger.debug({ error, key }, 'Cache delete error');
  }
}

/**
 * Delete all keys matching a pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.debug({ error, pattern }, 'Cache delete pattern error');
  }
}

/**
 * Increment a counter (useful for rate limiting)
 */
export async function incrementCounter(
  key: string,
  ttlSeconds: number
): Promise<number> {
  if (!redis) return 0;
  try {
    const multi = redis.multi();
    multi.incr(key);
    multi.expire(key, ttlSeconds);
    const results = await multi.exec();
    return (results?.[0]?.[1] as number) || 0;
  } catch {
    return 0;
  }
}

