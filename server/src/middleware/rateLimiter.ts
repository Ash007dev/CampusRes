/**
 * =============================================================================
 * Campus Resource Engine - Rate Limiting Middleware
 * =============================================================================
 * Protection against abuse and DDoS attacks
 * 
 * FEATURES:
 * - Redis-backed for distributed rate limiting
 * - Configurable limits per endpoint
 * - User-specific vs IP-based limiting
 * - Graceful degradation if Redis is unavailable
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { redis, incrementCounter } from '../lib/redis.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import type { AuthenticatedRequest } from './auth.js';

/**
 * Custom Redis store for rate limiting
 * Uses Redis for distributed rate limiting across multiple server instances
 */
class RedisRateLimitStore {
  private prefix: string;
  private windowMs: number;

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  /**
   * Get the key for storing rate limit data
   */
  private getKey(key: string): string {
    return `ratelimit:${this.prefix}:${key}`;
  }

  /**
   * Increment the counter for a key
   */
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = this.getKey(key);
    const ttlSeconds = Math.ceil(this.windowMs / 1000);

    try {
      const totalHits = await incrementCounter(redisKey, ttlSeconds);
      const resetTime = new Date(Date.now() + this.windowMs);

      return { totalHits, resetTime };
    } catch (error) {
      logger.error({ error, key }, 'Redis rate limit increment failed');
      // Fail open - allow the request if Redis is unavailable
      return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  /**
   * Decrement the counter (used when rate limit should not apply)
   */
  async decrement(key: string): Promise<void> {
    if (!redis) return;
    const redisKey = this.getKey(key);
    try {
      await redis.decr(redisKey);
    } catch (error) {
      logger.debug({ error, key }, 'Redis rate limit decrement failed');
    }
  }

  /**
   * Reset the counter for a key
   */
  async resetKey(key: string): Promise<void> {
    if (!redis) return;
    const redisKey = this.getKey(key);
    try {
      await redis.del(redisKey);
    } catch (error) {
      logger.debug({ error, key }, 'Redis rate limit reset failed');
    }
  }
}

/**
 * Get identifier for rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP
 */
function getIdentifier(req: Request): string {
  const authReq = req as AuthenticatedRequest;

  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }

  // Get IP address, handling proxies
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.ip || req.socket.remoteAddress || 'unknown';

  return `ip:${ip}`;
}

/**
 * Standard rate limiter configuration
 * Default: 100 requests per minute
 */
export const standardRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers

  keyGenerator: getIdentifier,

  handler: (_req, res, _next, options) => {
    logger.warn({
      message: 'Rate limit exceeded',
      limit: options.max,
      windowMs: options.windowMs,
    });

    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        message: 'Too many requests. Please try again later.',
        code: ERROR_CODES.SYSTEM_ERROR,
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },

  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/v1/health';
  },
});

/**
 * Stricter rate limiter for authentication endpoints
 * Prevents brute force attacks
 * Default: 5 requests per minute
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: getIdentifier,

  handler: (_req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        message: 'Too many authentication attempts. Please try again in a minute.',
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        retryAfter: 60,
      },
    });
  },
});

/**
 * Booking creation rate limiter
 * Prevents spam booking attempts
 * Default: 10 bookings per minute
 */
export const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: getIdentifier,

  handler: (_req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        message: 'Too many booking attempts. Please wait before trying again.',
        code: ERROR_CODES.BOOKING_SLOT_UNAVAILABLE,
        retryAfter: 60,
      },
    });
  },
});

/**
 * Custom rate limiter factory
 * Creates a rate limiter with custom settings
 * 
 * @param options - Rate limiter options
 * @returns Rate limiter middleware
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  prefix?: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getIdentifier,
    handler: (_req, res) => {
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: {
          message: options.message || 'Too many requests. Please try again later.',
          code: ERROR_CODES.SYSTEM_ERROR,
          retryAfter: Math.ceil(options.windowMs / 1000),
        },
      });
    },
  });
}

/**
 * Sliding window rate limiter using Redis
 * More accurate than fixed window for high-traffic scenarios
 */
export async function slidingWindowRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const identifier = getIdentifier(req);
  const store = new RedisRateLimitStore('sliding', config.rateLimit.windowMs);

  try {
    const { totalHits, resetTime } = await store.increment(identifier);

    // Set rate limit headers
    res.setHeader('RateLimit-Limit', config.rateLimit.maxRequests);
    res.setHeader('RateLimit-Remaining', Math.max(0, config.rateLimit.maxRequests - totalHits));
    res.setHeader('RateLimit-Reset', resetTime.toISOString());

    if (totalHits > config.rateLimit.maxRequests) {
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: {
          message: 'Rate limit exceeded',
          code: ERROR_CODES.SYSTEM_ERROR,
          retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
        },
      });
      return;
    }

    next();
  } catch (error) {
    // Fail open if Redis is unavailable
    logger.error({ error }, 'Sliding window rate limiter error');
    next();
  }
}
