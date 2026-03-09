/**
 * =============================================================================
 * Campus Resource Engine - Room Recommendation Service (US 7)
 * =============================================================================
 * Recommends the smallest suitable room based on group size and equipment
 * needs, so larger rooms remain available for large events.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface RoomRecommendation {
    roomId: string;
    roomName: string;
    roomCode: string;
    building: string;
    floor: number;
    capacity: number;
    roomType: string;
    fitScore: number;
    reason: string;
}

interface RecommendationResult {
    recommendations: RoomRecommendation[];
    criteria: {
        attendeeCount: number;
        requiredAmenities: string[];
        timeSlot: { start: string; end: string };
    };
}

export const roomRecommendationService = {
    /**
     * Recommend the smallest suitable room for a booking.
     *
     * @param attendeeCount - Number of attendees
     * @param startTime - Desired start time (ISO string)
     * @param endTime - Desired end time (ISO string)
     * @param requiredAmenities - List of required amenity keys (optional)
     */
    async recommendRoom(
        attendeeCount: number,
        startTime: string,
        endTime: string,
        requiredAmenities: string[] = []
    ): Promise<RecommendationResult> {
        try {
            // 1. Get all active, non-maintenance rooms that fit the group
            const { data: rooms, error: roomError } = await supabase
                .from('rooms')
                .select('id, name, code, building, floor, capacity, room_type, amenities')
                .eq('is_active', true)
                .eq('is_maintenance', false)
                .gte('capacity', attendeeCount)
                .order('capacity', { ascending: true }); // Smallest first

            if (roomError) {
                throw new AppError(`Failed to fetch rooms: ${roomError.message}`, 500);
            }

            if (!rooms || rooms.length === 0) {
                return {
                    recommendations: [],
                    criteria: { attendeeCount, requiredAmenities, timeSlot: { start: startTime, end: endTime } },
                };
            }

            // 2. Filter by required amenities
            let filteredRooms = rooms;
            if (requiredAmenities.length > 0) {
                filteredRooms = rooms.filter((room: any) => {
                    const roomAmenities = room.amenities || {};
                    return requiredAmenities.every((amenity) => roomAmenities[amenity] === true);
                });
            }

            // 3. Check availability — get rooms with overlapping bookings
            const { data: overlappingBookings } = await supabase
                .from('bookings')
                .select('room_id')
                .in('status', ['CONFIRMED', 'CHECKED_IN', 'PENDING'])
                .lt('start_time', endTime)
                .gt('end_time', startTime);

            const occupiedRoomIds = new Set(
                (overlappingBookings || []).map((b: any) => b.room_id)
            );

            // 4. Filter to available rooms only
            const availableRooms = filteredRooms.filter(
                (room: any) => !occupiedRoomIds.has(room.id)
            );

            // 5. Score and rank rooms (already sorted by capacity ascending)
            const recommendations: RoomRecommendation[] = availableRooms
                .slice(0, 5)
                .map((room: any, index: number) => {
                    const { score, reason } = this.calculateFitScore(room, attendeeCount, requiredAmenities);
                    return {
                        roomId: room.id,
                        roomName: room.name,
                        roomCode: room.code,
                        building: room.building,
                        floor: room.floor,
                        capacity: room.capacity,
                        roomType: room.room_type,
                        fitScore: score,
                        reason,
                    };
                })
                .sort((a: RoomRecommendation, b: RoomRecommendation) => b.fitScore - a.fitScore);

            return {
                recommendations,
                criteria: { attendeeCount, requiredAmenities, timeSlot: { start: startTime, end: endTime } },
            };
        } catch (error) {
            logger.error({ error }, 'Error recommending rooms');
            throw error instanceof AppError ? error : new AppError('Failed to recommend rooms', 500);
        }
    },

    /**
     * Calculate fit score (0–100). Smaller rooms that exactly fit get higher scores.
     */
    calculateFitScore(
        room: any,
        attendeeCount: number,
        requiredAmenities: string[]
    ): { score: number; reason: string } {
        let score = 0;
        const reasons: string[] = [];

        // Capacity fit (60 points max) — less wastage = higher score
        const wastage = room.capacity - attendeeCount;
        const wastageRatio = wastage / Math.max(attendeeCount, 1);

        if (wastageRatio <= 0.2) {
            score += 60;
            reasons.push('Perfect size — minimal wasted capacity');
        } else if (wastageRatio <= 0.5) {
            score += 45;
            reasons.push('Good fit — some extra capacity');
        } else if (wastageRatio <= 1.0) {
            score += 30;
            reasons.push('Adequate — room is larger than needed');
        } else {
            score += 15;
            reasons.push('Oversized — consider a smaller room');
        }

        // Amenity match (25 points max)
        if (requiredAmenities.length > 0) {
            const roomAmenities = room.amenities || {};
            const matchedCount = requiredAmenities.filter((a) => roomAmenities[a] === true).length;
            const amenityScore = (matchedCount / requiredAmenities.length) * 25;
            score += amenityScore;
            if (matchedCount === requiredAmenities.length) {
                reasons.push('All required equipment available');
            }
        } else {
            score += 25;
        }

        // Prefer standard rooms over specialized (15 points)
        const generalTypes = ['classroom', 'meeting_room', 'seminar_room'];
        if (generalTypes.includes(room.room_type)) {
            score += 15;
            reasons.push('Standard room type');
        } else {
            score += 5;
            reasons.push(`Specialized room (${room.room_type})`);
        }

        return { score: Math.round(score), reason: reasons.join('. ') };
    },
};
