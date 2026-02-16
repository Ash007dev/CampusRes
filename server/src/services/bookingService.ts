/**
 * =============================================================================
 * Campus Resource Engine - Booking Service
 * =============================================================================
 * Core booking logic using Supabase
 * Table: bookings (snake_case columns)
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { configService } from './configService.js';
import { config } from '../config/index.js';
import { emitBookingUpdate, emitRoomUpdate, sendNotification } from '../lib/socket.js';
import { waitlistService } from './waitlistService.js';
import { getCurrentIST, getISTHour, getISTStartOfDay, isISTPeakHour, istToUtc, parseDbDate } from '../utils/dateUtils.js';
import {
  BOOKING_STATUS,
  APPROVAL_REQUIRED_ROOM_TYPES,
  PG_ERROR_CODES,
  TIME,
  CACHE,
  USER_ROLES,
} from '../config/constants.js';
import {
  BookingConflictError,
  QuotaExceededError,
  DepartmentRestrictionError,
  BookingNotFoundError,
  RoomNotFoundError,
  RoomMaintenanceError,
  InvalidTimeRangeError,
  InsufficientCreditsError,
  RecurringBookingConflictError,
  AppError,
} from '../utils/errors.js';
import { getCache, setCache, deleteCache } from '../lib/redis.js';
import { emailService } from './emailService.js';
import type { CreateBookingInput, CreateRecurringBookingInput } from '../utils/validators.js';

interface BookingWithRelations {
  id: string;
  user_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  title: string;
  description?: string;
  attendee_count: number;
  status: string;
  check_in_status: string;
  credits_charged: number;
  is_peak_hours: boolean;
  rooms: any;
  users: any;
}

export class BookingService {
  async createBooking(
    userId: string,
    userDepartmentId: string | null | undefined,
    input: CreateBookingInput
  ): Promise<any> {
    const startTime = istToUtc(input.startTime);
    const endTime = istToUtc(input.endTime);

    logger.info({
      userId,
      roomId: input.roomId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }, 'Creating booking');

    await this.validateTimeRange(startTime, endTime);

    try {
      // US 4.5: Check if user is blocked (blacklisted)
      const { data: userStatus } = await supabase
        .from('users')
        .select('is_active, blocked_until, no_show_count')
        .eq('id', userId)
        .single();

      if (userStatus?.blocked_until && new Date(userStatus.blocked_until) > new Date()) {
        const blockedUntilDate = new Date(userStatus.blocked_until).toLocaleDateString();
        throw new AppError(
          `Your account is suspended until ${blockedUntilDate} due to repeated no-shows. Please contact admin.`,
          403
        );
      }

      if (!userStatus?.is_active) {
        throw new AppError('Your account is deactivated. Please contact admin.', 403);
      }

      // US 5.5: Check if booking date is a holiday
      const bookingDate = startTime.toISOString().split('T')[0];
      const { data: holiday } = await supabase
        .from('holidays')
        .select('name, type')
        .eq('date', bookingDate)
        .single();

      if (holiday) {
        throw new AppError(
          `Cannot book on ${bookingDate}: ${holiday.name} (${holiday.type})`,
          400
        );
      }

      // Check room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id, name, code, capacity, department_id, is_maintenance, is_active, room_type, amenities')
        .eq('id', input.roomId)
        .single();

      if (roomError || !room) {
        throw new RoomNotFoundError(input.roomId);
      }

      if (!room.is_active || room.is_maintenance) {
        throw new RoomMaintenanceError(room.name);
      }

      // Check department restrictions
      await this.checkDepartmentRestrictions(userDepartmentId, room.department_id, startTime);

      // Check weekly quota
      await this.checkWeeklyQuota(userId, startTime, endTime);

      // Calculate credits
      const { creditsRequired, isPeakHours } = this.calculateCredits(startTime, endTime);

      // Check user credits
      const { data: user } = await supabase
        .from('users')
        .select('credits_balance, role')
        .eq('id', userId)
        .single();

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.credits_balance < creditsRequired) {
        throw new InsufficientCreditsError(
          `This booking requires ${creditsRequired} credits, but you only have ${user.credits_balance}`,
          { required: creditsRequired, available: user.credits_balance }
        );
      }

      // Check for conflicts
      const { data: conflicts } = await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', input.roomId)
        .not('status', 'in', '("CANCELLED","NO_SHOW")')
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString());

      if (conflicts && conflicts.length > 0) {
        // US 2.3: Find alternative slots
        const alternatives = await this.findAlternativeSlots(input.roomId, startTime, endTime);
        throw new BookingConflictError(
          'This time slot is already booked',
          { alternatives }
        );
      }

      // Determine status (US 4.2 & 4.3)
      // Admins bypass approval. 
      // Students ALWAYS need approval now as per user request.
      // Faculty need approval for specific rooms.
      const requiresApproval = user.role === USER_ROLES.STUDENT || (user.role === USER_ROLES.FACULTY && APPROVAL_REQUIRED_ROOM_TYPES.includes(
        room.room_type as typeof APPROVAL_REQUIRED_ROOM_TYPES[number]
      ));
      const initialStatus = requiresApproval ? BOOKING_STATUS.PENDING_APPROVAL : BOOKING_STATUS.CONFIRMED;

      // Create booking
      const now = new Date().toISOString();
      const bookingId = crypto.randomUUID();
      const { data: newBooking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          user_id: userId,
          room_id: input.roomId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          title: input.title,
          description: input.description,
          attendee_count: input.attendeeCount,
          status: initialStatus,
          check_in_status: 'PENDING',
          credits_charged: creditsRequired,
          is_peak_hours: isPeakHours,
          created_at: now,
          updated_at: now,
          metadata: (input.guestName || input.guestPhone) ? {
            guestName: input.guestName,
            guestPhone: input.guestPhone,
            bookedBy: userId
          } : undefined
        })
        .select()
        .single();

      if (bookingError || !newBooking) {
        logger.error({
          bookingError,
          errorMessage: bookingError?.message,
          errorCode: bookingError?.code,
          errorDetails: bookingError?.details,
          errorHint: bookingError?.hint,
        }, 'Failed to create booking');
        throw new AppError('Failed to create booking', 500);
      }

      // Deduct credits
      if (creditsRequired > 0) {
        await supabase
          .from('users')
          .update({ credits_balance: user.credits_balance - creditsRequired })
          .eq('id', userId);
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'CREATE',
        entity_type: 'booking',
        entity_id: newBooking.id,
        performed_by_id: userId,
        new_state: {
          room_id: newBooking.room_id,
          start_time: newBooking.start_time,
          end_time: newBooking.end_time,
          status: newBooking.status,
        },
      });

      await this.invalidateAvailabilityCache(input.roomId, startTime);

      logger.info({ bookingId: newBooking.id, status: newBooking.status }, 'Booking created successfully');

      // Emit real-time updates for live occupancy (US 3.3)
      emitBookingUpdate({
        type: 'CREATED',
        bookingId: newBooking.id,
        roomId: room.id,
        roomName: room.name,
        startTime: newBooking.start_time,
        endTime: newBooking.end_time,
        userId,
      });
      emitRoomUpdate({
        type: 'OCCUPIED',
        roomId: room.id,
        roomName: room.name,
      });

      return { ...newBooking, room, user: { id: userId, department_id: userDepartmentId } };

    } catch (error) {
      if (this.isExclusionViolation(error)) {
        throw new BookingConflictError('This time slot was just booked by another user.');
      }
      throw error;
    }
  }

  async createRecurringBooking(
    userId: string,
    userDepartmentId: string | null | undefined,
    input: CreateRecurringBookingInput
  ): Promise<any[]> {
    const baseStartTime = new Date(input.startTime);
    const baseEndTime = new Date(input.endTime);
    const weeks = input.recurring.weeks;

    logger.info({ userId, roomId: input.roomId, weeks }, 'Creating recurring booking');

    const bookingDates: Array<{ startTime: Date; endTime: Date }> = [];
    for (let i = 0; i < weeks; i++) {
      bookingDates.push({
        startTime: new Date(baseStartTime.getTime() + i * TIME.WEEK),
        endTime: new Date(baseEndTime.getTime() + i * TIME.WEEK),
      });
    }

    const recurringGroupId = crypto.randomUUID();
    const createdBookings: any[] = [];

    // Get user and room info to determine if approval is needed
    const { data: user } = await supabase.from('users').select('role').eq('id', userId).single();
    const { data: room } = await supabase.from('rooms').select('room_type').eq('id', input.roomId).single();

    const requiresApproval = user?.role === USER_ROLES.STUDENT || (user?.role === USER_ROLES.FACULTY && APPROVAL_REQUIRED_ROOM_TYPES.includes(
      room?.room_type as any
    ));
    const initialStatus = requiresApproval ? BOOKING_STATUS.PENDING_APPROVAL : BOOKING_STATUS.CONFIRMED;

    for (const dates of bookingDates) {
      const { data: booking, error } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          room_id: input.roomId,
          start_time: dates.startTime.toISOString(),
          end_time: dates.endTime.toISOString(),
          title: input.title,
          description: input.description,
          attendee_count: input.attendeeCount,
          status: initialStatus,
          check_in_status: 'PENDING',
          is_recurring: true,
          recurring_group_id: recurringGroupId,
        })
        .select()
        .single();

      if (!error && booking) {
        createdBookings.push(booking);
      }
    }

    logger.info({ recurringGroupId, count: createdBookings.length }, 'Recurring bookings created');

    return createdBookings;
  }

  async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<any> {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, rooms(*)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingNotFoundError(bookingId);
    }

    // Check if performer is admin or owner
    const { data: performer } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    const isAdmin = performer?.role === USER_ROLES.ADMIN || performer?.role === USER_ROLES.LAB_ADMIN;

    if (booking.user_id !== userId && !isAdmin) {
      throw new AppError('You can only cancel your own bookings', 403);
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError('Booking is already cancelled', 400);
    }

    if (parseDbDate(booking.start_time) < new Date()) {
      throw new AppError('Cannot cancel past bookings', 400);
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: reason,
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new AppError('Failed to cancel booking', 500);
    }

    // Refund credits
    if (booking.credits_charged > 0) {
      const { data: user } = await supabase
        .from('users')
        .select('credits_balance')
        .eq('id', booking.user_id)
        .single();

      if (user) {
        await supabase
          .from('users')
          .update({ credits_balance: user.credits_balance + booking.credits_charged })
          .eq('id', booking.user_id);
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'CANCEL',
      entity_type: 'booking',
      entity_id: bookingId,
      performed_by_id: userId,
      previous_state: { status: booking.status },
      new_state: { status: 'CANCELLED', reason },
    });

    await this.invalidateAvailabilityCache(booking.room_id, parseDbDate(booking.start_time));

    // Emit real-time updates for live occupancy (US 3.3)
    emitBookingUpdate({
      type: 'CANCELLED',
      bookingId,
      roomId: booking.room_id,
      roomName: booking.rooms?.name || 'Room',
      startTime: booking.start_time,
      endTime: booking.end_time,
      userId,
    });
    emitRoomUpdate({
      type: 'AVAILABLE',
      roomId: booking.room_id,
      roomName: booking.rooms?.name || 'Room',
    });

    // US 3.7: Notify waitlisted users that a slot is now available
    await waitlistService.notifyWaitlistedUsers(
      booking.room_id,
      parseDbDate(booking.start_time),
      parseDbDate(booking.end_time)
    );

    // Epic 6 US 6: Notify booking owner when admin cancels their booking
    if (isAdmin && booking.user_id !== userId) {
      const { data: bookingOwner } = await supabase
        .from('users')
        .select('email, first_name, last_name')
        .eq('id', booking.user_id)
        .single();

      if (bookingOwner) {
        const ownerName = `${bookingOwner.first_name} ${bookingOwner.last_name}`;
        const roomName = booking.rooms?.name || 'Room';

        // Send cancellation email (fire-and-forget)
        emailService.sendBookingCancellationEmail(bookingOwner.email, ownerName, {
          roomName,
          startTime: booking.start_time,
          endTime: booking.end_time,
          reason: reason || undefined,
        }).catch(err => logger.error({ err }, 'Failed to send admin cancellation email'));

        // Send real-time socket notification
        sendNotification(
          booking.user_id,
          `Your booking for ${roomName} on ${new Date(booking.start_time).toLocaleString()} has been cancelled by an administrator.${reason ? ` Reason: ${reason}` : ''}`,
          'warning'
        );
      }
    }

    logger.info({ bookingId }, 'Booking cancelled');

    return updated;
  }

  async rescheduleBooking(
    bookingId: string,
    userId: string,
    newStartTimeStr: string, // Changed parameter type to string
    newEndTimeStr: string     // Changed parameter type to string
  ): Promise<any> {
    const newStartTime = istToUtc(newStartTimeStr); // Convert string to Date using istToUtc
    const newEndTime = istToUtc(newEndTimeStr);     // Convert string to Date using istToUtc

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingNotFoundError(bookingId);
    }

    if (booking.user_id !== userId) {
      throw new AppError('You can only reschedule your own bookings', 403);
    }

    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
      throw new AppError(`Cannot reschedule ${booking.status.toLowerCase()} booking`, 400);
    }

    if (parseDbDate(booking.start_time) < new Date()) {
      throw new AppError('Cannot reschedule past bookings', 400);
    }

    await this.validateTimeRange(newStartTime, newEndTime);

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', booking.room_id)
      .neq('id', bookingId)
      .not('status', 'in', '("CANCELLED","NO_SHOW")')
      .lt('start_time', newEndTime.toISOString())
      .gt('end_time', newStartTime.toISOString());

    if (conflicts && conflicts.length > 0) {
      throw new BookingConflictError('New time slot is not available');
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
      })
      .eq('id', bookingId)
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .single();

    if (updateError || !updated) {
      throw new AppError('Failed to reschedule booking', 500);
    }

    await supabase.from('audit_logs').insert({
      action: 'UPDATE',
      entity_type: 'booking',
      entity_id: bookingId,
      performed_by_id: userId,
      previous_state: { start_time: booking.start_time, end_time: booking.end_time },
      new_state: { start_time: newStartTime.toISOString(), end_time: newEndTime.toISOString() },
      metadata: { action: 'reschedule' },
    });

    await this.invalidateAvailabilityCache(booking.room_id, parseDbDate(booking.start_time));
    await this.invalidateAvailabilityCache(booking.room_id, newStartTime);

    logger.info({ bookingId, newStartTime, newEndTime }, 'Booking rescheduled');

    return updated;
  }

  async getBookingById(bookingId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .eq('id', bookingId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  async getUserBookings(
    userId: string,
    options: { status?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number } = {}
  ): Promise<{ bookings: any[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // First, auto-complete any finished bookings
    await this.autoCompleteFinishedBookings(userId);

    let query = supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)', { count: 'exact' })
      .eq('user_id', userId);

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.startDate) {
      query = query.gte('start_time', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.lte('end_time', options.endDate.toISOString());
    }

    query = query.order('start_time', { ascending: true }).range(skip, skip + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return { bookings: [], total: 0 };
    }

    return { bookings: data || [], total: count || 0 };
  }

  /**
   * Auto-complete bookings that have passed their end time and were checked in
   * This ensures bookings show as COMPLETED (blue) instead of CONFIRMED (green)
   */
  private async autoCompleteFinishedBookings(userId?: string): Promise<void> {
    try {
      const now = getCurrentIST();

      // Build query to find bookings that should be marked as complete
      let query = supabase
        .from('bookings')
        .select('id, end_time, status, check_in_status')
        .eq('status', 'CONFIRMED')
        .eq('check_in_status', 'CHECKED_IN')
        .lte('end_time', now.toISOString());

      // If userId provided, only update that user's bookings
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: finishedBookings } = await query;

      if (!finishedBookings || finishedBookings.length === 0) {
        return;
      }

      // Update all finished bookings to COMPLETED status
      const bookingIds = finishedBookings.map(b => b.id);

      await supabase
        .from('bookings')
        .update({ status: 'COMPLETED' })
        .in('id', bookingIds);

      logger.debug(
        { count: bookingIds.length, userId },
        'Auto-completed finished bookings'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to auto-complete finished bookings');
      // Don't throw - this is a background operation
    }
  }

  async getRoomAvailability(roomId: string, date: string): Promise<{
    available: Array<{ start: string; end: string }>;
    booked: Array<{ start: string; end: string; status: string }>;
  }> {
    const cacheKey = `${CACHE.KEYS.ROOM_AVAILABILITY}${roomId}:${date}`;

    const cached = await getCache<any>(cacheKey);
    if (cached) return cached;

    const startOfDay = istToUtc(`${date}T00:00:00`);
    const endOfDay = istToUtc(`${date}T23:59:59`);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('room_id', roomId)
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString())
      .not('status', 'in', '("CANCELLED","NO_SHOW")')
      .order('start_time', { ascending: true });

    const operatingStart = istToUtc(`${date}T08:00:00`);
    const operatingEnd = istToUtc(`${date}T22:00:00`);

    const booked = (bookings || []).map((b: any) => ({
      start: b.start_time,
      end: b.end_time,
      status: b.status,
    }));

    const available: Array<{ start: string; end: string }> = [];
    let currentStart = operatingStart;

    for (const booking of bookings || []) {
      const bookingStart = parseDbDate(booking.start_time);
      if (bookingStart > currentStart) {
        available.push({
          start: currentStart.toISOString(),
          end: bookingStart.toISOString(),
        });
      }
      currentStart = new Date(Math.max(currentStart.getTime(), parseDbDate(booking.end_time).getTime()));
    }

    if (currentStart < operatingEnd) {
      available.push({
        start: currentStart.toISOString(),
        end: operatingEnd.toISOString(),
      });
    }

    const result = { available, booked };
    await setCache(cacheKey, result, CACHE.TTL.AVAILABILITY);

    return result;
  }

  async checkIn(bookingId: string, userId: string, qrCode: string, latitude?: number, longitude?: number): Promise<any> {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingNotFoundError(bookingId);
    }

    if (booking.user_id !== userId) {
      throw new AppError('You can only check in to your own bookings', 403);
    }

    if (booking.status !== 'CONFIRMED') {
      throw new AppError(`Cannot check in to a ${booking.status} booking`, 400);
    }

    if (booking.check_in_status === 'CHECKED_IN') {
      throw new AppError('Already checked in to this booking', 400);
    }

    const now = getCurrentIST();
    const checkInWindowStart = new Date(parseDbDate(booking.start_time).getTime() - 15 * TIME.MINUTE);
    const checkInWindowEnd = new Date(parseDbDate(booking.start_time).getTime() + 15 * TIME.MINUTE);

    if (now < checkInWindowStart) {
      throw new AppError('Check-in window has not started yet', 400);
    }

    if (now > checkInWindowEnd) {
      throw new AppError('Check-in window has expired', 400);
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        check_in_status: 'CHECKED_IN',
        checked_in_at: now.toISOString(),
      })
      .eq('id', bookingId)
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .single();

    if (updateError || !updated) {
      throw new AppError('Failed to check in', 500);
    }

    await supabase.from('audit_logs').insert({
      action: 'CHECK_IN',
      entity_type: 'booking',
      entity_id: bookingId,
      performed_by_id: userId,
      previous_state: { check_in_status: 'PENDING' },
      new_state: { check_in_status: 'CHECKED_IN', checked_in_at: now.toISOString() },
    });

    logger.info({ bookingId, userId }, 'User checked in to booking');

    // Emit real-time updates for live occupancy (US 3.3)
    emitBookingUpdate({
      type: 'CONFIRMED',
      bookingId,
      roomId: booking.room_id,
      roomName: booking.rooms?.name || 'Room',
      startTime: booking.start_time,
      endTime: booking.end_time,
      userId,
    });
    emitRoomUpdate({
      type: 'OCCUPIED',
      roomId: booking.room_id,
      roomName: booking.rooms?.name || 'Room',
    });

    return updated;
  }

  async approveBooking(bookingId: string, adminUserId: string, approved: boolean, reason?: string): Promise<any> {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingNotFoundError(bookingId);
    }

    if (booking.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Cannot approve booking with status: ${booking.status}`, 400);
    }

    const newStatus = approved ? 'CONFIRMED' : 'CANCELLED';

    const updateData: Record<string, any> = { status: newStatus };
    if (!approved) {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = adminUserId;
      updateData.cancellation_reason = reason || 'Booking rejected by admin';
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .single();

    if (updateError || !updated) {
      throw new AppError('Failed to update booking', 500);
    }

    if (!approved && booking.credits_charged > 0) {
      const { data: user } = await supabase
        .from('users')
        .select('credits_balance')
        .eq('id', booking.user_id)
        .single();

      if (user) {
        await supabase
          .from('users')
          .update({ credits_balance: user.credits_balance + booking.credits_charged })
          .eq('id', booking.user_id);
      }
    }

    await supabase.from('audit_logs').insert({
      action: approved ? 'APPROVE' : 'REJECT',
      entity_type: 'booking',
      entity_id: bookingId,
      performed_by_id: adminUserId,
      previous_state: { status: 'PENDING_APPROVAL' },
      new_state: { status: newStatus, reason: reason || null },
    });

    // Send notification email (US 4.2 & 4.3)
    const user = updated.users as any;
    if (user && user.email) {
      const userName = `${user.first_name} ${user.last_name}`;
      emailService.sendBookingStatusEmail(user.email, userName, {
        roomName: updated.rooms?.name || 'Room',
        startTime: updated.start_time,
        endTime: updated.end_time,
        status: approved ? 'CONFIRMED' : 'REJECTED',
        reason: reason || (approved ? undefined : 'Booking rejected by admin')
      }).catch(err => logger.error({ err }, 'Failed to send booking status email'));
    }

    return updated;
  }

  async getPendingApprovals(): Promise<any[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: true });

    if (error) {
      return [];
    }

    return data || [];
  }

  async getAllBookings(options: { status?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number } = {}): Promise<{ bookings: any[]; total: number }> {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    // Auto-complete finished bookings for everyone
    await this.autoCompleteFinishedBookings();

    let query = supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)', { count: 'exact' });

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.startDate) {
      query = query.gte('start_time', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.lte('end_time', options.endDate.toISOString());
    }

    query = query.order('start_time', { ascending: false }).range(skip, skip + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return { bookings: [], total: 0 };
    }

    return { bookings: data || [], total: count || 0 };
  }

  async earlyCheckout(bookingId: string, userId: string): Promise<any> {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingNotFoundError(bookingId);
    }

    if (booking.user_id !== userId) {
      throw new AppError('You can only checkout of your own bookings', 403);
    }

    if (booking.status !== 'CONFIRMED' || booking.check_in_status !== 'CHECKED_IN') {
      throw new AppError('Can only early checkout from an active, checked-in booking', 400);
    }

    const now = new Date();
    if (now >= parseDbDate(booking.end_time)) {
      throw new AppError('Booking has already ended', 400);
    }

    const totalDuration = parseDbDate(booking.end_time).getTime() - parseDbDate(booking.start_time).getTime();
    const usedDuration = Math.max(0, now.getTime() - parseDbDate(booking.start_time).getTime());
    const remainingRatio = Math.max(0, (totalDuration - usedDuration) / totalDuration);
    const refundCredits = Math.floor(booking.credits_charged * remainingRatio);

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'COMPLETED',
        end_time: now.toISOString(),
      })
      .eq('id', bookingId)
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .single();

    if (updateError || !updated) {
      throw new AppError('Failed to checkout', 500);
    }

    if (refundCredits > 0) {
      const { data: user } = await supabase
        .from('users')
        .select('credits_balance')
        .eq('id', userId)
        .single();

      if (user) {
        await supabase
          .from('users')
          .update({ credits_balance: user.credits_balance + refundCredits })
          .eq('id', userId);
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'UPDATE',
      entity_type: 'booking',
      entity_id: bookingId,
      performed_by_id: userId,
      previous_state: { end_time: booking.end_time },
      new_state: { end_time: now.toISOString(), refund_credits: refundCredits },
    });

    logger.info({ bookingId, userId, refundCredits }, 'Early checkout completed');

    // Emit real-time updates for live occupancy (US 3.3)
    emitBookingUpdate({
      type: 'COMPLETED',
      bookingId,
      roomId: booking.room_id,
      roomName: booking.rooms?.name || 'Room',
      startTime: booking.start_time,
      endTime: now.toISOString(),
      userId,
    });
    emitRoomUpdate({
      type: 'AVAILABLE',
      roomId: booking.room_id,
      roomName: booking.rooms?.name || 'Room',
    });

    return { ...updated, refundedCredits: refundCredits };
  }

  async extendBooking(bookingId: string, userId: string, additionalMinutes: number): Promise<any> {
    if (additionalMinutes < 15 || additionalMinutes > 120) {
      throw new AppError('Extension must be between 15 and 120 minutes', 400);
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id, credits_balance)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingNotFoundError(bookingId);
    }

    if (booking.user_id !== userId) {
      throw new AppError('You can only extend your own bookings', 403);
    }

    if (booking.status !== 'CONFIRMED') {
      throw new AppError('Can only extend confirmed bookings', 400);
    }

    const newEndTime = new Date(parseDbDate(booking.end_time).getTime() + additionalMinutes * TIME.MINUTE);
    const now = new Date();

    if (booking.check_in_status !== 'CHECKED_IN') {
      throw new AppError('You must check in before extending a booking', 400);
    }

    if (now > parseDbDate(booking.end_time)) {
      throw new AppError('Cannot extend a booking that has already ended', 400);
    }

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', booking.room_id)
      .neq('id', bookingId)
      .not('status', 'in', '("CANCELLED","NO_SHOW")')
      .lt('start_time', newEndTime.toISOString())
      .gt('end_time', booking.end_time);

    if (conflicts && conflicts.length > 0) {
      throw new BookingConflictError('Room is not available for the extended duration');
    }

    const additionalHours = additionalMinutes / 60;
    const additionalCredits = Math.ceil(additionalHours * 10);

    if ((booking.users as any).credits_balance < additionalCredits) {
      throw new InsufficientCreditsError(
        `Extension requires ${additionalCredits} credits`,
        { required: additionalCredits, available: (booking.users as any).credits_balance }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        end_time: newEndTime.toISOString(),
        credits_charged: booking.credits_charged + additionalCredits,
      })
      .eq('id', bookingId)
      .select('*, rooms(*), users(id, email, first_name, last_name, department_id)')
      .single();

    if (updateError || !updated) {
      throw new AppError('Failed to extend booking', 500);
    }

    await supabase
      .from('users')
      .update({ credits_balance: (booking.users as any).credits_balance - additionalCredits })
      .eq('id', userId);

    await supabase.from('audit_logs').insert({
      action: 'UPDATE',
      entity_type: 'booking',
      entity_id: bookingId,
      performed_by_id: userId,
      previous_state: { end_time: booking.end_time },
      new_state: { end_time: newEndTime.toISOString(), additional_minutes: additionalMinutes, additional_credits: additionalCredits },
    });

    logger.info({ bookingId, userId, additionalMinutes, additionalCredits }, 'Booking extended');

    // Emit real-time update for extended booking (US 3.5)
    emitBookingUpdate({
      type: 'CONFIRMED',
      bookingId,
      roomId: updated.room_id,
      roomName: updated.rooms?.name || 'Room',
      startTime: updated.start_time,
      endTime: updated.end_time,
      userId,
    });
    emitRoomUpdate({
      type: 'OCCUPIED',
      roomId: updated.room_id,
      roomName: updated.rooms?.name || 'Room',
    });

    return updated;
  }

  // ========= HELPER METHODS =========

  private async validateTimeRange(startTime: Date, endTime: Date): Promise<void> {
    if (startTime >= endTime) {
      throw new InvalidTimeRangeError('End time must be after start time');
    }
    if (startTime < getCurrentIST()) {
      throw new InvalidTimeRangeError('Cannot book in the past');
    }

    // US 5.9: Get dynamic config from system_config table
    const constraints = await configService.getBookingTimeConstraints();

    // Check campus hours
    const isWithinHours = await configService.isWithinCampusHours(startTime, endTime);
    if (!isWithinHours) {
      throw new InvalidTimeRangeError(
        `Bookings must be between ${constraints.campusOpenTime} and ${constraints.campusCloseTime}`
      );
    }

    // Check duration limits from config
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / TIME.HOUR;
    const durationMinutes = durationMs / TIME.MINUTE;

    if (durationHours > constraints.maxDurationHours) {
      throw new InvalidTimeRangeError(
        `Maximum booking duration is ${constraints.maxDurationHours} hours`
      );
    }
    if (durationMinutes < constraints.minDurationMinutes) {
      throw new InvalidTimeRangeError(
        `Minimum booking duration is ${constraints.minDurationMinutes} minutes`
      );
    }
  }

  private async checkDepartmentRestrictions(_userDepartmentId: string | null | undefined, _roomDepartmentId: string | null, _startTime: Date): Promise<void> {
    // Department restrictions removed — anyone can book any room
    return;
  }

  private async checkWeeklyQuota(userId: string, startTime: Date, endTime: Date): Promise<void> {
    const weekStart = this.getWeekStart(startTime);
    const weekEnd = new Date(weekStart.getTime() + TIME.WEEK);

    const { data: user } = await supabase
      .from('users')
      .select('quota_limit_hours, role')
      .eq('id', userId)
      .single();

    // US 4.7: Faculty Unlimited Access
    if (user?.role === USER_ROLES.FACULTY) {
      logger.debug({ userId }, 'Faculty member: skipping quota validation');
      return;
    }

    const quotaLimit = user?.quota_limit_hours || config.booking.maxWeeklyQuotaHours;

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', weekStart.toISOString())
      .lte('end_time', weekEnd.toISOString())
      .not('status', 'in', '("CANCELLED","NO_SHOW")');

    let currentUsageMs = 0;
    if (existingBookings) {
      for (const b of existingBookings) {
        currentUsageMs += parseDbDate(b.end_time).getTime() - parseDbDate(b.start_time).getTime();
      }
    }
    const currentUsageHours = currentUsageMs / TIME.HOUR;
    const requestedHours = (endTime.getTime() - startTime.getTime()) / TIME.HOUR;

    if (currentUsageHours + requestedHours > quotaLimit) {
      throw new QuotaExceededError(
        `This booking would exceed your weekly quota of ${quotaLimit} hours`,
        { currentUsage: parseFloat(currentUsageHours.toFixed(2)), limit: quotaLimit, requested: parseFloat(requestedHours.toFixed(2)) }
      );
    }
  }

  private calculateCredits(startTime: Date, endTime: Date): { creditsRequired: number; isPeakHours: boolean } {
    const isPeakHours = isISTPeakHour(config.booking.peakHoursStart, config.booking.peakHoursEnd);
    const durationHours = (endTime.getTime() - startTime.getTime()) / TIME.HOUR;
    const baseCredits = Math.ceil(durationHours * 10);
    const multiplier = isPeakHours ? config.booking.peakHourCreditMultiplier : 1;
    return { creditsRequired: baseCredits * multiplier, isPeakHours };
  }

  private getWeekStart(date: Date): Date {
    return getISTStartOfDay(date); // Simpler for now, ensures we align with IST day start
  }

  private isExclusionViolation(error: unknown): boolean {
    if (error && typeof error === 'object') {
      return (error as { code?: string }).code === PG_ERROR_CODES.EXCLUSION_VIOLATION;
    }
    return false;
  }

  private async invalidateAvailabilityCache(roomId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    await deleteCache(`${CACHE.KEYS.ROOM_AVAILABILITY}${roomId}:${dateStr}`);
  }

  /**
   * Find alternative available slots near the requested time (US 2.3)
   */
  async findAlternativeSlots(
    roomId: string,
    desiredStartTime: Date,
    desiredEndTime: Date,
    rangeHours: number = 2
  ): Promise<Array<{ start: string; end: string; isPeakHours: boolean }>> {
    const duration = desiredEndTime.getTime() - desiredStartTime.getTime();
    const alternatives: Array<{ start: string; end: string; isPeakHours: boolean }> = [];

    // Operating hours
    const operatingStart = 8; // 8 AM
    const operatingEnd = 22; // 10 PM

    // Check slots before and after the desired time
    for (let offset = -rangeHours; offset <= rangeHours; offset++) {
      if (offset === 0) continue; // Skip the original slot

      const candidateStart = new Date(desiredStartTime.getTime() + offset * TIME.HOUR);
      const candidateEnd = new Date(candidateStart.getTime() + duration);

      // Skip if outside operating hours
      const startHour = candidateStart.getHours();
      const endHour = candidateEnd.getHours();
      if (startHour < operatingStart || endHour > operatingEnd) continue;

      // Skip if in the past
      if (candidateStart < new Date()) continue;

      // Check if slot is available
      const { data: conflicts } = await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', roomId)
        .not('status', 'in', '("CANCELLED","NO_SHOW")')
        .lt('start_time', candidateEnd.toISOString())
        .gt('end_time', candidateStart.toISOString());

      if (!conflicts || conflicts.length === 0) {
        const hour = candidateStart.getUTCHours();
        const isPeakHours = hour >= config.booking.peakHoursStart && hour < config.booking.peakHoursEnd;
        alternatives.push({
          start: candidateStart.toISOString(),
          end: candidateEnd.toISOString(),
          isPeakHours,
        });
      }

      // Limit to 3 alternatives
      if (alternatives.length >= 3) break;
    }

    return alternatives;
  }

  /**
   * Bulk import timetable from CSV data (US 5.3)
   * Creates recurring bookings for a semester based on class schedule
   */
  async bulkImportTimetable(
    entries: Array<{
      roomCode: string;
      dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
      startTime: string; // "09:00"
      endTime: string; // "10:00"
      title: string;
      description?: string;
      weeks: number; // Number of weeks to create bookings for
    }>,
    adminUserId: string
  ): Promise<{ created: number; errors: Array<{ entry: number; error: string }> }> {
    const results = { created: 0, errors: [] as Array<{ entry: number; error: string }> };

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      try {
        // Find room by code
        const { data: room } = await supabase
          .from('rooms')
          .select('id')
          .eq('code', entry.roomCode)
          .single();

        if (!room) {
          results.errors.push({ entry: i, error: `Room ${entry.roomCode} not found` });
          continue;
        }

        // Find next occurrence of the day of week
        const today = new Date();
        let nextDate = new Date(today);
        while (nextDate.getDay() !== entry.dayOfWeek) {
          nextDate.setDate(nextDate.getDate() + 1);
        }

        // Parse time
        const [startHour, startMin] = entry.startTime.split(':').map(Number);
        const [endHour, endMin] = entry.endTime.split(':').map(Number);

        const recurringGroupId = crypto.randomUUID();

        // Create booking for each week
        for (let week = 0; week < entry.weeks; week++) {
          const bookingDate = new Date(nextDate);
          bookingDate.setDate(bookingDate.getDate() + (week * 7));

          const startDateTime = new Date(bookingDate);
          startDateTime.setHours(startHour, startMin, 0, 0);

          const endDateTime = new Date(bookingDate);
          endDateTime.setHours(endHour, endMin, 0, 0);

          // Check for conflicts
          const { data: conflicts } = await supabase
            .from('bookings')
            .select('id')
            .eq('room_id', room.id)
            .not('status', 'in', '("CANCELLED","NO_SHOW")')
            .lt('start_time', endDateTime.toISOString())
            .gt('end_time', startDateTime.toISOString());

          if (conflicts && conflicts.length > 0) {
            continue; // Skip this slot if conflict
          }

          // Create booking
          await supabase.from('bookings').insert({
            user_id: adminUserId,
            room_id: room.id,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            title: entry.title,
            description: entry.description || `Timetable import: ${entry.title}`,
            status: 'CONFIRMED',
            check_in_status: 'NOT_REQUIRED', // Class bookings don't need check-in
            is_recurring: true,
            recurring_group_id: recurringGroupId,
          });

          results.created++;
        }
      } catch (error: any) {
        results.errors.push({ entry: i, error: error.message });
      }
    }

    logger.info({
      adminUserId,
      entriesProcessed: entries.length,
      created: results.created,
      errors: results.errors.length
    }, 'Bulk timetable import completed');

    return results;
  }

  /**
   * Mark a booking as "Running Late" (US 3)
   * Extends the ghost-killer grace period by updating check_in_status to LATE
   */
  async markRunningLate(bookingId: string, userId: string): Promise<any> {
    // Fetch the booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, user_id, room_id, start_time, end_time, status, check_in_status,
        rooms(id, name, code)
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingNotFoundError(bookingId);
    }

    // Verify ownership
    if (booking.user_id !== userId) {
      throw new BookingNotFoundError(bookingId);
    }

    // Must be CONFIRMED and check-in PENDING
    if (booking.status !== 'CONFIRMED' || booking.check_in_status !== 'PENDING') {
      throw new AppError(
        'Running late can only be used for confirmed bookings that are pending check-in',
        400
      );
    }

    // Must be within the grace window: between start_time and start_time + gracePeriod
    const now = new Date();
    const startTime = parseDbDate(booking.start_time);
    const gracePeriodMs = config.ghostKiller.gracePeriodMinutes * TIME.MINUTE;
    const graceDeadline = new Date(startTime.getTime() + gracePeriodMs);

    if (now < startTime) {
      throw new AppError(
        'You can only mark running late after the booking start time',
        400
      );
    }

    if (now > graceDeadline) {
      throw new AppError(
        'The grace period has already expired',
        400
      );
    }

    // Update check_in_status to LATE
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ check_in_status: 'LATE' })
      .eq('id', bookingId)
      .select(`
        *,
        rooms(id, name, code, building, floor, capacity),
        users(id, email, first_name, last_name, department_id)
      `)
      .single();

    if (updateError) {
      logger.error({ error: updateError, bookingId }, 'Failed to mark booking as running late');
      throw new Error('Failed to update booking status');
    }

    logger.info({ bookingId, userId }, 'Booking marked as running late (US 3)');

    return updated;
  }
}

export const bookingService = new BookingService();
