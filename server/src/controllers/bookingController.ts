/**
 * =============================================================================
 * Campus Resource Engine - Booking Controller
 * =============================================================================
 * HTTP request handlers for booking endpoints
 * Controllers are thin - they delegate to services
 * =============================================================================
 */

import { Response, NextFunction } from 'express';
import { bookingService } from '../services/bookingService.js';
import { asyncHandler, type AuthenticatedRequest } from '../middleware/index.js';
import { HTTP_STATUS } from '../config/constants.js';
import { logger } from '../config/logger.js';
import type {
  CreateBookingInput,
  CreateRecurringBookingInput,
  BookingQueryInput
} from '../utils/validators.js';

/**
 * =============================================================================
 * BOOKING CONTROLLER
 * =============================================================================
 */
export const bookingController = {
  /**
   * Create a new booking
   * POST /api/v1/bookings
   */
  create: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const input = req.body as CreateBookingInput;

    const booking = await bookingService.createBooking(
      authReq.user.userId,
      authReq.user.departmentId || undefined,
      input
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: booking,
      message: booking.status === 'PENDING_APPROVAL'
        ? 'Booking submitted for approval'
        : 'Booking confirmed successfully',
    });
  }),

  /**
   * Create recurring bookings
   * POST /api/v1/bookings/recurring
   */
  createRecurring: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const input = req.body as CreateRecurringBookingInput;

    const bookings = await bookingService.createRecurringBooking(
      authReq.user.userId,
      authReq.user.departmentId || undefined,
      input
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: bookings,
      message: `Created ${bookings.length} recurring bookings`,
    });
  }),

  /**
   * Get booking by ID
   * GET /api/v1/bookings/:id
   */
  getById: asyncHandler(async (req, res: Response) => {
    const { id } = req.params;

    const booking = await bookingService.getBookingById(id);

    if (!booking) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: { message: 'Booking not found', code: 'BOOKING_2005' },
      });
      return;
    }

    res.json({
      success: true,
      data: booking,
    });
  }),

  /**
   * Get current user's bookings
   * GET /api/v1/bookings/my
   */
  getMyBookings: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const query = req.query as unknown as BookingQueryInput;

    const result = await bookingService.getUserBookings(authReq.user.userId, {
      status: query.status as any,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: query.page,
      limit: query.limit,
    });

    res.json({
      success: true,
      data: result.bookings,
      meta: {
        total: result.total,
        page: query.page || 1,
        limit: query.limit || 20,
        totalPages: Math.ceil(result.total / (query.limit || 20)),
      },
    });
  }),

  /**
   * Cancel a booking
   * DELETE /api/v1/bookings/:id
   */
  cancel: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await bookingService.cancelBooking(
      id,
      authReq.user.userId,
      reason
    );

    res.json({
      success: true,
      data: booking,
      message: 'Booking cancelled successfully',
    });
  }),

  /**
   * Get room availability for a date
   * GET /api/v1/bookings/availability
   */
  getAvailability: asyncHandler(async (req, res: Response) => {
    const { roomId, date } = req.query as { roomId: string; date: string };

    const availability = await bookingService.getRoomAvailability(roomId, date);

    res.json({
      success: true,
      data: availability,
    });
  }),

  /**
   * Check in to a booking
   * POST /api/v1/bookings/:id/check-in
   */
  checkIn: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { qrCode, latitude, longitude } = req.body;

    const booking = await bookingService.checkIn(
      id,
      authReq.user.userId,
      qrCode,
      latitude,
      longitude
    );

    res.json({
      success: true,
      data: booking,
      message: 'Successfully checked in to booking',
    });
  }),

  /**
   * Approve or reject a booking (Admin only)
   * POST /api/v1/bookings/:id/approve
   */
  approve: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { approved, reason } = req.body;

    const booking = await bookingService.approveBooking(
      id,
      authReq.user.userId,
      approved,
      reason
    );

    res.json({
      success: true,
      data: booking,
      message: approved ? 'Booking approved successfully' : 'Booking rejected',
    });
  }),

  /**
   * Get pending approvals (Admin only)
   * GET /api/v1/bookings/pending-approvals
   */
  getPendingApprovals: asyncHandler(async (req, res: Response) => {
    const bookings = await bookingService.getPendingApprovals();

    res.json({
      success: true,
      data: bookings,
    });
  }),

  /**
   * Get all bookings (Admin only)
   * GET /api/v1/bookings/all
   */
  getAllBookings: asyncHandler(async (req, res: Response) => {
    const query = req.query as unknown as BookingQueryInput;

    const result = await bookingService.getAllBookings({
      status: query.status as any,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: query.page,
      limit: query.limit,
    });

    res.json({
      success: true,
      data: result.bookings,
      meta: {
        total: result.total,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(result.total / (query.limit || 50)),
      },
    });
  }),

  /**
   * Early checkout from a booking
   * POST /api/v1/bookings/:id/early-checkout
   */
  earlyCheckout: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const booking = await bookingService.earlyCheckout(id, authReq.user.userId);

    res.json({
      success: true,
      data: booking,
      message: 'Successfully checked out early',
    });
  }),

  /**
   * Extend a booking
   * POST /api/v1/bookings/:id/extend
   */
  extendBooking: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { additionalMinutes } = req.body;

    const booking = await bookingService.extendBooking(
      id,
      authReq.user.userId,
      additionalMinutes
    );

    res.json({
      success: true,
      data: booking,
      message: `Booking extended by ${additionalMinutes} minutes`,
    });
  }),

  /**
   * Reschedule a booking (US 1.7)
   * PUT /api/v1/bookings/:id/reschedule
   */
  reschedule: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      res.status(400).json({
        success: false,
        error: { message: 'startTime and endTime are required', code: 'BOOKING_4001' },
      });
      return;
    }

    const booking = await bookingService.rescheduleBooking(
      id,
      authReq.user.userId,
      new Date(startTime),
      new Date(endTime)
    );

    res.json({
      success: true,
      data: booking,
      message: 'Booking rescheduled successfully',
    });
  }),
};
