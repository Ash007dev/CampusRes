/**
 * =============================================================================
 * Campus Resource Engine - Utilization Service (US 2.4)
 * =============================================================================
 * Identifies underutilized rooms with historical trends and
 * provides re-purposing suggestions for administrators.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface WeeklyTrendPoint {
    weekStart: string;
    utilizationPercent: number;
}

interface UnderutilizedRoom {
    roomId: string;
    roomName: string;
    roomCode: string;
    building: string;
    floor: number;
    capacity: number;
    roomType: string;
    utilizationPercent: number;
    weeklyTrend: WeeklyTrendPoint[];
    suggestion: string;
}

interface UnderutilizedReport {
    rooms: UnderutilizedRoom[];
    threshold: number;
    periodDays: number;
    generatedAt: string;
}

// Operating hours per day: 8 AM to 8 PM = 12 hours
const OPERATING_HOURS_PER_DAY = 12;

export const utilizationService = {
    /**
     * Get underutilized rooms with historical trends and suggestions.
     *
     * @param days - Analysis window in days (default 30)
     * @param threshold - Utilization % below which a room is "underutilized" (default 30)
     */
    async getUnderutilizedRooms(
        days: number = 30,
        threshold: number = 30
    ): Promise<UnderutilizedReport> {
        try {
            const now = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // 1. Get all active rooms
            const { data: rooms, error: roomError } = await supabase
                .from('rooms')
                .select('id, name, code, building, floor, capacity, room_type')
                .eq('is_active', true)
                .eq('is_maintenance', false);

            if (roomError) {
                throw new AppError(`Failed to fetch rooms: ${roomError.message}`, 500);
            }

            // 2. Get all completed/confirmed bookings in window
            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('room_id, start_time, end_time')
                .in('status', ['CONFIRMED', 'COMPLETED'])
                .gte('start_time', startDate.toISOString())
                .lte('start_time', now.toISOString());

            if (bookingError) {
                throw new AppError(`Failed to fetch bookings: ${bookingError.message}`, 500);
            }

            // 3. Calculate per-room utilization
            // Count weekdays in the analysis window
            const weekdays = this.countWeekdays(startDate, now);
            const totalAvailableHours = weekdays * OPERATING_HOURS_PER_DAY;

            // Group bookings by room
            const bookingsByRoom = new Map<string, Array<{ start_time: string; end_time: string }>>();
            for (const booking of bookings || []) {
                const list = bookingsByRoom.get(booking.room_id) || [];
                list.push(booking);
                bookingsByRoom.set(booking.room_id, list);
            }

            // 4. Compute utilization for each room
            const underutilizedRooms: UnderutilizedRoom[] = [];

            for (const room of rooms || []) {
                const roomBookings = bookingsByRoom.get(room.id) || [];

                // Total booked hours
                const bookedHours = roomBookings.reduce((acc, b) => {
                    const start = new Date(b.start_time).getTime();
                    const end = new Date(b.end_time).getTime();
                    return acc + (end - start) / (1000 * 60 * 60);
                }, 0);

                const utilizationPercent = totalAvailableHours > 0
                    ? parseFloat(((bookedHours / totalAvailableHours) * 100).toFixed(1))
                    : 0;

                if (utilizationPercent < threshold) {
                    // Calculate weekly trend (last 4 weeks)
                    const weeklyTrend = this.calculateWeeklyTrend(roomBookings, now);

                    // Generate suggestion based on room type and utilization
                    const suggestion = this.generateSuggestion(room, utilizationPercent, weeklyTrend);

                    underutilizedRooms.push({
                        roomId: room.id,
                        roomName: room.name,
                        roomCode: room.code,
                        building: room.building,
                        floor: room.floor,
                        capacity: room.capacity,
                        roomType: room.room_type,
                        utilizationPercent,
                        weeklyTrend,
                        suggestion,
                    });
                }
            }

            // Sort by utilization ascending (most underutilized first)
            underutilizedRooms.sort((a, b) => a.utilizationPercent - b.utilizationPercent);

            return {
                rooms: underutilizedRooms,
                threshold,
                periodDays: days,
                generatedAt: now.toISOString(),
            };
        } catch (error) {
            logger.error({ error }, 'Error generating underutilized rooms report');
            throw error instanceof AppError ? error : new AppError('Failed to generate utilization report', 500);
        }
    },

    /**
     * Count weekdays (Mon–Fri) between two dates.
     */
    countWeekdays(start: Date, end: Date): number {
        let count = 0;
        const current = new Date(start);
        while (current <= end) {
            const day = current.getDay();
            if (day !== 0 && day !== 6) count++;
            current.setDate(current.getDate() + 1);
        }
        return Math.max(count, 1);
    },

    /**
     * Calculate weekly utilization trend for last 4 weeks.
     */
    calculateWeeklyTrend(
        bookings: Array<{ start_time: string; end_time: string }>,
        now: Date
    ): WeeklyTrendPoint[] {
        const trend: WeeklyTrendPoint[] = [];

        for (let w = 3; w >= 0; w--) {
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() - w * 7);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 7);

            const weekBookings = bookings.filter((b) => {
                const bStart = new Date(b.start_time);
                return bStart >= weekStart && bStart < weekEnd;
            });

            const weekdaysInWeek = this.countWeekdays(weekStart, weekEnd);
            const availableHours = weekdaysInWeek * OPERATING_HOURS_PER_DAY;

            const bookedHours = weekBookings.reduce((acc, b) => {
                const start = new Date(b.start_time).getTime();
                const end = new Date(b.end_time).getTime();
                return acc + (end - start) / (1000 * 60 * 60);
            }, 0);

            trend.push({
                weekStart: weekStart.toISOString().split('T')[0],
                utilizationPercent: availableHours > 0
                    ? parseFloat(((bookedHours / availableHours) * 100).toFixed(1))
                    : 0,
            });
        }

        return trend;
    },

    /**
     * Generate a re-purposing suggestion based on room characteristics.
     */
    generateSuggestion(
        room: any,
        utilization: number,
        trend: WeeklyTrendPoint[]
    ): string {
        // Check if trending down
        const trendDirection = trend.length >= 2
            ? trend[trend.length - 1].utilizationPercent - trend[0].utilizationPercent
            : 0;
        const isTrendingDown = trendDirection < -5;

        if (utilization < 5) {
            // Near-zero utilization
            if (room.capacity > 50) {
                return 'Consider partitioning this large room into smaller bookable spaces or converting to a co-working zone.';
            }
            return 'This room is barely used. Consider repurposing as a storage space, study nook, or removing from the booking system.';
        }

        if (utilization < 15) {
            if (room.room_type === 'lab') {
                return 'Low lab utilization. Consider opening for general use during off-peak hours or shared departmental access.';
            }
            if (room.capacity > 30) {
                return 'Large room with very low usage. Consider converting to hot-desking area or shared workspace.';
            }
            return 'Consider reducing operating hours for this room or merging availability with an adjacent space.';
        }

        // 15-30% utilization
        if (isTrendingDown) {
            return 'Utilization is declining. Review if room amenities still meet user needs or if location is inconvenient.';
        }

        if (room.room_type === 'lecture_hall') {
            return 'Consider allowing smaller group bookings during low-demand periods or converting to flexible event space.';
        }

        return 'Moderate underutilization. Consider promoting this room to departments or adding popular amenities to increase demand.';
    },
};
