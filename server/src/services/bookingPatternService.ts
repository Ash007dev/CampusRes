/**
 * =============================================================================
 * Campus Resource Engine - Booking Pattern Service (US 6)
 * =============================================================================
 * Learns recurring booking patterns from user history and offers
 * pre-filled one-tap booking suggestions for frequent users.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface BookingPattern {
    roomId: string;
    roomName: string;
    roomCode: string;
    building: string;
    dayOfWeek: number;
    dayName: string;
    startHour: number;
    endHour: number;
    frequency: number;
    lastBooked: string;
    prefilled: {
        roomId: string;
        title: string;
        startTime: string;
        endTime: string;
        attendeeCount: number;
    };
}

interface QuickBookResult {
    suggestions: BookingPattern[];
    analyzedBookings: number;
    periodDays: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const bookingPatternService = {
    /**
     * Analyze a user's booking history and return recurring pattern suggestions.
     * Looks at the last 60 days of bookings and groups by (room, dayOfWeek, hour).
     *
     * @param userId - The user to analyze
     * @param days - Number of historical days to analyze (default 60)
     */
    async getQuickBookSuggestions(userId: string, days: number = 60): Promise<QuickBookResult> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Fetch completed/confirmed bookings for this user
            const { data: bookings, error } = await supabase
                .from('bookings')
                .select('room_id, start_time, end_time, title, attendee_count, rooms(id, name, code, building, floor, capacity)')
                .eq('user_id', userId)
                .in('status', ['CONFIRMED', 'COMPLETED'])
                .gte('start_time', startDate.toISOString())
                .order('start_time', { ascending: false });

            if (error) {
                throw new AppError(`Failed to fetch booking history: ${error.message}`, 500);
            }

            if (!bookings || bookings.length === 0) {
                return { suggestions: [], analyzedBookings: 0, periodDays: days };
            }

            // Group by (roomId, dayOfWeek, startHour) to find recurring patterns
            const patternMap = new Map<string, {
                roomId: string;
                room: any;
                dayOfWeek: number;
                startHour: number;
                endHour: number;
                count: number;
                lastBooked: string;
                title: string;
                attendeeCount: number;
            }>();

            for (const booking of bookings) {
                const start = new Date(booking.start_time);
                const end = new Date(booking.end_time);
                const dayOfWeek = start.getUTCDay();
                const startHour = start.getUTCHours();
                const endHour = end.getUTCHours();

                const key = `${booking.room_id}_${dayOfWeek}_${startHour}`;

                const existing = patternMap.get(key);
                if (existing) {
                    existing.count++;
                    // Keep the most recent booking's details
                    if (new Date(booking.start_time) > new Date(existing.lastBooked)) {
                        existing.lastBooked = booking.start_time;
                        existing.title = booking.title;
                        existing.attendeeCount = booking.attendee_count;
                    }
                } else {
                    patternMap.set(key, {
                        roomId: booking.room_id,
                        room: booking.rooms,
                        dayOfWeek,
                        startHour,
                        endHour,
                        count: 1,
                        lastBooked: booking.start_time,
                        title: booking.title,
                        attendeeCount: booking.attendee_count,
                    });
                }
            }

            // Filter patterns that occurred at least 2 times and sort by frequency
            const patterns = Array.from(patternMap.values())
                .filter((p) => p.count >= 2)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // Top 5 patterns

            // Generate pre-filled booking suggestions for the next occurrence
            const suggestions: BookingPattern[] = patterns.map((p) => {
                const nextOccurrence = this.getNextOccurrence(p.dayOfWeek, p.startHour, p.endHour);

                return {
                    roomId: p.roomId,
                    roomName: p.room?.name || 'Unknown',
                    roomCode: p.room?.code || '',
                    building: p.room?.building || '',
                    dayOfWeek: p.dayOfWeek,
                    dayName: DAY_NAMES[p.dayOfWeek],
                    startHour: p.startHour,
                    endHour: p.endHour,
                    frequency: p.count,
                    lastBooked: p.lastBooked,
                    prefilled: {
                        roomId: p.roomId,
                        title: p.title,
                        startTime: nextOccurrence.start,
                        endTime: nextOccurrence.end,
                        attendeeCount: p.attendeeCount,
                    },
                };
            });

            return {
                suggestions,
                analyzedBookings: bookings.length,
                periodDays: days,
            };
        } catch (error) {
            logger.error({ error, userId }, 'Error analyzing booking patterns');
            throw error instanceof AppError ? error : new AppError('Failed to analyze booking patterns', 500);
        }
    },

    /**
     * Get the next occurrence of a given day-of-week and hour.
     */
    getNextOccurrence(
        dayOfWeek: number,
        startHour: number,
        endHour: number
    ): { start: string; end: string } {
        const now = new Date();
        const currentDay = now.getUTCDay();
        let daysUntil = dayOfWeek - currentDay;
        if (daysUntil <= 0) daysUntil += 7; // Next week if today or past

        const nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + daysUntil);

        const start = new Date(nextDate);
        start.setUTCHours(startHour, 0, 0, 0);

        const end = new Date(nextDate);
        end.setUTCHours(endHour, 0, 0, 0);

        return {
            start: start.toISOString(),
            end: end.toISOString(),
        };
    },
};
