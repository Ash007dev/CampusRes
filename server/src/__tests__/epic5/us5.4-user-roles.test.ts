/**
 * =============================================================================
 * US 5.4: User Role Management — Integration Tests
 * =============================================================================
 * Tests: GET /auth/users, PATCH /auth/users/:id/role
 *
 * Acceptance Criteria:
 *   Given a new faculty member joins,
 *   When I assign them the FACULTY role,
 *   Then they see their department's rooms.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authGet,
    authPatch,
    getAdminToken,
} from '../setup/testSetup.js';

beforeAll(async () => {
    await getAdminToken();
});

describe('US 5.4: User Role Management', () => {
    // =========================================================================
    // GET /api/v1/auth/users — List all users (Admin only)
    // =========================================================================
    describe('GET /api/v1/auth/users', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/auth/users');
            expect(res.status).toBe(401);
        });

        it('should return a list of users for admin', async () => {
            const res = await authGet('/api/v1/auth/users');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });

        it('should support pagination', async () => {
            const res = await authGet('/api/v1/auth/users?page=1&limit=5');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should support role filter', async () => {
            const res = await authGet('/api/v1/auth/users?role=ADMIN');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // =========================================================================
    // PATCH /api/v1/auth/users/:id/role — Update user role (Admin only)
    // =========================================================================
    describe('PATCH /api/v1/auth/users/:id/role', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request()
                .patch('/api/v1/auth/users/some-id/role')
                .send({ role: 'FACULTY' });

            expect(res.status).toBe(401);
        });

        it('should reject invalid role values', async () => {
            // Use a fake user ID — the validation should catch invalid role first
            const res = await authPatch('/api/v1/auth/users/00000000-0000-0000-0000-000000000001/role', {
                role: 'INVALID_ROLE',
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});
