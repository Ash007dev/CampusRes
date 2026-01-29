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
  // SECURITY MIDDLEWARE
  // ==========================================================================

  // Helmet - secure HTTP headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
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

  // Request logging
  app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.headers['x-request-id'],
      }, 'Request completed');
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
