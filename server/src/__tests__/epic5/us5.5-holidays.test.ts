/**
 * =============================================================================
 * US 5.5: Holiday Calendar — Integration Tests
 * =============================================================================
 * Tests: GET /holidays, POST /holidays, PATCH /holidays/:id, DELETE /holidays/:id
 *
 * Acceptance Criteria:
 *   Given a public holiday falls on Monday,
 *   When I block that date,
 *   Then no booking slots appear.
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
} from '../setup/testSetup.js';

let createdHolidayId: string;

// Use a far-future date to avoid conflicts with real holidays
const testDate = '2030-12-25';
const testHolidayName = `Test Holiday ${Date.now()}`;

beforeAll(async () => {
    await getAdminToken();
});

afterAll(async () => {
    // Cleanup: delete the test holiday
    if (createdHolidayId) {
        try {
            await authDelete(`/api/v1/holidays/${createdHolidayId}`);
        } catch {
            // Ignore cleanup errors
        }
    }
});

describe('US 5.5: Holiday Calendar', () => {
    // =========================================================================
    // POST /api/v1/holidays — Create a holiday (Admin only)
    // =========================================================================
    describe('POST /api/v1/holidays', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request()
                .post('/api/v1/holidays')
                .send({
                    name: testHolidayName,
                    date: testDate,
                    type: 'PUBLIC_HOLIDAY',
                });

            expect(res.status).toBe(401);
        });

        it('should create a new holiday with valid data', async () => {
            const res = await authPost('/api/v1/holidays', {
                name: testHolidayName,
                date: testDate,
                type: 'PUBLIC_HOLIDAY',
                description: 'Test holiday for integration tests',
            });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.name).toBe(testHolidayName);

            createdHolidayId = res.body.data.id;
        });

        it('should reject missing required fields', async () => {
            const res = await authPost('/api/v1/holidays', {
                // Missing: name, date
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // =========================================================================
    // GET /api/v1/holidays — List holidays
    // =========================================================================
    describe('GET /api/v1/holidays', () => {
        it('should return a list of holidays', async () => {
            const res = await authGet('/api/v1/holidays');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });
    });

    // =========================================================================
    // GET /api/v1/holidays/check?date= — Check if a date is a holiday
    // =========================================================================
    describe('GET /api/v1/holidays/check', () => {
        it('should confirm the test date is a holiday', async () => {
            const res = await authGet(`/api/v1/holidays/check/${testDate}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isHoliday).toBe(true);
        });

        it('should confirm a non-holiday date is NOT a holiday', async () => {
            const res = await authGet('/api/v1/holidays/check/2030-06-15');

            expect(res.status).toBe(200);
            expect(res.body.data.isHoliday).toBe(false);
        });
    });

    // =========================================================================
    // PATCH /api/v1/holidays/:id — Update a holiday (Admin only)
    // =========================================================================
    describe('PATCH /api/v1/holidays/:id', () => {
        it('should update the holiday name', async () => {
            expect(createdHolidayId).toBeDefined();

            const updatedName = `Updated ${testHolidayName}`;
            const res = await authPatch(`/api/v1/holidays/${createdHolidayId}`, {
                name: updatedName,
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe(updatedName);
        });
    });

    // =========================================================================
    // DELETE /api/v1/holidays/:id — Delete a holiday (Admin only)
    // =========================================================================
    describe('DELETE /api/v1/holidays/:id', () => {
        it('should delete the holiday', async () => {
            expect(createdHolidayId).toBeDefined();

            const res = await authDelete(`/api/v1/holidays/${createdHolidayId}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Clear so afterAll doesn't try to delete again
            createdHolidayId = '';
        });

        it('should confirm the date is no longer a holiday', async () => {
            const res = await authGet(`/api/v1/holidays/check/${testDate}`);

            expect(res.status).toBe(200);
            expect(res.body.data.isHoliday).toBe(false);
        });
    });
});
