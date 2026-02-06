/**
 * =============================================================================
 * Campus Resource Engine - OTP Service
 * =============================================================================
 * Handles OTP generation and verification using Redis for storage
 * Falls back to in-memory storage if Redis is unavailable (dev mode only)
 * =============================================================================
 */

import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

const OTP_KEY_PREFIX = 'otp:';

// In-memory fallback for when Redis is not available (development only)
const inMemoryOtpStore = new Map<string, { otp: string; expiresAt: number }>();

/**
 * Generate a random numeric OTP
 */
function generateRandomOtp(length: number): string {
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10).toString();
    }
    return otp;
}

/**
 * Clean expired entries from in-memory store
 */
function cleanExpiredInMemoryOtps(): void {
    const now = Date.now();
    for (const [key, value] of inMemoryOtpStore.entries()) {
        if (value.expiresAt < now) {
            inMemoryOtpStore.delete(key);
        }
    }
}

/**
 * Generate and store OTP for a user
 */
export async function generateOtp(userId: string): Promise<string> {
    const otp = generateRandomOtp(config.otp.length);
    const key = `${OTP_KEY_PREFIX}${userId}`;
    const expiryMs = config.otp.expirySeconds * 1000;

    // Try Redis first
    if (redis) {
        try {
            await redis.setex(key, config.otp.expirySeconds, otp);
            logger.info({ userId }, 'OTP generated and stored in Redis');
            return otp;
        } catch (error) {
            logger.warn({ userId, error }, 'Redis unavailable, falling back to in-memory OTP storage');
        }
    }

    // Fallback to in-memory storage (development only)
    if (config.nodeEnv !== 'production') {
        cleanExpiredInMemoryOtps();
        inMemoryOtpStore.set(key, {
            otp,
            expiresAt: Date.now() + expiryMs,
        });
        logger.info({ userId }, 'OTP generated and stored in-memory (dev fallback)');
        return otp;
    }

    // In production, Redis is required
    throw new Error('Redis is required for OTP functionality in production');
}

/**
 * Verify OTP for a user
 * Returns true if OTP is valid, false otherwise
 * Deletes the OTP after successful verification (one-time use)
 */
export async function verifyOtp(userId: string, inputOtp: string): Promise<boolean> {
    const key = `${OTP_KEY_PREFIX}${userId}`;

    // Try Redis first
    if (redis) {
        try {
            const storedOtp = await redis.get(key);

            if (!storedOtp) {
                logger.warn({ userId }, 'OTP not found or expired');
                return false;
            }

            if (storedOtp !== inputOtp) {
                logger.warn({ userId }, 'OTP mismatch');
                return false;
            }

            // Delete OTP after successful verification (one-time use)
            await redis.del(key);
            logger.info({ userId }, 'OTP verified successfully');
            return true;
        } catch (error) {
            logger.warn({ userId, error }, 'Redis unavailable, checking in-memory store');
        }
    }

    // Fallback to in-memory storage
    cleanExpiredInMemoryOtps();
    const stored = inMemoryOtpStore.get(key);

    if (!stored) {
        logger.warn({ userId }, 'OTP not found or expired (in-memory)');
        return false;
    }

    if (stored.expiresAt < Date.now()) {
        inMemoryOtpStore.delete(key);
        logger.warn({ userId }, 'OTP expired (in-memory)');
        return false;
    }

    if (stored.otp !== inputOtp) {
        logger.warn({ userId }, 'OTP mismatch (in-memory)');
        return false;
    }

    // Delete OTP after successful verification
    inMemoryOtpStore.delete(key);
    logger.info({ userId }, 'OTP verified successfully (in-memory)');
    return true;
}

/**
 * Delete OTP for a user (for resend scenarios)
 */
export async function deleteOtp(userId: string): Promise<void> {
    const key = `${OTP_KEY_PREFIX}${userId}`;

    if (redis) {
        try {
            await redis.del(key);
        } catch (error) {
            logger.warn({ userId, error }, 'Redis unavailable for delete');
        }
    }

    inMemoryOtpStore.delete(key);
    logger.info({ userId }, 'OTP deleted');
}

/**
 * Check if OTP exists (not expired)
 */
export async function hasActiveOtp(userId: string): Promise<boolean> {
    const key = `${OTP_KEY_PREFIX}${userId}`;

    if (redis) {
        try {
            const exists = await redis.exists(key);
            return exists === 1;
        } catch (error) {
            logger.warn({ userId, error }, 'Redis unavailable for exists check');
        }
    }

    const stored = inMemoryOtpStore.get(key);
    return stored ? stored.expiresAt > Date.now() : false;
}

/**
 * Get remaining TTL for OTP (in seconds)
 */
export async function getOtpTtl(userId: string): Promise<number> {
    const key = `${OTP_KEY_PREFIX}${userId}`;

    if (redis) {
        try {
            const ttl = await redis.ttl(key);
            return ttl > 0 ? ttl : 0;
        } catch (error) {
            logger.warn({ userId, error }, 'Redis unavailable for TTL check');
        }
    }

    const stored = inMemoryOtpStore.get(key);
    if (!stored) return 0;
    const remaining = Math.floor((stored.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
}

export const otpService = {
    generateOtp,
    verifyOtp,
    deleteOtp,
    hasActiveOtp,
    getOtpTtl,
};
