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
import { config } from '../config/index.js';
import {
  BOOKING_STATUS,
  APPROVAL_REQUIRED_ROOM_TYPES,
  PG_ERROR_CODES,
  TIME,
  CACHE,
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
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);

    logger.info({
      userId,
      roomId: input.roomId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }, 'Creating booking');

    this.validateTimeRange(startTime, endTime);

    try {
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
        .select('credits_balance')
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
        throw new BookingConflictError('This time slot is already booked');
      }

      // Determine status
      const requiresApproval = APPROVAL_REQUIRED_ROOM_TYPES.includes(
        room.room_type as typeof APPROVAL_REQUIRED_ROOM_TYPES[number]
      );
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
          status: 'CONFIRMED',
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

    if (booking.user_id !== userId) {
      throw new AppError('You can only cancel your own bookings', 403);
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError('Booking is already cancelled', 400);
    }

    if (new Date(booking.start_time) < new Date()) {
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

    await this.invalidateAvailabilityCache(booking.room_id, new Date(booking.start_time));

    logger.info({ bookingId }, 'Booking cancelled');

    return updated;
  }

  async rescheduleBooking(
    bookingId: string,
    userId: string,
    newStartTime: Date,
    newEndTime: Date
  ): Promise<any> {
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

    if (new Date(booking.start_time) < new Date()) {
      throw new AppError('Cannot reschedule past bookings', 400);
    }

    this.validateTimeRange(newStartTime, newEndTime);

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

    await this.invalidateAvailabilityCache(booking.room_id, new Date(booking.start_time));
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

  async getRoomAvailability(roomId: string, date: string): Promise<{
    available: Array<{ start: string; end: string }>;
    booked: Array<{ start: string; end: string; status: string }>;
  }> {
    const cacheKey = `${CACHE.KEYS.ROOM_AVAILABILITY}${roomId}:${date}`;

    const cached = await getCache<any>(cacheKey);
    if (cached) return cached;

    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(`${date}T23:59:59Z`);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('room_id', roomId)
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString())
      .not('status', 'in', '("CANCELLED","NO_SHOW")')
      .order('start_time', { ascending: true });

    const operatingStart = new Date(`${date}T08:00:00Z`);
    const operatingEnd = new Date(`${date}T22:00:00Z`);

    const booked = (bookings || []).map((b: any) => ({
      start: b.start_time,
      end: b.end_time,
      status: b.status,
    }));

    const available: Array<{ start: string; end: string }> = [];
    let currentStart = operatingStart;

    for (const booking of bookings || []) {
      const bookingStart = new Date(booking.start_time);
      if (bookingStart > currentStart) {
        available.push({
          start: currentStart.toISOString(),
          end: bookingStart.toISOString(),
        });
      }
      currentStart = new Date(Math.max(currentStart.getTime(), new Date(booking.end_time).getTime()));
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

    const now = new Date();
    const checkInWindowStart = new Date(new Date(booking.start_time).getTime() - 15 * TIME.MINUTE);
    const checkInWindowEnd = new Date(new Date(booking.start_time).getTime() + 15 * TIME.MINUTE);

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

    logger.info({ bookingId, adminUserId, approved, newStatus }, `Booking ${approved ? 'approved' : 'rejected'} by admin`);

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
    if (now >= new Date(booking.end_time)) {
      throw new AppError('Booking has already ended', 400);
    }

    const totalDuration = new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime();
    const usedDuration = now.getTime() - new Date(booking.start_time).getTime();
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

    return updated;
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

    const newEndTime = new Date(new Date(booking.end_time).getTime() + additionalMinutes * TIME.MINUTE);
    const now = new Date();

    if (now < new Date(booking.start_time) || now > new Date(booking.end_time)) {
      throw new AppError('Can only extend during an active booking', 400);
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

    return updated;
  }

  // ========= HELPER METHODS =========

  private validateTimeRange(startTime: Date, endTime: Date): void {
    if (startTime >= endTime) {
      throw new InvalidTimeRangeError('End time must be after start time');
    }
    if (startTime < new Date()) {
      throw new InvalidTimeRangeError('Cannot book in the past');
    }
    const durationMs = endTime.getTime() - startTime.getTime();
    if (durationMs / TIME.HOUR > 4) {
      throw new InvalidTimeRangeError('Maximum booking duration is 4 hours');
    }
    if (durationMs < 30 * TIME.MINUTE) {
      throw new InvalidTimeRangeError('Minimum booking duration is 30 minutes');
    }
  }

  private async checkDepartmentRestrictions(userDepartmentId: string | null | undefined, roomDepartmentId: string | null, startTime: Date): Promise<void> {
    // If user has no department or room has no department, skip restriction check
    if (!userDepartmentId || !roomDepartmentId) return;
    if (userDepartmentId === roomDepartmentId) return;
    const hour = startTime.getUTCHours();
    if (hour >= config.booking.crossDepartmentAllowedAfterHour) return;
    throw new DepartmentRestrictionError(
      `Cross-department booking only allowed after ${config.booking.crossDepartmentAllowedAfterHour}:00`,
      { userDepartment: userDepartmentId, roomDepartment: roomDepartmentId, allowedAfter: config.booking.crossDepartmentAllowedAfterHour }
    );
  }

  private async checkWeeklyQuota(userId: string, startTime: Date, endTime: Date): Promise<void> {
    const weekStart = this.getWeekStart(startTime);
    const weekEnd = new Date(weekStart.getTime() + TIME.WEEK);

    const { data: user } = await supabase
      .from('users')
      .select('quota_limit_hours')
      .eq('id', userId)
      .single();

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
        currentUsageMs += new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
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
    const hour = startTime.getUTCHours();
    const isPeakHours = hour >= config.booking.peakHoursStart && hour < config.booking.peakHoursEnd;
    const durationHours = (endTime.getTime() - startTime.getTime()) / TIME.HOUR;
    const baseCredits = Math.ceil(durationHours * 10);
    const multiplier = isPeakHours ? config.booking.peakHourCreditMultiplier : 1;
    return { creditsRequired: baseCredits * multiplier, isPeakHours };
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    d.setUTCDate(diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
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
}

export const bookingService = new BookingService();
