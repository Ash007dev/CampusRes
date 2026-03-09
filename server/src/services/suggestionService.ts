/**
 * =============================================================================
 * Campus Resource Engine - Suggestion Service (US 2.2 / 2.3)
 * =============================================================================
 * Suggests alternative time slots and alternative rooms ranked by similarity
 * when the user's desired slot is unavailable.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface AlternativeSlot {
    start: string;
    end: string;
    durationMinutes: number;
}

interface AlternativeRoom {
    roomId: string;
    roomName: string;
    roomCode: string;
    building: string;
    capacity: number;
    similarityScore: number;
    reasons: string[];
}

interface SuggestionResult {
    alternativeSlots: AlternativeSlot[];
    alternativeRooms: AlternativeRoom[];
}

export const suggestionService = {
    /**
     * Get alternative suggestions for an unavailable slot.
     *
     * @param roomId - The originally requested room
     * @param startTime - Desired start time (ISO string)
     * @param endTime - Desired end time (ISO string)
     * @param attendeeCount - Number of attendees
     */
    async getAlternativeSuggestions(
        roomId: string,
        startTime: string,
        endTime: string,
        attendeeCount: number = 1
    ): Promise<SuggestionResult> {
        try {
            const requestedStart = new Date(startTime);
            const requestedEnd = new Date(endTime);
            const durationMs = requestedEnd.getTime() - requestedStart.getTime();
            const durationMinutes = durationMs / (1000 * 60);

            // -----------------------------------------------------------------------
            // 1. Get the requested room's details for similarity comparison
            // -----------------------------------------------------------------------
            const { data: requestedRoom, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .single();

            if (roomError || !requestedRoom) {
                throw new AppError('Room not found', 404);
            }

            // -----------------------------------------------------------------------
            // 2. Find alternative time slots on the same room (same day ± 1 day)
            // -----------------------------------------------------------------------
            const dayBefore = new Date(requestedStart);
            dayBefore.setDate(dayBefore.getDate() - 1);
            dayBefore.setHours(8, 0, 0, 0);

            const dayAfter = new Date(requestedStart);
            dayAfter.setDate(dayAfter.getDate() + 1);
            dayAfter.setHours(20, 0, 0, 0);

            // Get all bookings on this room in the ±1 day window
            const { data: existingBookings } = await supabase
                .from('bookings')
                .select('start_time, end_time')
                .eq('room_id', roomId)
                .in('status', ['CONFIRMED', 'CHECKED_IN', 'PENDING'])
                .gte('start_time', dayBefore.toISOString())
                .lte('end_time', dayAfter.toISOString())
                .order('start_time', { ascending: true });

            const alternativeSlots = this.findFreeSlots(
                existingBookings || [],
                dayBefore,
                dayAfter,
                durationMinutes,
                5 // max suggestions
            );

            // -----------------------------------------------------------------------
            // 3. Find alternative rooms that are free for the requested time
            // -----------------------------------------------------------------------
            // Get all rooms (active, not in maintenance)
            const { data: allRooms } = await supabase
                .from('rooms')
                .select('*')
                .eq('is_active', true)
                .eq('is_maintenance', false)
                .gte('capacity', attendeeCount)
                .neq('id', roomId);

            // Get all bookings that overlap with the requested time across all rooms
            const { data: overlappingBookings } = await supabase
                .from('bookings')
                .select('room_id')
                .in('status', ['CONFIRMED', 'CHECKED_IN', 'PENDING'])
                .lt('start_time', requestedEnd.toISOString())
                .gt('end_time', requestedStart.toISOString());

            const occupiedRoomIds = new Set(
                (overlappingBookings || []).map((b: any) => b.room_id)
            );

            // Filter to only free rooms and rank by similarity
            const alternativeRooms: AlternativeRoom[] = (allRooms || [])
                .filter((room: any) => !occupiedRoomIds.has(room.id))
                .map((room: any) => {
                    const { score, reasons } = this.calculateSimilarity(requestedRoom, room, attendeeCount);
                    return {
                        roomId: room.id,
                        roomName: room.name,
                        roomCode: room.code,
                        building: room.building,
                        capacity: room.capacity,
                        similarityScore: score,
                        reasons,
                    };
                })
                .sort((a: AlternativeRoom, b: AlternativeRoom) => b.similarityScore - a.similarityScore)
                .slice(0, 5);

            return { alternativeSlots, alternativeRooms };
        } catch (error) {
            logger.error({ error }, 'Error getting alternative suggestions');
            throw error instanceof AppError ? error : new AppError('Failed to get suggestions', 500);
        }
    },

    /**
     * Find free time slots in a window, avoiding existing bookings.
     */
    findFreeSlots(
        bookings: Array<{ start_time: string; end_time: string }>,
        windowStart: Date,
        windowEnd: Date,
        durationMinutes: number,
        maxSlots: number
    ): AlternativeSlot[] {
        const slots: AlternativeSlot[] = [];
        const OPERATING_START_HOUR = 8;
        const OPERATING_END_HOUR = 20;

        // Sort bookings by start time
        const sorted = [...bookings].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        // Walk through operating hours day by day
        const current = new Date(windowStart);
        while (current < windowEnd && slots.length < maxSlots) {
            const dayStart = new Date(current);
            dayStart.setHours(OPERATING_START_HOUR, 0, 0, 0);
            const dayEnd = new Date(current);
            dayEnd.setHours(OPERATING_END_HOUR, 0, 0, 0);

            // Only consider future slots
            const effectiveStart = new Date(Math.max(dayStart.getTime(), Date.now()));

            // Get bookings for this day
            const dayBookings = sorted.filter((b) => {
                const bStart = new Date(b.start_time);
                const bEnd = new Date(b.end_time);
                return bStart < dayEnd && bEnd > dayStart;
            });

            // Find gaps
            let cursor = effectiveStart;
            for (const booking of dayBookings) {
                const bStart = new Date(booking.start_time);
                if (cursor < bStart) {
                    const gapMinutes = (bStart.getTime() - cursor.getTime()) / (1000 * 60);
                    if (gapMinutes >= durationMinutes) {
                        const slotEnd = new Date(cursor.getTime() + durationMinutes * 60 * 1000);
                        slots.push({
                            start: cursor.toISOString(),
                            end: slotEnd.toISOString(),
                            durationMinutes,
                        });
                        if (slots.length >= maxSlots) break;
                    }
                }
                const bEnd = new Date(booking.end_time);
                cursor = new Date(Math.max(cursor.getTime(), bEnd.getTime()));
            }

            // Check gap after last booking
            if (slots.length < maxSlots && cursor < dayEnd) {
                const gapMinutes = (dayEnd.getTime() - cursor.getTime()) / (1000 * 60);
                if (gapMinutes >= durationMinutes) {
                    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60 * 1000);
                    slots.push({
                        start: cursor.toISOString(),
                        end: slotEnd.toISOString(),
                        durationMinutes,
                    });
                }
            }

            // Move to next day
            current.setDate(current.getDate() + 1);
            current.setHours(0, 0, 0, 0);
        }

        return slots;
    },

    /**
     * Calculate similarity score between the requested room and a candidate.
     * Score is 0–100.
     */
    calculateSimilarity(
        requestedRoom: any,
        candidateRoom: any,
        attendeeCount: number
    ): { score: number; reasons: string[] } {
        let score = 0;
        const reasons: string[] = [];

        // 1. Capacity match (40 points max)
        //    Lower wastage = higher score
        const wastage = candidateRoom.capacity - attendeeCount;
        const maxCapacityScore = 40;
        if (wastage <= 5) {
            score += maxCapacityScore;
            reasons.push('Excellent capacity fit');
        } else if (wastage <= 15) {
            score += maxCapacityScore * 0.7;
            reasons.push('Good capacity fit');
        } else if (wastage <= 30) {
            score += maxCapacityScore * 0.4;
            reasons.push('Adequate capacity');
        } else {
            score += maxCapacityScore * 0.1;
            reasons.push('Oversized for your group');
        }

        // 2. Same building (25 points)
        if (candidateRoom.building === requestedRoom.building) {
            score += 25;
            reasons.push('Same building');
        }

        // 3. Same floor (10 points)
        if (candidateRoom.floor === requestedRoom.floor) {
            score += 10;
            reasons.push('Same floor');
        }

        // 4. Room type match (10 points)
        if (candidateRoom.room_type === requestedRoom.room_type) {
            score += 10;
            reasons.push('Same room type');
        }

        // 5. Amenity overlap (15 points max)
        const reqAmenities = Object.keys(requestedRoom.amenities || {}).filter(
            (k) => requestedRoom.amenities[k]
        );
        const candAmenities = Object.keys(candidateRoom.amenities || {}).filter(
            (k) => candidateRoom.amenities[k]
        );

        if (reqAmenities.length > 0) {
            const overlap = reqAmenities.filter((a) => candAmenities.includes(a)).length;
            const amenityScore = (overlap / reqAmenities.length) * 15;
            score += amenityScore;
            if (overlap === reqAmenities.length) {
                reasons.push('All required amenities available');
            } else if (overlap > 0) {
                reasons.push(`${overlap}/${reqAmenities.length} amenities match`);
            }
        } else {
            score += 15; // No specific amenities required
        }

        return { score: Math.round(score), reasons };
    },
};
