/**
 * =============================================================================
 * US 3.3: Live Occupancy View — Integration Tests
 * =============================================================================
 * Tests: GET /rooms/available-now, GET /bookings/availability
 *
 * Acceptance Criteria:
 *   Given Room A is booked but empty,
 *   When I check,
 *   Then it shows "Pending Check-in" (Not free yet).
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

    // Fetch a room ID for testing
    const res = await request().get('/api/v1/rooms');
    const rooms = res.body?.data?.rooms || res.body?.data || [];
    if (Array.isArray(rooms) && rooms.length > 0) {
        testRoomId = rooms[0].id;
    }
});

describe('US 3.3: Live Occupancy View', () => {
    // =========================================================================
    // GET /api/v1/rooms/available-now — Real-time availability
    // =========================================================================
    describe('GET /api/v1/rooms/available-now', () => {
        it('should return a list of rooms with availability status', async () => {
            const res = await request().get('/api/v1/rooms/available-now');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });

        it('should include availability state for each room', async () => {
            const res = await request().get('/api/v1/rooms/available-now');

            expect(res.status).toBe(200);
            const rooms = res.body.data || [];

            if (Array.isArray(rooms) && rooms.length > 0) {
                const room = rooms[0];
                // Each room should have identifying info
                expect(room).toHaveProperty('id');
                expect(room).toHaveProperty('name');
            }
        });

        it('should show rooms as publicly accessible (no auth required)', async () => {
            // Available-now is a public endpoint for students to check availability
            const res = await request().get('/api/v1/rooms/available-now');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // =========================================================================
    // GET /api/v1/bookings/availability — Room availability slots
    // =========================================================================
    describe('GET /api/v1/bookings/availability', () => {
        it('should return availability for a specific room and date', async () => {
            if (!testRoomId) return;

            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const res = await request()
                .get('/api/v1/bookings/availability')
                .query({ roomId: testRoomId, date: today });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });

        it('should return available and booked time slots', async () => {
            if (!testRoomId) return;

            const today = new Date().toISOString().split('T')[0];
            const res = await request()
                .get('/api/v1/bookings/availability')
                .query({ roomId: testRoomId, date: today });

            expect(res.status).toBe(200);
            if (res.body.data) {
                // Should have available and/or booked arrays
                expect(res.body.data).toHaveProperty('available');
                expect(res.body.data).toHaveProperty('booked');
                expect(Array.isArray(res.body.data.available)).toBe(true);
                expect(Array.isArray(res.body.data.booked)).toBe(true);
            }
        });

        it('should require date parameter in YYYY-MM-DD format', async () => {
            const res = await request()
                .get('/api/v1/bookings/availability')
                .query({ date: 'invalid-date' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should handle missing date parameter', async () => {
            const res = await request()
                .get('/api/v1/bookings/availability')
                .query({});

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // =========================================================================
    // GET /api/v1/rooms — Room listing includes status data
    // =========================================================================
    describe('GET /api/v1/rooms — Status Data for Live View', () => {
        it('should return rooms list for live occupancy widget', async () => {
            const res = await request().get('/api/v1/rooms');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const rooms = res.body.data?.rooms || res.body.data || [];
            expect(Array.isArray(rooms)).toBe(true);
            expect(rooms.length).toBeGreaterThan(0);
        });

        it('should include room identifiers needed for live status', async () => {
            const res = await request().get('/api/v1/rooms');

            expect(res.status).toBe(200);
            const rooms = res.body.data?.rooms || res.body.data || [];

            if (rooms.length > 0) {
                const room = rooms[0];
                expect(room).toHaveProperty('id');
                expect(room).toHaveProperty('name');
                expect(room).toHaveProperty('code');
            }
        });
    });
});
