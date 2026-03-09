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
import { suggestionService } from '../services/suggestionService.js';
import { bookingPatternService } from '../services/bookingPatternService.js';
import { roomRecommendationService } from '../services/roomRecommendationService.js';
import { loadBalancingService } from '../services/loadBalancingService.js';
import { asyncHandler, type AuthenticatedRequest } from '../middleware/index.js';
import { HTTP_STATUS } from '../config/constants.js';
import { logger } from '../config/logger.js';
import { supabase } from '../lib/supabase.js';
import { istToUtc } from '../utils/dateUtils.js';
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
      data: bookingController.formatBookingResponse(booking),
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
      data: bookings.map(bookingController.formatBookingResponse),
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
      data: bookingController.formatBookingResponse(booking),
    });
  }),

  /**
   * Helper to format booking timestamps with 'Z' suffix for UTC
   */
  formatBookingResponse: (booking: any) => {
    if (!booking) return booking;

    // Ensure all timestamp fields have 'Z' suffix for UTC
    const formatTimestamp = (timestamp: string | null) => {
      if (!timestamp) return timestamp;
      // If timestamp doesn't end with 'Z', add it
      return timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`;
    };

    return {
      ...booking,
      startTime: formatTimestamp(booking.start_time || booking.startTime),
      endTime: formatTimestamp(booking.end_time || booking.endTime),
      createdAt: formatTimestamp(booking.created_at || booking.createdAt),
      updatedAt: formatTimestamp(booking.updated_at || booking.updatedAt),
      checkedInAt: formatTimestamp(booking.checked_in_at || booking.checkedInAt),
      cancelledAt: formatTimestamp(booking.cancelled_at || booking.cancelledAt),
    };
  },

  /**
   * Get current user's bookings
   * GET /api/v1/bookings/my
   */
  getMyBookings: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const query = req.query as unknown as BookingQueryInput;

    const result = await bookingService.getUserBookings(authReq.user.userId, {
      status: query.status as any,
      startDate: query.startDate ? istToUtc(query.startDate as unknown as string) : undefined,
      endDate: query.endDate ? istToUtc(query.endDate as unknown as string) : undefined,
      page: query.page,
      limit: query.limit,
    });

    // Format all booking timestamps
    const formattedBookings = result.bookings.map(bookingController.formatBookingResponse);

    res.json({
      success: true,
      data: formattedBookings,
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
      data: bookingController.formatBookingResponse(booking),
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
      data: bookingController.formatBookingResponse(booking),
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
      data: bookingController.formatBookingResponse(booking),
      message: approved ? 'Booking approved successfully' : 'Booking rejected',
    });
  }),

  /**
   * Get pending approvals (Admin only)
   * GET /api/v1/bookings/pending-approvals
   */
  getPendingApprovals: asyncHandler(async (req, res: Response) => {
    const bookings = await bookingService.getPendingApprovals();
    const formattedBookings = bookings.map(bookingController.formatBookingResponse);

    res.json({
      success: true,
      data: formattedBookings,
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
      startDate: query.startDate ? istToUtc(query.startDate as unknown as string) : undefined,
      endDate: query.endDate ? istToUtc(query.endDate as unknown as string) : undefined,
      page: query.page,
      limit: query.limit,
    });

    const formattedBookings = result.bookings.map(bookingController.formatBookingResponse);

    res.json({
      success: true,
      data: formattedBookings,
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
      data: bookingController.formatBookingResponse(booking),
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
      data: bookingController.formatBookingResponse(booking),
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
      startTime,
      endTime
    );

    res.json({
      success: true,
      data: bookingController.formatBookingResponse(booking),
      message: 'Booking rescheduled successfully',
    });
  }),

  /**
   * Get all bookings for calendar view (all users can see room bookings)
   * GET /api/v1/bookings/calendar
   */
  getCalendarBookings: asyncHandler(async (req, res: Response) => {
    const query = req.query as { startDate?: string; endDate?: string };

    const result = await bookingService.getAllBookings({
      startDate: query.startDate ? istToUtc(query.startDate) : undefined,
      endDate: query.endDate ? istToUtc(query.endDate) : undefined,
      page: 1,
      limit: 500, // Get more bookings for calendar view
    });

    // Return ALL bookings (including CANCELLED/NO_SHOW) — frontend renders them with strikeout
    const formattedBookings = result.bookings.map(bookingController.formatBookingResponse);

    res.json({
      success: true,
      data: formattedBookings,
      meta: {
        total: result.total,
      },
    });
  }),

  /**
   * Export bookings as CSV (Admin only) - US 5.6
   * GET /api/v1/bookings/export
   */
  exportBookings: asyncHandler(async (req, res: Response) => {
    const query = req.query as { startDate?: string; endDate?: string; format?: string };

    const result = await bookingService.getAllBookings({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: 1,
      limit: 10000, // Get all bookings for export
    });

    // Generate CSV
    const headers = [
      'Booking ID',
      'Room Name',
      'Room Code',
      'User Email',
      'User Name',
      'Start Time',
      'End Time',
      'Duration (hours)',
      'Status',
      'Check-in Status',
      'Credits Charged',
      'Created At',
    ];

    const rows = result.bookings.map((b: any) => [
      b.id,
      b.rooms?.name || '',
      b.rooms?.code || '',
      b.users?.email || '',
      `${b.users?.first_name || ''} ${b.users?.last_name || ''}`.trim(),
      b.start_time,
      b.end_time,
      ((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / (1000 * 60 * 60)).toFixed(2),
      b.status,
      b.check_in_status,
      b.credits_charged,
      b.created_at,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: string[]) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  }),

  /**
   * Get alternative booking suggestions when a slot is unavailable
   * GET /api/v1/bookings/suggestions
   */
  getSuggestions: asyncHandler(async (req, res: Response) => {
    const { roomId, startTime, endTime, attendeeCount } = req.query as {
      roomId: string;
      startTime: string;
      endTime: string;
      attendeeCount?: string;
    };

    if (!roomId || !startTime || !endTime) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'roomId, startTime, and endTime are required query parameters' },
      });
      return;
    }

    const suggestions = await suggestionService.getAlternativeSuggestions(
      roomId,
      startTime,
      endTime,
      attendeeCount ? parseInt(attendeeCount) : 1
    );

    res.json({
      success: true,
      data: suggestions,
    });
  }),

  /**
   * Get quick-book suggestions based on recurring patterns (US 6)
   * GET /api/v1/bookings/quick-book-suggestions
   */
  getQuickBookSuggestions: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const days = req.query.days ? parseInt(req.query.days as string) : 60;

    const result = await bookingPatternService.getQuickBookSuggestions(
      authReq.user.userId,
      days
    );

    res.json({
      success: true,
      data: result,
    });
  }),

  /**
   * Get AI-powered room recommendation
   * GET /api/v1/bookings/recommend-room
   */
  recommendRoom: asyncHandler(async (req, res: Response) => {
    const { attendeeCount, startTime, endTime, amenities } = req.query as {
      attendeeCount: string;
      startTime: string;
      endTime: string;
      amenities?: string;
    };

    if (!attendeeCount || !startTime || !endTime) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'attendeeCount, startTime, and endTime are required' },
      });
      return;
    }

    const requiredAmenities = amenities ? amenities.split(',').map(a => a.trim()) : [];

    const result = await roomRecommendationService.recommendRoom(
      parseInt(attendeeCount),
      startTime,
      endTime,
      requiredAmenities
    );

    res.json({
      success: true,
      data: result,
    });
  }),

  /**
   * Get load-balanced room suggestion
   * GET /api/v1/bookings/balanced-room
   */
  getBalancedRoom: asyncHandler(async (req, res: Response) => {
    const { roomId, startTime, endTime, attendeeCount } = req.query as {
      roomId: string;
      startTime: string;
      endTime: string;
      attendeeCount?: string;
    };

    if (!roomId || !startTime || !endTime) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'roomId, startTime, and endTime are required' },
      });
      return;
    }

    const result = await loadBalancingService.getBalancedRoom(
      roomId,
      startTime,
      endTime,
      attendeeCount ? parseInt(attendeeCount) : 1
    );

    res.json({
      success: true,
      data: result,
    });
  }),

  /**
   * Bulk import timetable (Admin only) - US 5.3
   * POST /api/v1/bookings/import-timetable
   */
  importTimetable: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { entries } = req.body as {
      entries: Array<{
        roomCode: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        title: string;
        description?: string;
        weeks: number;
      }>;
    };

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Please provide a valid array of timetable entries',
      });
      return;
    }

    const result = await bookingService.bulkImportTimetable(entries, authReq.user.userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        created: result.created,
        errors: result.errors,
      },
      message: `Successfully created ${result.created} bookings${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`,
    });
  }),

  /**
   * Mark a booking as "Running Late" (US 3)
   * POST /api/v1/bookings/:id/running-late
   */
  runningLate: asyncHandler(async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const booking = await bookingService.markRunningLate(id, authReq.user.userId);

    res.json({
      success: true,
      data: bookingController.formatBookingResponse(booking),
      message: 'Booking marked as running late. You have an additional 15 minutes to check in.',
    });
  }),

  /**
   * Get emergency overrides for calendar display (all authenticated users)
   * GET /api/v1/bookings/emergency-overrides
   */
  getEmergencyOverrides: asyncHandler(async (req, res: Response) => {
    const { startDate, endDate } = req.query;

    let query = supabase
      .from('emergency_overrides')
      .select('*, emergency_override_rooms(room_id, rooms:room_id(id, name))')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('end_time', startDate as string);
    }
    if (endDate) {
      query = query.lte('start_time', endDate as string);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, 'Failed to fetch emergency overrides');
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: { message: 'Failed to fetch emergency overrides' },
      });
      return;
    }

    res.json({
      success: true,
      data: data || [],
    });
  }),
};
