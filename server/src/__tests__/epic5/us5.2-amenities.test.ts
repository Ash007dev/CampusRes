/**
 * =============================================================================
 * US 5.2: Manage Room Amenities — Integration Tests
 * =============================================================================
 * Amenities are managed as part of the room object (no separate route).
 * Tests: PATCH /rooms/:id (update amenities), GET /rooms/:id (verify amenities)
 *
 * Acceptance Criteria:
 *   Given I'm setting up a new lab,
 *   When I add/update amenities for a room,
 *   Then the room's amenity list is updated correctly.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authGet,
    authPatch,
    getAdminToken,
} from '../setup/testSetup.js';

let testRoomId: string;

beforeAll(async () => {
    await getAdminToken();

    // Find a room to test amenity updates on
    const res = await authGet('/api/v1/rooms');
    const rooms = res.body?.data?.rooms || res.body?.data || [];
    if (Array.isArray(rooms) && rooms.length > 0) {
        testRoomId = rooms[rooms.length - 1].id;
    }
});

describe('US 5.2: Manage Room Amenities', () => {
    // =========================================================================
    // PATCH /api/v1/rooms/:id — Update amenities
    // =========================================================================
    describe('PATCH /api/v1/rooms/:id (amenities update)', () => {
        it('should reject unauthenticated amenity updates', async () => {
            const res = await request()
                .patch(`/api/v1/rooms/${testRoomId}`)
                .send({ amenities: { projector: true } });

            expect(res.status).toBe(401);
        });

        it('should update amenities on a room', async () => {
            expect(testRoomId).toBeDefined();

            const res = await authPatch(`/api/v1/rooms/${testRoomId}`, {
                amenities: {
                    projector: true,
                    whiteboard: true,
                    ac: true,
                    wifi: true,
                    computers: false,
                },
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should persist the updated amenities', async () => {
            const res = await authGet(`/api/v1/rooms/${testRoomId}`);

            expect(res.status).toBe(200);
            const room = res.body.data?.room || res.body.data;
            expect(room).toBeDefined();
            expect(room.amenities).toBeDefined();
            expect(room.amenities.projector).toBe(true);
            expect(room.amenities.whiteboard).toBe(true);
        });

        it('should allow toggling individual amenities', async () => {
            const res = await authPatch(`/api/v1/rooms/${testRoomId}`, {
                amenities: { projector: false, wifi: true },
            });

            expect(res.status).toBe(200);
        });
    });

    // =========================================================================
    // GET /api/v1/rooms — Verify amenity data in listing
    // =========================================================================
    describe('GET /api/v1/rooms (with amenities)', () => {
        it('should include amenities in room listing', async () => {
            const res = await request().get('/api/v1/rooms');

            expect(res.status).toBe(200);
            const rooms = res.body.data?.rooms || res.body.data;
            expect(Array.isArray(rooms)).toBe(true);

            // At least one room should have amenities
            const roomWithAmenities = rooms.find((r: any) => r.amenities && Object.keys(r.amenities).length > 0);
            expect(roomWithAmenities).toBeDefined();
        });
    });
});
