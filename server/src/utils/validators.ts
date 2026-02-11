/**
 * =============================================================================
 * Campus Resource Engine - Zod Validation Schemas
 * =============================================================================
 * Centralized validation schemas using Zod for type-safe runtime validation
 * 
 * PATTERN: Each entity has corresponding schemas for:
 * - Create (input validation for POST requests)
 * - Update (partial input validation for PATCH requests)
 * - Query (query parameter validation)
 * - Response (output transformation)
 * =============================================================================
 */

import { z } from 'zod';
import { BOOKING_STATUS, USER_ROLES, ROOM_TYPES } from '../config/constants.js';

/**
 * =============================================================================
 * Common Schemas
 * =============================================================================
 */

export const idSchema = z.string().min(1);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateTimeSchema = z.coerce.date();

/**
 * ISO 8601 datetime string validation
 */
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/**
 * =============================================================================
 * User Schemas
 * =============================================================================
 */

export const userRoleSchema = z.enum([
  USER_ROLES.STUDENT,
  USER_ROLES.FACULTY,
  USER_ROLES.LAB_ADMIN,
  USER_ROLES.ADMIN,
]);

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  departmentId: z.string().min(1).optional(),
  departmentCode: z.string().min(1).optional(),
  role: userRoleSchema.optional().default(USER_ROLES.STUDENT),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

/**
 * =============================================================================
 * Room Schemas
 * =============================================================================
 */

export const roomTypeSchema = z.enum([
  ROOM_TYPES.CLASSROOM,
  ROOM_TYPES.LAB,
  ROOM_TYPES.AUDITORIUM,
  ROOM_TYPES.MEETING_ROOM,
  ROOM_TYPES.CONFERENCE_HALL,
]);

export const amenitiesSchema = z.object({
  projector: z.boolean().optional(),
  ac: z.boolean().optional(),
  whiteboard: z.boolean().optional(),
  videoConference: z.boolean().optional(),
  smartBoard: z.boolean().optional(),
  soundSystem: z.boolean().optional(),
  recordingEquipment: z.boolean().optional(),
  wheelchairAccessible: z.boolean().optional(),
}).passthrough(); // Allow additional amenities

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  capacity: z.number().int().min(1).max(1000),
  floor: z.number().int().default(1),
  building: z.string().max(100).default('Main'),
  amenities: amenitiesSchema.optional().default({}),
  roomType: roomTypeSchema.optional().default(ROOM_TYPES.CLASSROOM),
  departmentId: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const roomQuerySchema = z.object({
  ...paginationSchema.shape,
  departmentId: z.string().min(1).optional(),
  minCapacity: z.coerce.number().int().min(1).optional(),
  maxCapacity: z.coerce.number().int().optional(),
  roomType: roomTypeSchema.optional(),
  amenities: z.string().optional(), // Comma-separated list of amenities
  building: z.string().optional(),
  includeMaintenace: z.coerce.boolean().optional().default(false),
});

/**
 * =============================================================================
 * Booking Schemas
 * =============================================================================
 */

export const bookingStatusSchema = z.enum([
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.PENDING_APPROVAL,
  BOOKING_STATUS.NO_SHOW,
]);

// Base booking fields without refinements
const bookingBaseFields = {
  roomId: z.string().min(1),
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema,
  title: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  attendeeCount: z.number().int().min(1).optional().default(1),
  // Guest booking fields (for booking on behalf of guests)
  guestName: z.string().max(100).optional(),
  guestPhone: z.string().max(20).optional(),
};

// Refinement functions
const bookingTimeRefinements = <T extends { startTime: string; endTime: string }>(schema: z.ZodType<T>) =>
  schema.refine(
    (data) => new Date(data.startTime) < new Date(data.endTime),
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  ).refine(
    (data) => new Date(data.startTime) > new Date(),
    {
      message: 'Booking must be in the future',
      path: ['startTime'],
    }
  );

export const createBookingSchema = bookingTimeRefinements(z.object(bookingBaseFields));

export const createRecurringBookingSchema = bookingTimeRefinements(
  z.object({
    ...bookingBaseFields,
    recurring: z.object({
      pattern: z.enum(['weekly']), // Can extend to 'daily', 'biweekly' etc.
      weeks: z.number().int().min(1).max(10), // Max 10 weeks as per spec
    }),
  })
);

export const updateBookingSchema = z.object({
  title: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  attendeeCount: z.number().int().min(1).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const bookingQuerySchema = z.object({
  ...paginationSchema.shape,
  roomId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  status: bookingStatusSchema.optional(),
  startDate: isoDateTimeSchema.optional(),
  endDate: isoDateTimeSchema.optional(),
  includeRecurring: z.coerce.boolean().optional().default(true),
});

/**
 * =============================================================================
 * Check-in Schemas
 * =============================================================================
 */

export const checkInSchema = z.object({
  bookingId: z.string().min(1).optional(), // Optional - comes from URL params
  qrCode: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * =============================================================================
 * Availability Query Schemas
 * =============================================================================
 */

export const availabilityQuerySchema = z.object({
  roomId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  duration: z.coerce.number().int().min(30).max(480).optional(), // Duration in minutes
});

export const weeklyAvailabilityQuerySchema = z.object({
  roomId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

/**
 * =============================================================================
 * Waitlist Schemas
 * =============================================================================
 */

export const createWaitlistSchema = z.object({
  roomId: z.string().min(1),
  desiredStartTime: isoDateTimeSchema,
  desiredEndTime: isoDateTimeSchema,
});

/**
 * =============================================================================
 * Department Schemas
 * =============================================================================
 */

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(10).toUpperCase(),
  headUserId: z.string().min(1).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

/**
 * =============================================================================
 * Admin Schemas
 * =============================================================================
 */

export const approveBookingSchema = z.object({
  bookingId: z.string().min(1),
  approved: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const bulkImportRowSchema = z.object({
  roomCode: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  userEmail: z.string().email(),
  title: z.string().optional(),
});

export const bulkImportSchema = z.array(bulkImportRowSchema);

/**
 * =============================================================================
 * Type Exports (inferred from schemas)
 * =============================================================================
 */

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type RoomQueryInput = z.infer<typeof roomQuerySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateRecurringBookingInput = z.infer<typeof createRecurringBookingSchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
export type CreateWaitlistInput = z.infer<typeof createWaitlistSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type ApproveBookingInput = z.infer<typeof approveBookingSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
