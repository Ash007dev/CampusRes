/**
 * =============================================================================
 * Campus Resource Engine - Error Handling Middleware
 * =============================================================================
 * Centralized error handling for consistent API responses
 * Modified to remove Prisma-specific error handling
 * =============================================================================
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/index.js';
import { AppError, BookingConflictError, DatabaseError } from '../utils/errors.js';
import { HTTP_STATUS, PG_ERROR_CODES, ERROR_CODES } from '../config/constants.js';

/**
 * Standard error response structure
 */
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
    stack?: string;
  };
  requestId?: string;
}

/**
 * Handle PostgreSQL raw errors (including EXCLUDE constraint violations)
 */
function handlePostgresError(error: { code?: string; message?: string }): AppError {
  // CRITICAL: Handle tsrange EXCLUDE constraint violation
  if (error.code === PG_ERROR_CODES.EXCLUSION_VIOLATION) {
    return new BookingConflictError(
      'This time slot conflicts with an existing booking. Please choose a different time.',
      { postgresCode: error.code }
    );
  }

  if (error.code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
    return new AppError(
      'A record with this value already exists',
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Handle Supabase/PostgreSQL common errors
  if (error.code === '23503') { // Foreign key constraint violation
    return new AppError(
      'The referenced resource does not exist',
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  if (error.code === '23502') { // Not null constraint violation
    return new AppError(
      'Required field is missing',
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  return new DatabaseError(error.message || 'Database operation failed');
}

/**
 * Handle Supabase-specific errors
 */
function handleSupabaseError(error: { code?: string; message?: string; details?: string }): AppError {
  // Record not found (empty result)
  if (error.code === 'PGRST116') {
    return new AppError(
      'The requested resource was not found',
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.BOOKING_NOT_FOUND
    );
  }

  // Invalid data format
  if (error.code?.startsWith('22')) {
    return new AppError(
      'Invalid data format provided',
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  return new DatabaseError(error.message || 'Database operation failed');
}

/**
 * Not Found handler for undefined routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
    },
    requestId: req.headers['x-request-id'] as string,
  };

  res.status(HTTP_STATUS.NOT_FOUND).json(response);
}

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  let appError: AppError;

  // Convert known error types to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if ((error as { code?: string }).code?.startsWith('2')) {
    // PostgreSQL error codes start with 2
    appError = handlePostgresError(error as { code?: string; message?: string });
  } else if ((error as { code?: string }).code?.startsWith('PGRST')) {
    // Supabase/PostgREST error codes
    appError = handleSupabaseError(error as { code?: string; message?: string });
  } else {
    // Unknown error - treat as internal server error
    appError = new AppError(
      isProduction ? 'An unexpected error occurred' : error.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.SYSTEM_ERROR,
      false
    );
  }

  // Log the error
  const logContext = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: appError.statusCode,
    errorCode: appError.code,
    isOperational: appError.isOperational,
    userId: (req as { user?: { userId: string } }).user?.userId,
  };

  if (appError.isOperational) {
    logger.warn({ ...logContext, message: appError.message }, 'Operational error');
  } else {
    logger.error(
      { ...logContext, err: error, stack: error.stack },
      'Unexpected error'
    );
  }

  // Build response
  const response: ErrorResponse = {
    success: false,
    error: {
      message: appError.message,
      code: appError.code,
    },
    requestId,
  };

  if (appError.details) {
    response.error.details = appError.details;
  }
  if (!isProduction && error.stack) {
    response.error.stack = error.stack;
  }

  res.status(appError.statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
