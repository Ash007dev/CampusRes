/**
 * =============================================================================
 * Campus Resource Engine - Express Application
 * =============================================================================
 * Main Express app configuration with middleware stack
 * =============================================================================
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import routes from './routes/index.js';
import {
  errorHandler,
  notFoundHandler,
  standardRateLimiter,
} from './middleware/index.js';
import { setupSwagger } from './swagger.js';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // ==========================================================================
  // CORS - ABSOLUTELY FIRST - SIMPLEST POSSIBLE CONFIG
  // ==========================================================================

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // ==========================================================================
  // SECURITY MIDDLEWARE
  // ==========================================================================

  // Helmet - secure HTTP headers
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }));

  // Rate limiting
  app.use(standardRateLimiter);

  // ==========================================================================
  // REQUEST PROCESSING MIDDLEWARE
  // ==========================================================================

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Response compression
  app.use(compression());

  // Request ID tracking
  app.use((req, _res, next) => {
    req.headers['x-request-id'] =
      req.headers['x-request-id'] ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  // Request logging (filtered for readability)
  const NOISY_PATHS = ['/health', '/api-docs', '/dev-docs', '/favicon.ico', '/api/v1/health'];
  app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      // Skip noisy routes that clutter the logs
      if (NOISY_PATHS.some(p => req.path.startsWith(p))) return;

      const duration = Date.now() - startTime;
      const logData = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        time: `${duration}ms`,
      };

      // Errors get full visibility, success gets debug
      if (res.statusCode >= 400) {
        logger.warn(logData, `${req.method} ${req.path} -> ${res.statusCode}`);
      } else {
        logger.info(logData, `${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
      }
    });

    next();
  });

  // ==========================================================================
  // API DOCUMENTATION
  // ==========================================================================

  setupSwagger(app);

  // ==========================================================================
  // API ROUTES
  // ==========================================================================

  // Mount API routes
  app.use(`/api/${config.apiVersion}`, routes);

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Campus Resource Engine API',
        version: '1.0.0',
        documentation: `/api-docs`,
        health: `/api/${config.apiVersion}/health`,
      },
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
