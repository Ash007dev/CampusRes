/**
 * =============================================================================
 * US 2.4: Underutilized Rooms — Integration Tests
 * =============================================================================
 * Tests: GET /api/v1/admin/underutilized-rooms
 *
 * Acceptance Criteria:
 *   Given an admin wants to view underutilized rooms,
 *   When they request the report,
 *   Then they see rooms with utilization %, trends, and suggestions.
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

describe('US 2.4: Underutilized Rooms', () => {
    describe('GET /api/v1/admin/underutilized-rooms', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/admin/underutilized-rooms');
            expect(res.status).toBe(401);
        });

        it('should return underutilized rooms report', async () => {
            const res = await authGet('/api/v1/admin/underutilized-rooms');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.rooms).toBeDefined();
            expect(Array.isArray(res.body.data.rooms)).toBe(true);
            expect(res.body.data.threshold).toBe(30);
            expect(res.body.data.periodDays).toBe(30);
            expect(res.body.data.generatedAt).toBeDefined();

            // Validate room structure
            for (const room of res.body.data.rooms) {
                expect(room.roomId).toBeDefined();
                expect(room.roomName).toBeDefined();
                expect(room.utilizationPercent).toBeGreaterThanOrEqual(0);
                expect(room.utilizationPercent).toBeLessThan(30); // Below threshold
                expect(room.weeklyTrend).toBeDefined();
                expect(Array.isArray(room.weeklyTrend)).toBe(true);
                expect(room.suggestion).toBeDefined();
                expect(typeof room.suggestion).toBe('string');
            }
        });

        it('should accept custom threshold and days parameters', async () => {
            const res = await authGet('/api/v1/admin/underutilized-rooms?days=14&threshold=50');

            expect(res.status).toBe(200);
            expect(res.body.data.threshold).toBe(50);
            expect(res.body.data.periodDays).toBe(14);
        });
    });
});
