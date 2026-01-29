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
 * =============================================================================
 * ADMIN ROUTES
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

export default router;

