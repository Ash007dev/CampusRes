/**
 * =============================================================================
 * Campus Resource Engine - Server Entry Point
 * =============================================================================
 * Production-ready server initialization with graceful shutdown
 * Now using Supabase client instead of Prisma
 * =============================================================================
 */

import { createServer } from 'http';
import { createApp } from './app.js';
import { config, isDevelopment } from './config/index.js';
import { logger } from './config/logger.js';
import { testConnection, disconnect } from './lib/supabase.js';
import { disconnectRedis, isRedisHealthy } from './lib/redis.js';
import { initSocketServer } from './lib/socket.js';
import { scheduleGhostKiller } from './jobs/ghostKiller.js';
import { scheduleBookingReminder } from './jobs/bookingReminder.js';
import type { Server } from 'http';

// Track server instance for graceful shutdown
let server: Server | null = null;

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('🚀 Starting Campus Resource Engine...');

    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    // Create Express app
    const app = createApp();

    // Create HTTP server
    server = createServer(app);

    // Initialize Socket.io
    initSocketServer(server);
    logger.info('🔌 Socket.io server initialized');

    // Start HTTP server
    server.listen(config.port, async () => {
      const redisOk = await isRedisHealthy();
      logger.info('='.repeat(60));
      logger.info('  Campus Resource Engine - Server Started');
      logger.info('='.repeat(60));
      logger.info(`  Port:          ${config.port}`);
      logger.info(`  Environment:   ${config.nodeEnv}`);
      logger.info(`  API Version:   ${config.apiVersion}`);
      logger.info(`  Database:      Connected (Supabase)`);
      logger.info(`  Redis:         ${redisOk ? 'Connected' : 'Unavailable (using fallbacks)'}`);
      logger.info(`  Socket.io:     Initialized`);
      logger.info(`  API Base:      http://localhost:${config.port}/api/${config.apiVersion}`);
      logger.info(`  API Docs:      http://localhost:${config.port}/api-docs`);
      logger.info('='.repeat(60));
    });

    // Schedule Ghost Killer cron job
    if (!isDevelopment || process.env.ENABLE_GHOST_KILLER === 'true') {
      scheduleGhostKiller();
    } else {
      logger.info('👻 Ghost Killer disabled in development (set ENABLE_GHOST_KILLER=true to enable)');
    }

    // Schedule Booking Reminder cron job
    scheduleBookingReminder();
    logger.info('⏰ Booking Reminder cron job enabled');

    // Setup graceful shutdown handlers
    setupGracefulShutdown();

  } catch (error) {
    logger.fatal({ error }, '❌ Failed to start server');
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '📴 Received shutdown signal, gracefully shutting down...');

    // Stop accepting new connections
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Cleanup resources
    try {
      await disconnect();
      await disconnectRedis();

      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, '💥 Uncaught Exception');
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, '💥 Unhandled Rejection');
    shutdown('UNHANDLED_REJECTION');
  });
}

// Start the server
startServer();
