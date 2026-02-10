/**
 * =============================================================================
 * US 5.10: Department Management — Integration Tests
 * =============================================================================
 * Tests: GET /rooms/department/:departmentId
 *
 * Acceptance Criteria:
 *   Given different departments share the campus,
 *   When I view rooms by department,
 *   Then I see only that department's rooms.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { request } from '../setup/testSetup.js';

let testDepartmentId: string;

beforeAll(async () => {
    // Fetch a valid department ID — this is a public endpoint, no auth needed
    const res = await request().get('/api/v1/rooms');
    const rooms = res.body?.data?.rooms || res.body?.data || [];
    if (Array.isArray(rooms) && rooms.length > 0) {
        testDepartmentId = rooms[0].department_id;
    }
});

describe('US 5.10: Department Management', () => {
    // =========================================================================
    // GET /api/v1/rooms/department/:departmentId — Filter rooms by department
    // =========================================================================
    describe('GET /api/v1/rooms/department/:departmentId', () => {
        it('should return rooms for a specific department', async () => {
            expect(testDepartmentId).toBeDefined();

            const res = await request().get(`/api/v1/rooms/department/${testDepartmentId}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            const rooms = res.body.data?.rooms || res.body.data || [];
            expect(Array.isArray(rooms)).toBe(true);
            expect(rooms.length).toBeGreaterThan(0);
        });

        it('should return empty for non-existent department', async () => {
            const res = await request().get('/api/v1/rooms/department/non-existent-dept-id');

            expect(res.status).toBe(200);
            const rooms = res.body.data?.rooms || res.body.data || [];
            expect(rooms.length).toBe(0);
        });

        it('should only return rooms belonging to that department', async () => {
            const res = await request().get(`/api/v1/rooms/department/${testDepartmentId}`);

            expect(res.status).toBe(200);
            const rooms = res.body.data?.rooms || res.body.data || [];
            rooms.forEach((room: any) => {
                expect(room.department_id).toBe(testDepartmentId);
            });
        });
    });
});
