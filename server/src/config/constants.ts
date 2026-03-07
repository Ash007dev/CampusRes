/**
 * =============================================================================
 * Campus Resource Engine - HTTP Status Constants
 * =============================================================================
 * Centralized HTTP status codes to avoid magic numbers
 * =============================================================================
 */

export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * =============================================================================
 * Application Error Codes
 * =============================================================================
 * Custom error codes for specific business logic errors
 * =============================================================================
 */

export const ERROR_CODES = {
  // Authentication Errors (1xxx)
  AUTH_INVALID_CREDENTIALS: 'AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'AUTH_1002',
  AUTH_TOKEN_INVALID: 'AUTH_1003',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_1004',
  AUTH_ACCOUNT_DISABLED: 'AUTH_1005',

  // Booking Errors (2xxx)
  BOOKING_SLOT_UNAVAILABLE: 'BOOKING_2001',
  BOOKING_QUOTA_EXCEEDED: 'BOOKING_2002',
  BOOKING_DEPARTMENT_RESTRICTED: 'BOOKING_2003',
  BOOKING_OVERLAP_CONFLICT: 'BOOKING_2004',
  BOOKING_NOT_FOUND: 'BOOKING_2005',
  BOOKING_ALREADY_CANCELLED: 'BOOKING_2006',
  BOOKING_CANNOT_MODIFY: 'BOOKING_2007',
  BOOKING_INVALID_TIME_RANGE: 'BOOKING_2008',
  BOOKING_RECURRING_CONFLICT: 'BOOKING_2009',
  BOOKING_REQUIRES_APPROVAL: 'BOOKING_2010',
  BOOKING_INSUFFICIENT_CREDITS: 'BOOKING_2011',

  // Room Errors (3xxx)
  ROOM_NOT_FOUND: 'ROOM_3001',
  ROOM_MAINTENANCE: 'ROOM_3002',
  ROOM_INACTIVE: 'ROOM_3003',

  // Check-in Errors (4xxx)
  CHECKIN_TOO_EARLY: 'CHECKIN_4001',
  CHECKIN_TOO_LATE: 'CHECKIN_4002',
  CHECKIN_INVALID_QR: 'CHECKIN_4003',
  CHECKIN_OUT_OF_RANGE: 'CHECKIN_4004',
  CHECKIN_ALREADY_DONE: 'CHECKIN_4005',

  // User Errors (5xxx)
  USER_NOT_FOUND: 'USER_5001',
  USER_EMAIL_EXISTS: 'USER_5002',
  USER_LOW_REPUTATION: 'USER_5003',

  // Validation Errors (6xxx)
  VALIDATION_ERROR: 'VALIDATION_6001',

  // System Errors (9xxx)
  SYSTEM_ERROR: 'SYSTEM_9001',
  DATABASE_ERROR: 'SYSTEM_9002',
  EXTERNAL_SERVICE_ERROR: 'SYSTEM_9003',
} as const;

/**
 * =============================================================================
 * Booking Status Constants
 * =============================================================================
 */

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  NO_SHOW: 'NO_SHOW',
} as const;

/**
 * =============================================================================
 * User Role Constants
 * =============================================================================
 */

export const USER_ROLES = {
  STUDENT: 'STUDENT',
  FACULTY: 'FACULTY',
  LAB_ADMIN: 'LAB_ADMIN',
  ADMIN: 'ADMIN',
} as const;

/**
 * =============================================================================
 * Room Types
 * =============================================================================
 */

export const ROOM_TYPES = {
  CLASSROOM: 'classroom',
  LAB: 'lab',
  AUDITORIUM: 'auditorium',
  MEETING_ROOM: 'meeting_room',
  CONFERENCE_HALL: 'conference_hall',
  CONFERENCE_ROOM: 'conference_room',
  STUDY_ROOM: 'study_room',
} as const;

/**
 * Rooms that require admin approval for booking
 */
/**
 * Room types that require admin approval (legacy, for compatibility)
 */
export const APPROVAL_REQUIRED_ROOM_TYPES = [
  ROOM_TYPES.AUDITORIUM,
  ROOM_TYPES.CONFERENCE_HALL,
  ROOM_TYPES.CONFERENCE_ROOM,
] as const;

/**
 * Room names that require admin approval (configurable)
 * Update this list as needed or load from DB/config file in future
 */
export const APPROVAL_REQUIRED_ROOM_NAMES = [
  "Auditorium",
  "Room 003 - Building B",
  "Room 004 - Admin Building",
  "Room 009 - Main Building",
  "Room 010 - Main Building",
  "Hall 1",
  "Hall 2",
  "Hall 3",
  "Room 018 - AB2",
  "Room 023 - AB3",
  "Room 025 - AB2"
] as const;

/**
 * =============================================================================
 * PostgreSQL Error Codes
 * =============================================================================
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 * =============================================================================
 */

export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01', // CRITICAL: tsrange overlap error
  NOT_NULL_VIOLATION: '23502',
} as const;

/**
 * =============================================================================
 * Time Constants (in milliseconds)
 * =============================================================================
 */

export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * =============================================================================
 * Cache Keys and TTL
 * =============================================================================
 */

export const CACHE = {
  KEYS: {
    ROOM_AVAILABILITY: 'room:availability:',
    USER_QUOTA: 'user:quota:',
    ROOM_DETAILS: 'room:details:',
    DEPARTMENT: 'department:',
  },
  TTL: {
    AVAILABILITY: 60, // 1 minute
    QUOTA: 300, // 5 minutes
    ROOM_DETAILS: 3600, // 1 hour
    DEPARTMENT: 86400, // 24 hours
  },
} as const;
