/**
 * =============================================================================
 * Campus Resource Engine - Configuration Module
 * =============================================================================
 * Centralized configuration management with environment variable validation.
 * Uses the "Fail Fast" principle - application won't start with invalid config.
 * 
 * ARCHITECTURAL DECISION:
 * - All configuration is loaded and validated at startup
 * - No magic numbers in code - all values come from config
 * - Type-safe configuration with TypeScript
 * =============================================================================
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration schema with strict validation
 * Uses Zod for runtime type checking of environment variables
 */
const configSchema = z.object({
  // Server Configuration
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().min(1).max(65535).default(3001),
  apiVersion: z.string().default('v1'),

  // Database Configuration
  databaseUrl: z.string().url().or(z.string().startsWith('postgresql://')),

  // Redis Configuration
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
  }),

  // JWT Configuration
  jwt: z.object({
    secret: z.string().min(32, 'JWT secret must be at least 32 characters'),
    expiresIn: z.string().default('7d'),
    refreshSecret: z.string().min(32).optional(),
    refreshExpiresIn: z.string().default('30d'),
  }),

  // Rate Limiting
  rateLimit: z.object({
    windowMs: z.coerce.number().default(60000), // 1 minute
    maxRequests: z.coerce.number().default(100),
  }),

  // CORS Configuration
  cors: z.object({
    origin: z.string().default('http://localhost:3000'),
    credentials: z.coerce.boolean().default(true),
  }),

  // Sentry Configuration
  sentry: z.object({
    dsn: z.string().optional(),
    environment: z.string().default('development'),
  }),

  // Ghost Killer Configuration
  ghostKiller: z.object({
    gracePeriodMinutes: z.coerce.number().default(15),
    reputationPenalty: z.coerce.number().default(5),
    cronSchedule: z.string().default('*/5 * * * *'), // Every 5 minutes
  }),

  // Booking Configuration
  booking: z.object({
    maxWeeklyQuotaHours: z.coerce.number().default(4),
    peakHoursStart: z.coerce.number().min(0).max(23).default(9),
    peakHoursEnd: z.coerce.number().min(0).max(23).default(17),
    peakHourCreditMultiplier: z.coerce.number().default(2),
    crossDepartmentAllowedAfterHour: z.coerce.number().min(0).max(23).default(0),
    maxRecurringWeeks: z.coerce.number().default(10),
  }),

  // Geolocation Configuration
  checkIn: z.object({
    radiusMeters: z.coerce.number().default(50),
  }),

  // Logging Configuration
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('debug'),
});

/**
 * Parse and validate configuration from environment variables
 */
function loadConfig() {
  const rawConfig = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    apiVersion: process.env.API_VERSION,
    databaseUrl: process.env.DATABASE_URL,
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'development-secret-key-change-in-production-min-32-chars',
      expiresIn: process.env.JWT_EXPIRES_IN,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    },
    rateLimit: {
      windowMs: process.env.RATE_LIMIT_WINDOW_MS,
      maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    },
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: process.env.CORS_CREDENTIALS,
    },
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT,
    },
    ghostKiller: {
      gracePeriodMinutes: process.env.GHOST_KILLER_GRACE_PERIOD_MINUTES,
      reputationPenalty: process.env.GHOST_KILLER_REPUTATION_PENALTY,
      cronSchedule: process.env.GHOST_KILLER_CRON_SCHEDULE,
    },
    booking: {
      maxWeeklyQuotaHours: process.env.MAX_WEEKLY_QUOTA_HOURS,
      peakHoursStart: process.env.PEAK_HOURS_START,
      peakHoursEnd: process.env.PEAK_HOURS_END,
      peakHourCreditMultiplier: process.env.PEAK_HOUR_CREDIT_MULTIPLIER,
      crossDepartmentAllowedAfterHour: process.env.CROSS_DEPARTMENT_ALLOWED_AFTER_HOUR,
      maxRecurringWeeks: process.env.MAX_RECURRING_WEEKS,
    },
    checkIn: {
      radiusMeters: process.env.CHECKIN_RADIUS_METERS,
    },
    logLevel: process.env.LOG_LEVEL,
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error('❌ Configuration validation failed:');
    console.error(result.error.format());
    process.exit(1); // Fail Fast principle
  }

  return result.data;
}

/**
 * Exported configuration object - validated and type-safe
 */
export const config = loadConfig();

/**
 * Type export for use in other modules
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Helper to check if we're in development mode
 */
export const isDevelopment = config.nodeEnv === 'development';

/**
 * Helper to check if we're in production mode
 */
export const isProduction = config.nodeEnv === 'production';

/**
 * Helper to check if we're in test mode
 */
export const isTest = config.nodeEnv === 'test';
