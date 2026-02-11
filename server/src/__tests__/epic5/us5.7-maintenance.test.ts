/**
 * =============================================================================
 * US 5.7: Room Maintenance Mode — Integration Tests
 * =============================================================================
 * Tests: PATCH /rooms/:id/maintenance
 *
 * Acceptance Criteria:
 *   Given AC repair is scheduled,
 *   When I put a room in maintenance mode,
 *   Then it disappears from booking searches.
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

    // Find an existing room to use for maintenance tests
    const res = await authGet('/api/v1/rooms');
    const rooms = res.body?.data?.rooms || res.body?.data || [];
    if (Array.isArray(rooms) && rooms.length > 0) {
        // Pick the last room to minimize interference
        testRoomId = rooms[rooms.length - 1].id;
    }
});

describe('US 5.7: Room Maintenance Mode', () => {
    // =========================================================================
    // PATCH /api/v1/rooms/:id/maintenance — Toggle maintenance (Admin only)
    // =========================================================================
    describe('PATCH /api/v1/rooms/:id/maintenance', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request()
                .patch(`/api/v1/rooms/${testRoomId}/maintenance`)
                .send({ isMaintenance: true });

            expect(res.status).toBe(401);
        });

        it('should enable maintenance mode on a room', async () => {
            expect(testRoomId).toBeDefined();

            const res = await authPatch(`/api/v1/rooms/${testRoomId}/maintenance`, {
                isMaintenance: true,
                reason: 'Test maintenance — AC repair',
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.room).toBeDefined();
            expect(res.body.data.room.is_maintenance).toBe(true);
        });

        it('should hide room from available search when in maintenance', async () => {
            const res = await request().get('/api/v1/rooms');

            expect(res.status).toBe(200);
            const rooms = res.body.data.rooms || res.body.data;
            const found = Array.isArray(rooms)
                ? rooms.find((r: any) => r.id === testRoomId)
                : null;

            // Room in maintenance should NOT appear in default search
            // (unless includeMaintenace=true)
            expect(found).toBeUndefined();
        });

        it('should disable maintenance mode', async () => {
            const res = await authPatch(`/api/v1/rooms/${testRoomId}/maintenance`, {
                isMaintenance: false,
            });

            expect(res.status).toBe(200);
            expect(res.body.data.room.is_maintenance).toBe(false);
        });

        it('should show room in search after maintenance ends', async () => {
            const res = await request().get('/api/v1/rooms');

            expect(res.status).toBe(200);
            const rooms = res.body.data.rooms || res.body.data;
            const found = Array.isArray(rooms)
                ? rooms.find((r: any) => r.id === testRoomId)
                : null;

            expect(found).toBeDefined();
        });
    });
});
