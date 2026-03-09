/**
 * =============================================================================
 * Campus Resource Engine - Peak Hour Service (US 9)
 * =============================================================================
 * Defines and enforces stricter booking limits during peak hours so that
 * high-demand periods remain fairly accessible.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import { AppError, QuotaExceededError } from '../utils/errors.js';
import { isISTPeakHour, parseDbDate } from '../utils/dateUtils.js';
import { configService } from './configService.js';

interface PeakHourConfig {
    peakHoursStart: number;
    peakHoursEnd: number;
    peakMaxBookingHours: number;
    peakMaxBookingsPerDay: number;
    peakCreditMultiplier: number;
}

export const peakHourService = {
    /**
     * Check if a booking during peak hours violates stricter limits.
     * Called during booking creation after weekly quota check.
     *
     * @param userId - The user attempting to book
     * @param startTime - Start time of the booking
     * @param endTime - End time of the booking
     */
    async checkPeakHourLimits(userId: string, startTime: Date, endTime: Date): Promise<void> {
        // Only enforce if booking falls during peak hours
        const startHour = startTime.getUTCHours();
        const peakStart = config.booking.peakHoursStart;
        const peakEnd = config.booking.peakHoursEnd;

        if (startHour < peakStart || startHour >= peakEnd) {
            return; // Not peak hours — no additional limits
        }

        // Get peak hour configuration from system_config
        const peakMaxBookingHours = await this.getConfigValue('peak_max_booking_hours', 2);
        const peakMaxBookingsPerDay = await this.getConfigValue('peak_max_bookings_per_day', 2);

        // Check user's existing peak-hour bookings for the same day
        const bookingDate = startTime.toISOString().split('T')[0];
        const dayStart = `${bookingDate}T${String(peakStart).padStart(2, '0')}:00:00.000Z`;
        const dayEnd = `${bookingDate}T${String(peakEnd).padStart(2, '0')}:00:00.000Z`;

        const { data: existingPeakBookings } = await supabase
            .from('bookings')
            .select('start_time, end_time')
            .eq('user_id', userId)
            .not('status', 'in', '("CANCELLED","NO_SHOW")')
            .gte('start_time', dayStart)
            .lt('start_time', dayEnd);

        const peakBookings = existingPeakBookings || [];

        // Check 1: Number of peak-hour bookings per day
        if (peakBookings.length >= peakMaxBookingsPerDay) {
            throw new QuotaExceededError(
                `You can only make ${peakMaxBookingsPerDay} bookings during peak hours (${peakStart}:00–${peakEnd}:00) per day. You already have ${peakBookings.length}.`,
                {
                    currentUsage: peakBookings.length,
                    limit: peakMaxBookingsPerDay,
                    requested: 1,
                }
            );
        }

        // Check 2: Total peak-hour booking hours per day
        const bookedHours = peakBookings.reduce((acc, b) => {
            const bStart = parseDbDate(b.start_time).getTime();
            const bEnd = parseDbDate(b.end_time).getTime();
            return acc + (bEnd - bStart) / (1000 * 60 * 60);
        }, 0);

        const requestedHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        if (bookedHours + requestedHours > peakMaxBookingHours) {
            throw new QuotaExceededError(
                `Peak hour booking limit: max ${peakMaxBookingHours} hours during peak hours per day. You've used ${bookedHours.toFixed(1)}h, requesting ${requestedHours.toFixed(1)}h more.`,
                {
                    currentUsage: parseFloat(bookedHours.toFixed(2)),
                    limit: peakMaxBookingHours,
                    requested: parseFloat(requestedHours.toFixed(2)),
                }
            );
        }

        logger.debug({
            userId,
            peakBookings: peakBookings.length,
            peakMaxBookingsPerDay,
            bookedHours: bookedHours.toFixed(1),
            peakMaxBookingHours,
        }, 'Peak hour limits check passed');
    },

    /**
     * Get a config value from system_config, with fallback default.
     */
    async getConfigValue(key: string, defaultValue: number): Promise<number> {
        try {
            const value = await configService.getConfig(key);
            return value !== null && value !== undefined ? Number(value) : defaultValue;
        } catch {
            return defaultValue;
        }
    },

    /**
     * Get current peak hour configuration for admin display.
     */
    async getPeakHourConfig(): Promise<PeakHourConfig> {
        const peakMaxBookingHours = await this.getConfigValue('peak_max_booking_hours', 2);
        const peakMaxBookingsPerDay = await this.getConfigValue('peak_max_bookings_per_day', 2);

        return {
            peakHoursStart: config.booking.peakHoursStart,
            peakHoursEnd: config.booking.peakHoursEnd,
            peakMaxBookingHours,
            peakMaxBookingsPerDay,
            peakCreditMultiplier: config.booking.peakHourCreditMultiplier,
        };
    },

    /**
     * Update peak hour limits (admin only).
     */
    async updatePeakHourConfig(
        adminId: string,
        updates: { peakMaxBookingHours?: number; peakMaxBookingsPerDay?: number }
    ): Promise<PeakHourConfig> {
        if (updates.peakMaxBookingHours !== undefined) {
            await this.upsertConfig('peak_max_booking_hours', String(updates.peakMaxBookingHours), adminId);
        }
        if (updates.peakMaxBookingsPerDay !== undefined) {
            await this.upsertConfig('peak_max_bookings_per_day', String(updates.peakMaxBookingsPerDay), adminId);
        }

        logger.info({ adminId, updates }, '⚙️ Peak hour config updated');
        return this.getPeakHourConfig();
    },

    /**
     * Upsert a system_config entry.
     */
    async upsertConfig(key: string, value: string, adminId: string): Promise<void> {
        // Try to update first
        const { data: existing } = await supabase
            .from('system_config')
            .select('id')
            .eq('key', key)
            .single();

        if (existing) {
            await supabase
                .from('system_config')
                .update({
                    value,
                    updated_by: adminId,
                    updated_at: new Date().toISOString(),
                })
                .eq('key', key);
        } else {
            await supabase
                .from('system_config')
                .insert({
                    key,
                    value,
                    data_type: 'number',
                    description: `Peak hour limit: ${key}`,
                    category: 'booking',
                    is_public: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    updated_by: adminId,
                });
        }
    },
};
