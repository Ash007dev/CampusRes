/**
 * =============================================================================
 * Campus Resource Engine - Booking Routes
 * =============================================================================
 * Route definitions for booking endpoints
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import { bookingController } from '../controllers/bookingController.js';
import {
  authenticate,
  authorize,
  validate,
  bookingRateLimiter,
} from '../middleware/index.js';
import {
  createBookingSchema,
  createRecurringBookingSchema,
  bookingQuerySchema,
  cancelBookingSchema,
  availabilityQuerySchema,
  checkInSchema,
  approveBookingSchema,
} from '../utils/validators.js';

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBooking'
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       409:
 *         description: Booking conflict
 */
router.post(
  '/',
  authenticate,
  bookingRateLimiter,
  validate(createBookingSchema, 'body'),
  bookingController.create
);

/**
 * @openapi
 * /api/v1/bookings/recurring:
 *   post:
 *     summary: Create recurring bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/recurring',
  authenticate,
  bookingRateLimiter,
  validate(createRecurringBookingSchema, 'body'),
  bookingController.createRecurring
);

/**
 * @openapi
 * /api/v1/bookings/my:
 *   get:
 *     summary: Get current user's bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/my',
  authenticate,
  validate(bookingQuerySchema, 'query'),
  bookingController.getMyBookings
);

/**
 * @openapi
 * /api/v1/bookings/calendar:
 *   get:
 *     summary: Get all bookings for calendar view
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/calendar',
  authenticate,
  bookingController.getCalendarBookings
);

/**
 * @openapi
 * /api/v1/bookings/availability:
 *   get:
 *     summary: Get room availability for a date
 *     tags: [Bookings]
 */
router.get(
  '/availability',
  validate(availabilityQuerySchema, 'query'),
  bookingController.getAvailability
);

/**
 * @openapi
 * /api/v1/bookings/suggestions:
 *   get:
 *     summary: Get alternative time slots and rooms (US 2)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: attendeeCount
 *         schema:
 *           type: integer
 *           default: 1
 */
router.get(
  '/suggestions',
  authenticate,
  bookingController.getSuggestions
);

/**
 * @openapi
 * /api/v1/bookings/quick-book-suggestions:
 *   get:
 *     summary: Get one-tap booking suggestions from recurring patterns (US 6)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 60
 *         description: Days of history to analyze
 */
router.get(
  '/quick-book-suggestions',
  authenticate,
  bookingController.getQuickBookSuggestions
);

/**
 * @openapi
 * /api/v1/bookings/room-recommend:
 *   get:
 *     summary: Recommend the smallest suitable room (US 7)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: attendeeCount
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: amenities
 *         schema:
 *           type: string
 *         description: Comma-separated list of required amenities
 */
router.get(
  '/room-recommend',
  authenticate,
  bookingController.recommendRoom
);

/**
 * @openapi
 * /api/v1/bookings/balanced-room:
 *   get:
 *     summary: Get load-balanced room suggestion (US 8)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: attendeeCount
 *         schema:
 *           type: integer
 *           default: 1
 */
router.get(
  '/balanced-room',
  authenticate,
  bookingController.getBalancedRoom
);

/**
 * =============================================================================
 * ADMIN ROUTES - Must be before /:id to avoid matching as ID
 * =============================================================================
 */

/**
 * @openapi
 * /api/v1/bookings/pending-approvals:
 *   get:
 *     summary: Get bookings pending approval (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/pending-approvals',
  authenticate,
  authorize(['ADMIN', 'LAB_ADMIN']),
  bookingController.getPendingApprovals
);

/**
 * @openapi
 * /api/v1/bookings/all:
 *   get:
 *     summary: Get all bookings (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/all',
  authenticate,
  authorize(['ADMIN']),
  validate(bookingQuerySchema, 'query'),
  bookingController.getAllBookings
);

/**
 * @openapi
 * /api/v1/bookings/export:
 *   get:
 *     summary: Export bookings as CSV (Admin only) - US 5.6
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get(
  '/export',
  authenticate,
  authorize(['ADMIN']),
  bookingController.exportBookings
);

/**
 * @openapi
 * /api/v1/bookings/import-timetable:
 *   post:
 *     summary: Bulk import timetable (Admin only) - US 5.3
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     roomCode:
 *                       type: string
 *                       description: Room code (e.g., "LAB-001")
 *                     dayOfWeek:
 *                       type: number
 *                       description: 0=Sunday, 1=Monday, etc.
 *                     startTime:
 *                       type: string
 *                       description: Start time in HH:mm format
 *                     endTime:
 *                       type: string
 *                       description: End time in HH:mm format
 *                     title:
 *                       type: string
 *                       description: Class/event title
 *                     description:
 *                       type: string
 *                     weeks:
 *                       type: number
 *                       description: Number of weeks to create bookings for
 *     responses:
 *       200:
 *         description: Import results with created count and errors
 */
router.post(
  '/import-timetable',
  authenticate,
  authorize(['ADMIN']),
  bookingController.importTimetable
);

/**
 * @openapi
 * /api/v1/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:id',
  authenticate,
  bookingController.getById
);

/**
 * @openapi
 * /api/v1/bookings/{id}:
 *   delete:
 *     summary: Cancel a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  authenticate,
  validate(cancelBookingSchema, 'body'),
  bookingController.cancel
);

/**
 * @openapi
 * /api/v1/bookings/{id}/check-in:
 *   post:
 *     summary: Check in to a booking via QR code
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/check-in',
  authenticate,
  validate(checkInSchema, 'body'),
  bookingController.checkIn
);

/**
 * @openapi
 * /api/v1/bookings/{id}/approve:
 *   post:
 *     summary: Approve or reject a booking (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/approve',
  authenticate,
  authorize(['ADMIN', 'LAB_ADMIN']),
  validate(approveBookingSchema, 'body'),
  bookingController.approve
);

/**
 * @openapi
 * /api/v1/bookings/{id}/early-checkout:
 *   post:
 *     summary: Early checkout from a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/early-checkout',
  authenticate,
  bookingController.earlyCheckout
);

/**
 * @openapi
 * /api/v1/bookings/{id}/extend:
 *   post:
 *     summary: Extend a booking by additional minutes
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/extend',
  authenticate,
  bookingController.extendBooking
);

/**
 * @openapi
 * /api/v1/bookings/{id}/reschedule:
 *   put:
 *     summary: Reschedule a booking to a new time (US 1.7)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startTime, endTime]
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 */
router.put(
  '/:id/reschedule',
  authenticate,
  bookingController.reschedule
);

/**
 * @openapi
 * /api/v1/bookings/{id}/running-late:
 *   post:
 *     summary: Mark booking as running late (US 3)
 *     description: Extends the check-in grace period by an additional 15 minutes
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/running-late',
  authenticate,
  bookingController.runningLate
);

export default router;

