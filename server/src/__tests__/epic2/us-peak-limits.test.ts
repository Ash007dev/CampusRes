/**
 * =============================================================================
 * US 9: Peak Hour Limits — Integration Tests
 * =============================================================================
 * Tests: GET /api/v1/admin/peak-hour-config
 *        PUT /api/v1/admin/peak-hour-config
 *
 * Acceptance Criteria:
 *   Given an admin wants stricter booking limits during peak hours,
 *   When they configure the limits,
 *   Then the system enforces reduced quotas during peak time slots.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authGet,
    authPut,
    getAdminToken,
} from '../setup/testSetup.js';

beforeAll(async () => {
    await getAdminToken();
});

describe('US 9: Peak Hour Limits', () => {
    describe('GET /api/v1/admin/peak-hour-config', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/admin/peak-hour-config');
            expect(res.status).toBe(401);
        });

        it('should return current peak hour configuration', async () => {
            const res = await authGet('/api/v1/admin/peak-hour-config');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.peakHoursStart).toBeDefined();
            expect(res.body.data.peakHoursEnd).toBeDefined();
            expect(res.body.data.peakMaxBookingHours).toBeGreaterThan(0);
            expect(res.body.data.peakMaxBookingsPerDay).toBeGreaterThan(0);
            expect(res.body.data.peakCreditMultiplier).toBeGreaterThan(0);
        });
    });

    describe('PUT /api/v1/admin/peak-hour-config', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request()
                .put('/api/v1/admin/peak-hour-config')
                .send({ peakMaxBookingHours: 3 });
            expect(res.status).toBe(401);
        });

        it('should require at least one field', async () => {
            const res = await authPut('/api/v1/admin/peak-hour-config', {});

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should update peak hour config and return new values', async () => {
            const res = await authPut('/api/v1/admin/peak-hour-config', {
                peakMaxBookingHours: 3,
                peakMaxBookingsPerDay: 3,
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.peakMaxBookingHours).toBe(3);
            expect(res.body.data.peakMaxBookingsPerDay).toBe(3);
        });
    });
});
