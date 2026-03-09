/**
 * =============================================================================
 * Campus Resource Engine - Load Balancing Service (US 8)
 * =============================================================================
 * Distributes bookings across equivalent rooms so no single room becomes
 * overloaded while others remain idle.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface RoomBookingCount {
    roomId: string;
    roomName: string;
    roomCode: string;
    bookingCount: number;
}

interface BalancedRoomResult {
    recommendedRoom: {
        roomId: string;
        roomName: string;
        roomCode: string;
        building: string;
        capacity: number;
    } | null;
    reason: string;
    equivalentRooms: RoomBookingCount[];
}

export const loadBalancingService = {
    /**
     * Find the least-loaded equivalent room for balancing bookings.
     *
     * "Equivalent" rooms: same building, same room_type, similar capacity (±20%),
     * and matching core amenities.
     *
     * @param roomId - The originally requested room
     * @param startTime - Desired start time (ISO)
     * @param endTime - Desired end time (ISO)
     * @param attendeeCount - Number of attendees
     */
    async getBalancedRoom(
        roomId: string,
        startTime: string,
        endTime: string,
        attendeeCount: number = 1
    ): Promise<BalancedRoomResult> {
        try {
            // 1. Get the original room details
            const { data: originalRoom, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .single();

            if (roomError || !originalRoom) {
                throw new AppError('Room not found', 404);
            }

            // 2. Find equivalent rooms (same building, type, similar capacity)
            const capacityLower = Math.floor(originalRoom.capacity * 0.8);
            const capacityUpper = Math.ceil(originalRoom.capacity * 1.2);

            const { data: equivalentRooms } = await supabase
                .from('rooms')
                .select('id, name, code, building, capacity, room_type, amenities')
                .eq('is_active', true)
                .eq('is_maintenance', false)
                .eq('building', originalRoom.building)
                .eq('room_type', originalRoom.room_type)
                .gte('capacity', Math.max(capacityLower, attendeeCount))
                .lte('capacity', capacityUpper);

            if (!equivalentRooms || equivalentRooms.length <= 1) {
                return {
                    recommendedRoom: {
                        roomId: originalRoom.id,
                        roomName: originalRoom.name,
                        roomCode: originalRoom.code,
                        building: originalRoom.building,
                        capacity: originalRoom.capacity,
                    },
                    reason: 'No equivalent rooms found; using the originally requested room.',
                    equivalentRooms: [],
                };
            }

            // 3. Count bookings per equivalent room for the same day
            const bookingDate = startTime.split('T')[0];
            const dayStart = `${bookingDate}T00:00:00.000Z`;
            const dayEnd = `${bookingDate}T23:59:59.999Z`;

            const equivalentIds = equivalentRooms.map((r: any) => r.id);

            const { data: dayBookings } = await supabase
                .from('bookings')
                .select('room_id')
                .in('room_id', equivalentIds)
                .in('status', ['CONFIRMED', 'CHECKED_IN', 'PENDING'])
                .gte('start_time', dayStart)
                .lte('start_time', dayEnd);

            // Count bookings per room
            const countMap = new Map<string, number>();
            for (const id of equivalentIds) {
                countMap.set(id, 0);
            }
            for (const booking of dayBookings || []) {
                countMap.set(booking.room_id, (countMap.get(booking.room_id) || 0) + 1);
            }

            // 4. Check which rooms are available for the requested slot
            const { data: overlapping } = await supabase
                .from('bookings')
                .select('room_id')
                .in('room_id', equivalentIds)
                .in('status', ['CONFIRMED', 'CHECKED_IN', 'PENDING'])
                .lt('start_time', endTime)
                .gt('end_time', startTime);

            const occupiedIds = new Set((overlapping || []).map((b: any) => b.room_id));

            // Build booking counts list
            const bookingCounts: RoomBookingCount[] = equivalentRooms.map((room: any) => ({
                roomId: room.id,
                roomName: room.name,
                roomCode: room.code,
                bookingCount: countMap.get(room.id) || 0,
            }));

            // 5. Pick the available room with fewest bookings
            const availableRooms = equivalentRooms
                .filter((r: any) => !occupiedIds.has(r.id))
                .sort((a: any, b: any) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0));

            if (availableRooms.length === 0) {
                return {
                    recommendedRoom: null,
                    reason: 'All equivalent rooms are occupied during this time slot.',
                    equivalentRooms: bookingCounts,
                };
            }

            const bestRoom = availableRooms[0];
            const bestCount = countMap.get(bestRoom.id) || 0;
            const originalCount = countMap.get(originalRoom.id) || 0;
            const isSameAsOriginal = bestRoom.id === originalRoom.id;

            return {
                recommendedRoom: {
                    roomId: bestRoom.id,
                    roomName: bestRoom.name,
                    roomCode: bestRoom.code,
                    building: bestRoom.building,
                    capacity: bestRoom.capacity,
                },
                reason: isSameAsOriginal
                    ? `Your requested room "${bestRoom.name}" already has the least bookings today (${bestCount}).`
                    : `Recommending "${bestRoom.name}" (${bestCount} bookings today) instead of "${originalRoom.name}" (${originalCount} bookings today) for better load distribution.`,
                equivalentRooms: bookingCounts,
            };
        } catch (error) {
            logger.error({ error }, 'Error getting balanced room');
            throw error instanceof AppError ? error : new AppError('Failed to get balanced room', 500);
        }
    },
};
