/**
 * =============================================================================
 * Campus Resource Engine - Prisma Database Client
 * =============================================================================
 * Singleton Prisma client with connection management
 * 
 * ARCHITECTURAL DECISIONS:
 * - Singleton pattern prevents connection pool exhaustion
 * - Query logging in development mode
 * - Graceful shutdown handling
 * =============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';
import { isDevelopment } from '../config/index.js';

/**
 * Global variable to store Prisma client instance
 * This prevents creating multiple clients during hot reload in development
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create Prisma client with logging configuration
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });
}

/**
 * Singleton Prisma client instance
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Prevent multiple instances in development
if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}

/**
 * Setup event listeners for logging
 */
if (isDevelopment) {
  // @ts-expect-error - Prisma event types
  prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
    logger.trace({
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    }, 'Database query executed');
  });
}

// @ts-expect-error - Prisma event types
prisma.$on('error', (e: { message: string }) => {
  logger.error({ error: e.message }, 'Database error');
});

// @ts-expect-error - Prisma event types
prisma.$on('warn', (e: { message: string }) => {
  logger.warn({ warning: e.message }, 'Database warning');
});

/**
 * Connect to the database
 * Call this during server startup
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.fatal({ error }, '❌ Failed to connect to database');
    throw error;
  }
}

/**
 * Disconnect from the database
 * Call this during graceful shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from database');
    throw error;
  }
}

/**
 * Health check for database connection
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
