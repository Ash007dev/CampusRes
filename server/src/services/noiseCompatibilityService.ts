/**
 * =============================================================================
 * Campus Resource Engine - Noise Compatibility Service (US 5 - Noise)
 * =============================================================================
 * Classifies events by noise level and prevents incompatible events
 * from being scheduled in adjacent rooms to protect academic activities.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

/** Noise levels ordered from quietest to loudest */
type NoiseLevel = 'SILENT' | 'LOW' | 'MODERATE' | 'LOUD';

const NOISE_LEVELS: NoiseLevel[] = ['SILENT', 'LOW', 'MODERATE', 'LOUD'];
const NOISE_RANK: Record<NoiseLevel, number> = {
    SILENT: 0,
    LOW: 1,
    MODERATE: 2,
    LOUD: 3,
};

interface NoiseConflict {
    adjacentRoomId: string;
    adjacentRoomName: string;
    adjacentRoomNoiseLevel: string;
    conflictingBookingId: string;
    conflictingEventNoiseLevel: string;
    reason: string;
}

interface NoiseCheckResult {
    compatible: boolean;
    conflicts: NoiseConflict[];
}

export const noiseCompatibilityService = {
    /**
     * Check if an event with a given noise level can be booked in a room
     * without conflicting with adjacent rooms' bookings.
     *
     * Rules:
     * 1. Event noise must not exceed the room's noise tolerance level.
     * 2. The event must not produce more noise than any adjacent room's tolerance
     *    during overlapping booking periods.
     */
    async checkNoiseCompatibility(
        roomId: string,
        eventNoiseLevel: NoiseLevel,
        startTime: string,
        endTime: string
    ): Promise<NoiseCheckResult> {
        try {
            const conflicts: NoiseConflict[] = [];

            // 1. Check if event noise level is valid
            if (!NOISE_LEVELS.includes(eventNoiseLevel)) {
                return { compatible: true, conflicts: [] }; // Default pass if no level specified
            }

            // 2. Get room noise tolerance
            const { data: room } = await supabase
                .from('rooms')
                .select('id, name, noise_level')
                .eq('id', roomId)
                .single();

            if (!room) {
                return { compatible: true, conflicts: [] }; // Room not found, skip check
            }

            const roomNoise = (room.noise_level || 'MODERATE') as NoiseLevel;

            // Check if event noise exceeds room tolerance
            if (NOISE_RANK[eventNoiseLevel] > NOISE_RANK[roomNoise]) {
                conflicts.push({
                    adjacentRoomId: roomId,
                    adjacentRoomName: room.name,
                    adjacentRoomNoiseLevel: roomNoise,
                    conflictingBookingId: '',
                    conflictingEventNoiseLevel: eventNoiseLevel,
                    reason: `Event noise level (${eventNoiseLevel}) exceeds room tolerance (${roomNoise})`,
                });
            }

            // 3. Get adjacent rooms
            const { data: adjacencies } = await supabase
                .from('room_adjacencies')
                .select('adjacent_room_id')
                .eq('room_id', roomId);

            if (!adjacencies || adjacencies.length === 0) {
                // No adjacencies defined — only check room-level compatibility
                return { compatible: conflicts.length === 0, conflicts };
            }

            const adjacentRoomIds = adjacencies.map((a: any) => a.adjacent_room_id);

            // 4. Get adjacent rooms' details
            const { data: adjacentRooms } = await supabase
                .from('rooms')
                .select('id, name, noise_level')
                .in('id', adjacentRoomIds);

            if (!adjacentRooms || adjacentRooms.length === 0) {
                return { compatible: conflicts.length === 0, conflicts };
            }

            // 5. Get overlapping bookings in adjacent rooms
            const { data: overlappingBookings } = await supabase
                .from('bookings')
                .select('id, room_id, event_noise_level, start_time, end_time')
                .in('room_id', adjacentRoomIds)
                .in('status', ['CONFIRMED', 'CHECKED_IN', 'PENDING'])
                .lt('start_time', endTime)
                .gt('end_time', startTime);

            // 6. Check each adjacent room for noise conflicts
            for (const adjRoom of adjacentRooms) {
                const adjNoise = (adjRoom.noise_level || 'MODERATE') as NoiseLevel;

                // Check: our loud event would disturb a quiet adjacent room
                // Rule: our event noise must not exceed adjacent room's tolerance
                if (NOISE_RANK[eventNoiseLevel] > NOISE_RANK[adjNoise]) {
                    // Only conflict if the adjacent room has active bookings during our time
                    const adjBookings = (overlappingBookings || []).filter(
                        (b: any) => b.room_id === adjRoom.id
                    );

                    for (const booking of adjBookings) {
                        const bookingNoise = (booking.event_noise_level || 'MODERATE') as NoiseLevel;

                        // Conflict if: our event is louder than what the adjacent room tolerates
                        // AND the adjacent room is hosting a quiet event
                        if (NOISE_RANK[eventNoiseLevel] > NOISE_RANK[adjNoise] &&
                            NOISE_RANK[bookingNoise] <= NOISE_RANK[adjNoise]) {
                            conflicts.push({
                                adjacentRoomId: adjRoom.id,
                                adjacentRoomName: adjRoom.name,
                                adjacentRoomNoiseLevel: adjNoise,
                                conflictingBookingId: booking.id,
                                conflictingEventNoiseLevel: bookingNoise,
                                reason: `Your ${eventNoiseLevel} event would disturb a ${bookingNoise} event in adjacent room "${adjRoom.name}" (tolerance: ${adjNoise})`,
                            });
                        }
                    }
                }
            }

            return { compatible: conflicts.length === 0, conflicts };
        } catch (error) {
            logger.error({ error }, 'Error checking noise compatibility');
            // Fail open — don't block bookings if the check fails
            return { compatible: true, conflicts: [] };
        }
    },

    /**
     * Set room adjacency (admin-only). Creates a bidirectional adjacency.
     */
    async setRoomAdjacency(roomId: string, adjacentRoomId: string): Promise<void> {
        try {
            // Insert both directions for bidirectional adjacency
            const { error: error1 } = await supabase
                .from('room_adjacencies')
                .upsert(
                    { room_id: roomId, adjacent_room_id: adjacentRoomId },
                    { onConflict: 'room_id,adjacent_room_id' }
                );

            const { error: error2 } = await supabase
                .from('room_adjacencies')
                .upsert(
                    { room_id: adjacentRoomId, adjacent_room_id: roomId },
                    { onConflict: 'room_id,adjacent_room_id' }
                );

            if (error1 || error2) {
                throw new AppError(`Failed to set room adjacency: ${error1?.message || error2?.message}`, 500);
            }

            logger.info({ roomId, adjacentRoomId }, '🔗 Room adjacency set');
        } catch (error) {
            logger.error({ error }, 'Error setting room adjacency');
            throw error instanceof AppError ? error : new AppError('Failed to set room adjacency', 500);
        }
    },

    /**
     * Remove room adjacency (admin-only). Removes both directions.
     */
    async removeRoomAdjacency(roomId: string, adjacentRoomId: string): Promise<void> {
        await supabase
            .from('room_adjacencies')
            .delete()
            .eq('room_id', roomId)
            .eq('adjacent_room_id', adjacentRoomId);

        await supabase
            .from('room_adjacencies')
            .delete()
            .eq('room_id', adjacentRoomId)
            .eq('adjacent_room_id', roomId);

        logger.info({ roomId, adjacentRoomId }, '🔗 Room adjacency removed');
    },

    /**
     * Get all adjacencies for a room.
     */
    async getRoomAdjacencies(roomId: string): Promise<Array<{ roomId: string; roomName: string }>> {
        const { data } = await supabase
            .from('room_adjacencies')
            .select('adjacent_room_id, rooms!room_adjacencies_adjacent_room_id_fkey(id, name)')
            .eq('room_id', roomId);

        return (data || []).map((a: any) => ({
            roomId: a.adjacent_room_id,
            roomName: a.rooms?.name || 'Unknown',
        }));
    },
};
