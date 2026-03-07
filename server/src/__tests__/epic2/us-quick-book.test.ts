/**
 * =============================================================================
 * US 6: Quick-Book Suggestions (Pattern Learning) — Integration Tests
 * =============================================================================
 * Tests: GET /api/v1/bookings/quick-book-suggestions
 *
 * Acceptance Criteria:
 *   Given a frequent user has recurring booking patterns,
 *   When they request quick-book suggestions,
 *   Then they receive pre-filled booking options based on their history.
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

describe('US 6: Quick-Book Suggestions', () => {
    describe('GET /api/v1/bookings/quick-book-suggestions', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/bookings/quick-book-suggestions');
            expect(res.status).toBe(401);
        });

        it('should return suggestions structure for authenticated user', async () => {
            const res = await authGet('/api/v1/bookings/quick-book-suggestions');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.suggestions).toBeDefined();
            expect(Array.isArray(res.body.data.suggestions)).toBe(true);
            expect(res.body.data.analyzedBookings).toBeGreaterThanOrEqual(0);
            expect(res.body.data.periodDays).toBe(60);

            // Validate suggestion structure if any exist
            for (const suggestion of res.body.data.suggestions) {
                expect(suggestion.roomId).toBeDefined();
                expect(suggestion.roomName).toBeDefined();
                expect(suggestion.dayOfWeek).toBeGreaterThanOrEqual(0);
                expect(suggestion.dayOfWeek).toBeLessThanOrEqual(6);
                expect(suggestion.dayName).toBeDefined();
                expect(suggestion.frequency).toBeGreaterThanOrEqual(2);
                expect(suggestion.prefilled).toBeDefined();
                expect(suggestion.prefilled.roomId).toBeDefined();
                expect(suggestion.prefilled.startTime).toBeDefined();
                expect(suggestion.prefilled.endTime).toBeDefined();
            }
        });

        it('should accept custom days parameter', async () => {
            const res = await authGet('/api/v1/bookings/quick-book-suggestions?days=14');

            expect(res.status).toBe(200);
            expect(res.body.data.periodDays).toBe(14);
        });
    });
});
