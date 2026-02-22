/**
 * =============================================================================
 * Campus Resource Engine - Logger Configuration
 * =============================================================================
 * Production-grade logging with Pino
 * - Structured JSON logging in production
 * - Pretty printing in development
 * - Request ID tracking
 * - Performance metrics
 * =============================================================================
 */

import { pino, type LoggerOptions, type TransportSingleOptions } from 'pino';
import { config, isDevelopment } from './index.js';

/**
 * Create the base logger configuration
 */
const baseConfig: LoggerOptions = {
  level: config.logLevel,

  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,

  // Base context for all logs
  base: {
    service: 'campus-resource-engine',
    version: '1.0.0',
    env: config.nodeEnv,
  },

  // Custom serializers for common objects
  serializers: {
    // Sanitize error objects
    err: pino.stdSerializers.err,

    // Sanitize request objects (remove sensitive headers)
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'x-request-id': req.headers['x-request-id'],
      },
    }),

    // Sanitize response objects
    res: (res) => ({
      statusCode: res.statusCode,
      headers: {
        'content-type': res.getHeader('content-type'),
        'content-length': res.getHeader('content-length'),
      },
    }),
  },

  // Redact sensitive information
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
};

/**
 * Development transport configuration with pretty printing
 /**
 * Pretty printing transport for development
 */
const devTransport: TransportSingleOptions = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'pid,hostname,service,version,env',
    singleLine: true,
  },
};

/**
 * Create the logger instance
 * - Uses pretty printing in development
 * - Uses JSON logging in production
 */
export const logger = isDevelopment
  ? pino(baseConfig, pino.transport(devTransport))
  : pino(baseConfig);

/**
 * Create a child logger with additional context
 * Useful for adding request-specific context
 * 
 * @param context - Additional context to add to all logs
 * @returns Child logger instance
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log levels for reference:
 * - trace: Very detailed debugging (10)
 * - debug: Debugging information (20)
 * - info: General information (30)
 * - warn: Warning messages (40)
 * - error: Error messages (50)
 * - fatal: Fatal errors (60)
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
