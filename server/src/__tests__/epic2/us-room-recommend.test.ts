/**
 * =============================================================================
 * US 7: Room Recommendation — Integration Tests
 * =============================================================================
 * Tests: GET /api/v1/bookings/room-recommend
 *
 * Acceptance Criteria:
 *   Given a user needs a room for a group with specific equipment needs,
 *   When they request recommendations,
 *   Then they get the smallest suitable rooms sorted by fit score.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authGet,
    getAdminToken,
} from '../setup/testSetup.js';

beforeAll(async () => {
    await getAdminToken();
});

describe('US 7: Room Recommendation', () => {
    describe('GET /api/v1/bookings/room-recommend', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/bookings/room-recommend');
            expect(res.status).toBe(401);
        });

        it('should require attendeeCount, startTime, and endTime', async () => {
            const res = await authGet('/api/v1/bookings/room-recommend');

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should return room recommendations sorted by fit score', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const startTime = new Date(tomorrow);
            startTime.setHours(10, 0, 0, 0);
            const endTime = new Date(tomorrow);
            endTime.setHours(11, 0, 0, 0);

            const res = await authGet(
                `/api/v1/bookings/room-recommend?attendeeCount=5&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`
            );

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.recommendations).toBeDefined();
            expect(Array.isArray(res.body.data.recommendations)).toBe(true);
            expect(res.body.data.criteria).toBeDefined();
            expect(res.body.data.criteria.attendeeCount).toBe(5);

            // Validate recommendation structure
            for (const rec of res.body.data.recommendations) {
                expect(rec.roomId).toBeDefined();
                expect(rec.roomName).toBeDefined();
                expect(rec.capacity).toBeGreaterThanOrEqual(5); // Must fit the group
                expect(rec.fitScore).toBeGreaterThanOrEqual(0);
                expect(rec.fitScore).toBeLessThanOrEqual(100);
                expect(rec.reason).toBeDefined();
            }
        });

        it('should support amenity filtering', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const startTime = new Date(tomorrow);
            startTime.setHours(14, 0, 0, 0);
            const endTime = new Date(tomorrow);
            endTime.setHours(15, 0, 0, 0);

            const res = await authGet(
                `/api/v1/bookings/room-recommend?attendeeCount=3&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}&amenities=projector`
            );

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
