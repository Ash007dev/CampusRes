/**
 * =============================================================================
 * US 8: Load Balancing — Integration Tests
 * =============================================================================
 * Tests: GET /api/v1/bookings/balanced-room
 *
 * Acceptance Criteria:
 *   Given a user wants to book a room,
 *   When equivalent rooms are available,
 *   Then the system recommends the least-loaded equivalent room.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authGet,
    getAdminToken,
} from '../setup/testSetup.js';

let testRoomId: string;

beforeAll(async () => {
    await getAdminToken();

    // Get a room for testing
    const res = await authGet('/api/v1/rooms');
    const rooms = res.body?.data?.rooms || res.body?.data || [];
    if (Array.isArray(rooms) && rooms.length > 0) {
        testRoomId = rooms[0].id;
    }
});

describe('US 8: Load Balancing', () => {
    describe('GET /api/v1/bookings/balanced-room', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/bookings/balanced-room');
            expect(res.status).toBe(401);
        });

        it('should require roomId, startTime, and endTime', async () => {
            const res = await authGet('/api/v1/bookings/balanced-room');

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should return a balanced room recommendation', async () => {
            if (!testRoomId) return; // Skip if no room available

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const startTime = new Date(tomorrow);
            startTime.setHours(10, 0, 0, 0);
            const endTime = new Date(tomorrow);
            endTime.setHours(11, 0, 0, 0);

            const res = await authGet(
                `/api/v1/bookings/balanced-room?roomId=${testRoomId}&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`
            );

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.reason).toBeDefined();
            expect(res.body.data.equivalentRooms).toBeDefined();
            expect(Array.isArray(res.body.data.equivalentRooms)).toBe(true);

            // Validate recommended room structure
            if (res.body.data.recommendedRoom) {
                expect(res.body.data.recommendedRoom.roomId).toBeDefined();
                expect(res.body.data.recommendedRoom.roomName).toBeDefined();
                expect(res.body.data.recommendedRoom.building).toBeDefined();
            }

            // Validate equivalent rooms structure
            for (const room of res.body.data.equivalentRooms) {
                expect(room.roomId).toBeDefined();
                expect(room.roomName).toBeDefined();
                expect(room.bookingCount).toBeGreaterThanOrEqual(0);
            }
        });
    });
});
