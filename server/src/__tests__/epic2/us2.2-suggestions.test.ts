/**
 * =============================================================================
 * US 2.2/2.3: Alternative Slot & Room Suggestions — Integration Tests
 * =============================================================================
 * Tests: GET /api/v1/bookings/suggestions
 *
 * Acceptance Criteria:
 *   Given a desired time slot is unavailable,
 *   When the user requests suggestions,
 *   Then they receive alternative time slots and rooms ranked by similarity.
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

describe('US 2.2/2.3: Alternative Suggestions', () => {
    describe('GET /api/v1/bookings/suggestions', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/bookings/suggestions');
            expect(res.status).toBe(401);
        });

        it('should require roomId, startTime, and endTime', async () => {
            const res = await authGet('/api/v1/bookings/suggestions');

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should return alternative slots and rooms', async () => {
            if (!testRoomId) return; // Skip if no room available

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const startTime = new Date(tomorrow);
            startTime.setHours(10, 0, 0, 0);
            const endTime = new Date(tomorrow);
            endTime.setHours(11, 0, 0, 0);

            const res = await authGet(
                `/api/v1/bookings/suggestions?roomId=${testRoomId}&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}&attendeeCount=5`
            );

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.alternativeSlots).toBeDefined();
            expect(Array.isArray(res.body.data.alternativeSlots)).toBe(true);
            expect(res.body.data.alternativeRooms).toBeDefined();
            expect(Array.isArray(res.body.data.alternativeRooms)).toBe(true);

            // Validate alternative room structure
            for (const room of res.body.data.alternativeRooms) {
                expect(room.roomId).toBeDefined();
                expect(room.roomName).toBeDefined();
                expect(room.similarityScore).toBeGreaterThanOrEqual(0);
                expect(room.similarityScore).toBeLessThanOrEqual(100);
                expect(room.reasons).toBeDefined();
                expect(Array.isArray(room.reasons)).toBe(true);
            }

            // Validate alternative slot structure
            for (const slot of res.body.data.alternativeSlots) {
                expect(slot.start).toBeDefined();
                expect(slot.end).toBeDefined();
                expect(slot.durationMinutes).toBeGreaterThan(0);
            }
        });
    });
});
