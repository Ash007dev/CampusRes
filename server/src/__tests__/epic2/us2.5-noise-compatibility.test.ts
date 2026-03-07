/**
 * =============================================================================
 * US 5 (Noise): Noise Compatibility — Integration Tests
 * =============================================================================
 * Tests: POST /api/v1/admin/room-adjacency
 *
 * Acceptance Criteria:
 *   Given an admin wants to manage noise compatibility between rooms,
 *   When they set room adjacencies,
 *   Then noise-incompatible events are prevented from scheduling in adjacent rooms.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authGet,
    authPost,
    getAdminToken,
} from '../setup/testSetup.js';

let testRoomIds: string[] = [];

beforeAll(async () => {
    await getAdminToken();

    // Get rooms for testing adjacency
    const res = await authGet('/api/v1/rooms');
    const rooms = res.body?.data?.rooms || res.body?.data || [];
    if (Array.isArray(rooms) && rooms.length >= 2) {
        testRoomIds = [rooms[0].id, rooms[1].id];
    }
});

describe('US 5: Noise Compatibility', () => {
    describe('POST /api/v1/admin/room-adjacency', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request()
                .post('/api/v1/admin/room-adjacency')
                .send({ roomId: 'a', adjacentRoomId: 'b' });
            expect(res.status).toBe(401);
        });

        it('should require roomId and adjacentRoomId', async () => {
            const res = await authPost('/api/v1/admin/room-adjacency', {});

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should set room adjacency successfully', async () => {
            if (testRoomIds.length < 2) return; // Skip if not enough rooms

            const res = await authPost('/api/v1/admin/room-adjacency', {
                roomId: testRoomIds[0],
                adjacentRoomId: testRoomIds[1],
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
