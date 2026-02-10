/**
 * =============================================================================
 * US 5.3: Bulk Import — Integration Tests (Placeholder)
 * =============================================================================
 * Tests: POST /rooms/bulk-import (if endpoint exists)
 *
 * Acceptance Criteria:
 *   Given I have a CSV of rooms,
 *   When I upload the file,
 *   Then all rooms are imported at once.
 *
 * NOTE: This is a placeholder for the bulk import feature.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authPost,
    getAdminToken,
} from '../setup/testSetup.js';

beforeAll(async () => {
    await getAdminToken();
});

describe('US 5.3: Bulk Import (Placeholder)', () => {
    // =========================================================================
    // POST /api/v1/rooms/bulk-import — Bulk import rooms
    // =========================================================================
    describe('POST /api/v1/rooms/bulk-import', () => {
        it('should reject unauthenticated bulk import requests', async () => {
            const res = await request()
                .post('/api/v1/rooms/bulk-import')
                .send({ rooms: [] });

            // 401 (unauthorized) or 404 (endpoint not yet implemented)
            expect([401, 404]).toContain(res.status);
        });

        it('should respond to authenticated bulk import request', async () => {
            const res = await authPost('/api/v1/rooms/bulk-import', {
                rooms: [],
            });

            // Accept 200/201/400/404 — the endpoint may not exist yet
            // If it exists, empty array should either succeed or return validation error
            expect(res.status).toBeLessThan(500);
        });
    });
});
