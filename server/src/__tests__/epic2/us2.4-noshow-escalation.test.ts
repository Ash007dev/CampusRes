/**
 * =============================================================================
 * US 4 (Escalation): No-Show Escalation — Integration Tests
 * =============================================================================
 * Tests: GET /api/v1/admin/no-show-report, POST /api/v1/admin/no-show-reset/:userId
 *
 * Acceptance Criteria:
 *   Given an admin wants to track no-show frequency,
 *   When they request the no-show report,
 *   Then they see users with no-show history, current tier, and block status.
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

describe('US 4: No-Show Escalation', () => {
    describe('GET /api/v1/admin/no-show-report', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().get('/api/v1/admin/no-show-report');
            expect(res.status).toBe(401);
        });

        it('should return no-show report with user data', async () => {
            const res = await authGet('/api/v1/admin/no-show-report');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(Array.isArray(res.body.data)).toBe(true);

            // Validate entry structure (if any users have no-shows)
            for (const entry of res.body.data) {
                expect(entry.userId).toBeDefined();
                expect(entry.email).toBeDefined();
                expect(entry.noShowCount).toBeGreaterThan(0);
                expect(entry.noShowTier).toBeGreaterThanOrEqual(0);
                expect(entry.noShowTier).toBeLessThanOrEqual(4);
                expect(entry.reputationScore).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('POST /api/v1/admin/no-show-reset/:userId', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request().post('/api/v1/admin/no-show-reset/some-user-id');
            expect(res.status).toBe(401);
        });
    });
});
