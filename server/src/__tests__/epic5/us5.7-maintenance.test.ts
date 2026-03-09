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
    authPost,
    authPatch,
    getAdminToken,
} from '../setup/testSetup.js';

let testRoomId: string;

beforeAll(async () => {
    await getAdminToken();

    // Create a new room specifically for this test to avoid parallel execution conflicts
    const deptRes = await authGet('/api/v1/departments');
    const departmentId = deptRes.body?.data?.[0]?.id || 'unknown';

    const res = await authPost('/api/v1/rooms', {
        name: `Maintenance Test Room ${Date.now()}`,
        code: `MTR-${Date.now().toString().slice(-6)}`,
        capacity: 10,
        departmentId: departmentId,
        roomType: 'CLASSROOM'
    });

    if (res.body?.data?.id) {
        testRoomId = res.body.data.id;
    } else {
        // Fallback if room creation fails
        const fallbackRes = await authGet('/api/v1/rooms');
        const rooms = fallbackRes.body?.data?.rooms || fallbackRes.body?.data || [];
        if (Array.isArray(rooms) && rooms.length > 0) {
            testRoomId = rooms[rooms.length - 1].id;
        }
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

            if (res.status !== 200) {
                const fs = await import('fs');
                fs.writeFileSync('debug-maintenance.json', JSON.stringify({ room: testRoomId, body: res.body }));
            }

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.room).toBeDefined();
            expect(res.body.data.room.is_maintenance).toBe(true);
        });

        it('should hide room from available search when in maintenance', async () => {
            const res = await request().get('/api/v1/rooms');

            if (res.status !== 200) {
                const fs = await import('fs');
                fs.writeFileSync('debug-rooms.json', JSON.stringify({ body: res.body }));
            }

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
            const res = await request().get('/api/v1/rooms?limit=100');

            if (res.status !== 200) {
                const fs = await import('fs');
                fs.writeFileSync('debug-rooms-2.json', JSON.stringify({ body: res.body }));
            }

            expect(res.status).toBe(200);
            const rooms = res.body.data.rooms || res.body.data;
            const found = Array.isArray(rooms)
                ? rooms.find((r: any) => r.id === testRoomId)
                : null;

            expect(found).toBeDefined();
        });
    });
});
