/**
 * =============================================================================
 * US 5.1: Add New Room — Integration Tests
 * =============================================================================
 * Tests: POST /rooms, GET /rooms/:id, GET /rooms, PATCH /rooms/:id
 *
 * Acceptance Criteria:
 *   Given a new lab opens,
 *   When I add it,
 *   Then it appears in search immediately.
 * =============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    request,
    authGet,
    authPost,
    authPatch,
    authDelete,
    getAdminToken,
    uniqueName,
} from '../setup/testSetup.js';

let createdRoomId: string;
// Keep code short (max 20 chars) — use timestamp suffix only
const testRoomCode = `TR${Date.now().toString(36).slice(-6)}`.toUpperCase();
const testRoomName = `Test Room ${testRoomCode}`;
// Use a known department ID from the database
// We'll fetch one dynamically if needed, but for now use a placeholder
let testDepartmentId: string;

beforeAll(async () => {
    // Ensure we can authenticate before running tests
    await getAdminToken();

    // Fetch a valid department ID from the database
    const res = await authGet('/api/v1/rooms');
    const rooms = res.body?.data?.rooms || res.body?.data || [];
    if (Array.isArray(rooms) && rooms.length > 0) {
        testDepartmentId = rooms[0].department_id || rooms[0].departmentId;
    }

    // If we couldn't find a department, try the rooms list for any valid UUID
    if (!testDepartmentId) {
        // Fallback: use a well-known test value
        testDepartmentId = '00000000-0000-0000-0000-000000000001';
    }
});

afterAll(async () => {
    // Cleanup: delete the test room if it was created
    if (createdRoomId) {
        try {
            await authPatch(`/api/v1/rooms/${createdRoomId}`, { is_active: false });
        } catch {
            // Ignore cleanup errors
        }
    }
});

describe('US 5.1: Add New Room', () => {
    // =========================================================================
    // POST /api/v1/rooms — Create a new room (Admin only)
    // =========================================================================
    describe('POST /api/v1/rooms', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request()
                .post('/api/v1/rooms')
                .send({
                    name: testRoomName,
                    code: testRoomCode,
                    capacity: 30,
                    floor: 1,
                    building: 'Test Building',
                    roomType: 'lab',
                    departmentId: testDepartmentId,
                });

            expect(res.status).toBe(401);
        });

        it('should create a new room with valid data', async () => {
            const res = await authPost('/api/v1/rooms', {
                name: testRoomName,
                code: testRoomCode,
                capacity: 30,
                floor: 1,
                building: 'Test Building',
                roomType: 'lab',
                departmentId: testDepartmentId,
                amenities: { projector: true, whiteboard: true, ac: true },
            });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.name).toBe(testRoomName);
            expect(res.body.data.capacity).toBe(30);

            createdRoomId = res.body.data.id;
        });

        it('should reject duplicate room code', async () => {
            const res = await authPost('/api/v1/rooms', {
                name: `Duplicate ${testRoomName}`,
                code: testRoomCode, // Same code as above
                capacity: 20,
                floor: 1,
                building: 'Test Building',
                roomType: 'lab',
                departmentId: testDepartmentId,
            });

            // Should fail — duplicate code
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject missing required fields', async () => {
            const res = await authPost('/api/v1/rooms', {
                name: 'Incomplete Room',
                // Missing: code, capacity, departmentId
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // =========================================================================
    // GET /api/v1/rooms/:id — Get room by ID
    // =========================================================================
    describe('GET /api/v1/rooms/:id', () => {
        it('should return the created room by ID', async () => {
            expect(createdRoomId).toBeDefined();

            const res = await request().get(`/api/v1/rooms/${createdRoomId}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(createdRoomId);
            expect(res.body.data.name).toBe(testRoomName);
        });

        it('should return 404 for non-existent room', async () => {
            const res = await request().get('/api/v1/rooms/00000000-0000-0000-0000-000000000000');

            expect(res.status).toBe(404);
        });
    });

    // =========================================================================
    // GET /api/v1/rooms — Search rooms (should find the new room)
    // =========================================================================
    describe('GET /api/v1/rooms', () => {
        it('should find the new room in search results', async () => {
            const res = await request().get('/api/v1/rooms');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();

            // The created room should appear in results
            const rooms = res.body.data.rooms || res.body.data;
            const found = Array.isArray(rooms)
                ? rooms.find((r: any) => r.id === createdRoomId)
                : null;

            expect(found).toBeDefined();
        });
    });

    // =========================================================================
    // PATCH /api/v1/rooms/:id — Update room (Admin only)
    // =========================================================================
    describe('PATCH /api/v1/rooms/:id', () => {
        it('should update the room capacity', async () => {
            expect(createdRoomId).toBeDefined();

            const res = await authPatch(`/api/v1/rooms/${createdRoomId}`, {
                capacity: 50,
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.capacity).toBe(50);
        });

        it('should reject unauthenticated update', async () => {
            const res = await request()
                .patch(`/api/v1/rooms/${createdRoomId}`)
                .send({ capacity: 999 });

            expect(res.status).toBe(401);
        });
    });
});
