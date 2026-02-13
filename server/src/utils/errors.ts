/**
 * =============================================================================
 * Campus Resource Engine - Custom Error Classes
 * =============================================================================
 * Strongly-typed error classes for consistent error handling
 * 
 * PATTERN: Custom errors extend base AppError for:
 * - Consistent error structure across the application
 * - Proper HTTP status code mapping
 * - Error code for client-side handling
 * - Operational vs Programming error distinction
 * =============================================================================
 */

import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: string = ERROR_CODES.SYSTEM_ERROR,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize error for API response
   */
  public toJSON() {
    const errorObj: { message: string; code: string; details?: Record<string, unknown> | undefined } = {
      message: this.message,
      code: this.code,
    };
    if (this.details && Object.keys(this.details).length > 0) {
      errorObj.details = this.details as Record<string, unknown>;
    }
    return {
      success: false,
      error: errorObj,
    };
  }
}

/**
 * =============================================================================
 * Authentication Errors
 * =============================================================================
 */

export class UnauthorizedError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: string = ERROR_CODES.AUTH_INVALID_CREDENTIALS
  ) {
    super(message, HTTP_STATUS.UNAUTHORIZED, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message: string = 'Access denied',
    code: string = ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS
  ) {
    super(message, HTTP_STATUS.FORBIDDEN, code);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message: string = 'Token has expired') {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTH_TOKEN_EXPIRED);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message: string = 'Invalid email or password') {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }
}

export class UserNotFoundError extends AppError {
  constructor(userId?: string) {
    super(
      userId ? `User ${userId} not found` : 'User not found',
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.USER_NOT_FOUND
    );
  }
}

export class EmailAlreadyExistsError extends AppError {
  constructor(email?: string) {
    super(
      email ? `Email ${email} is already registered` : 'Email already registered',
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.USER_EMAIL_EXISTS
    );
  }
}

/**
 * =============================================================================
 * Booking Errors
 * =============================================================================
 */

export class BookingConflictError extends AppError {
  constructor(
    message: string = 'The requested time slot is no longer available',
    details?: unknown
  ) {
    super(
      message,
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.BOOKING_OVERLAP_CONFLICT,
      true,
      details
    );
  }
}

export class QuotaExceededError extends AppError {
  constructor(
    message: string = 'Weekly booking quota exceeded',
    details?: { currentUsage: number; limit: number; requested: number }
  ) {
    super(
      message,
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.BOOKING_QUOTA_EXCEEDED,
      true,
      details
    );
  }
}

export class DepartmentRestrictionError extends AppError {
  constructor(
    message: string = 'Cross-department booking not allowed at this time',
    details?: { userDepartment: string; roomDepartment: string; allowedAfter: number }
  ) {
    super(
      message,
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.BOOKING_DEPARTMENT_RESTRICTED,
      true,
      details
    );
  }
}

export class BookingNotFoundError extends AppError {
  constructor(bookingId?: string) {
    super(
      bookingId ? `Booking ${bookingId} not found` : 'Booking not found',
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.BOOKING_NOT_FOUND
    );
  }
}

export class InvalidTimeRangeError extends AppError {
  constructor(message: string = 'Invalid booking time range') {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BOOKING_INVALID_TIME_RANGE);
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(
    message: string = 'Insufficient credits for this booking',
    details?: { required: number; available: number }
  ) {
    super(
      message,
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.BOOKING_INSUFFICIENT_CREDITS,
      true,
      details
    );
  }
}

export class RecurringBookingConflictError extends AppError {
  constructor(
    message: string = 'One or more slots in the recurring series conflict with existing bookings',
    details?: { conflictingDates: string[] }
  ) {
    super(
      message,
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.BOOKING_RECURRING_CONFLICT,
      true,
      details
    );
  }
}

/**
 * =============================================================================
 * Room Errors
 * =============================================================================
 */

export class RoomNotFoundError extends AppError {
  constructor(roomId?: string) {
    super(
      roomId ? `Room ${roomId} not found` : 'Room not found',
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.ROOM_NOT_FOUND
    );
  }
}

export class RoomMaintenanceError extends AppError {
  constructor(roomName?: string) {
    super(
      roomName
        ? `Room ${roomName} is currently under maintenance`
        : 'Room is under maintenance',
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.ROOM_MAINTENANCE
    );
  }
}

/**
 * =============================================================================
 * Check-in Errors
 * =============================================================================
 */

export class CheckInError extends AppError {
  constructor(
    message: string,
    code: string = ERROR_CODES.CHECKIN_INVALID_QR
  ) {
    super(message, HTTP_STATUS.BAD_REQUEST, code);
  }
}

export class GeolocationError extends AppError {
  constructor(
    message: string = 'You are not within the allowed check-in range',
    details?: { distance: number; allowedRadius: number }
  ) {
    super(
      message,
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.CHECKIN_OUT_OF_RANGE,
      true,
      details
    );
  }
}

/**
 * =============================================================================
 * Validation Errors
 * =============================================================================
 */

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      true,
      details
    );
  }
}

/**
 * =============================================================================
 * Resource Errors
 * =============================================================================
 */

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.BOOKING_NOT_FOUND
    );
  }
}

/**
 * =============================================================================
 * Database Errors
 * =============================================================================
 */

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.DATABASE_ERROR, false);
  }
}
