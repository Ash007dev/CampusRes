/**
 * =============================================================================
 * US 2.1: Forecast Visualization — Integration Tests
 * =============================================================================
 * Tests: GET /api/v1/admin/demand-forecast
 *
 * Acceptance Criteria:
 *   Given historical booking data exists,
 *   When an admin requests the demand forecast,
 *   Then they see a 7×24 matrix of predicted demand per day/hour.
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

describe('US 2.1: Demand Forecast', () => {
    describe('GET /api/v1/admin/demand-forecast', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/admin/demand-forecast');
            expect(res.status).toBe(401);
        });

        it('should return forecast data with 7-day × 24-hour structure', async () => {
            const res = await authGet('/api/v1/admin/demand-forecast');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.forecast).toBeDefined();
            expect(res.body.data.forecast).toHaveLength(7);

            // Each day should have 24 hourly entries
            for (const day of res.body.data.forecast) {
                expect(day.dayOfWeek).toBeGreaterThanOrEqual(0);
                expect(day.dayOfWeek).toBeLessThanOrEqual(6);
                expect(day.dayName).toBeDefined();
                expect(day.hourlyDemand).toHaveLength(24);

                for (const hour of day.hourlyDemand) {
                    expect(hour.hour).toBeGreaterThanOrEqual(0);
                    expect(hour.hour).toBeLessThanOrEqual(23);
                    expect(hour.avgBookings).toBeGreaterThanOrEqual(0);
                    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(hour.peakLabel);
                }
            }

            // Meta fields
            expect(res.body.data.totalBookingsAnalyzed).toBeGreaterThanOrEqual(0);
            expect(res.body.data.periodDays).toBe(30);
            expect(res.body.data.generatedAt).toBeDefined();
        });

        it('should accept custom days parameter', async () => {
            const res = await authGet('/api/v1/admin/demand-forecast?days=7');

            expect(res.status).toBe(200);
            expect(res.body.data.periodDays).toBe(7);
        });
    });
});
