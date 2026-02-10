/**
 * =============================================================================
 * US 5.9: System Configuration — Integration Tests
 * =============================================================================
 * Tests: GET /config, POST /config, PATCH /config/:key, DELETE /config/:key
 *
 * Acceptance Criteria:
 *   Given I need to change the booking window,
 *   When I update the system configuration,
 *   Then the new settings take effect.
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

const testConfigKey = `test_cfg_${Date.now()}`;

beforeAll(async () => {
    await getAdminToken();
});

afterAll(async () => {
    try {
        await authDelete(`/api/v1/config/${testConfigKey}`);
    } catch {
        // Ignore
    }
});

describe('US 5.9: System Configuration', () => {
    // =========================================================================
    // POST /api/v1/config — Create config
    // =========================================================================
    describe('POST /api/v1/config', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request()
                .post('/api/v1/config')
                .send({ key: 'test', value: '1', description: 'test' });

            expect(res.status).toBe(401);
        });

        it('should create a new config entry', async () => {
            const res = await authPost('/api/v1/config', {
                key: testConfigKey,
                value: '42',
                dataType: 'number',
                category: 'booking',
                description: 'Test config entry for US 5.9',
                isPublic: true,
            });

            expect(res.status).toBeLessThan(300);
            expect(res.body.success).toBe(true);
        });
    });

    // =========================================================================
    // GET /api/v1/config — List all configuration
    // =========================================================================
    describe('GET /api/v1/config', () => {
        it('should return all config entries for admin', async () => {
            const res = await authGet('/api/v1/config');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });
    });

    // =========================================================================
    // GET /api/v1/config/:key — Get specific config
    // =========================================================================
    describe('GET /api/v1/config/:key', () => {
        it('should return the specific config value', async () => {
            const res = await authGet(`/api/v1/config/${testConfigKey}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // =========================================================================
    // GET /api/v1/config/booking/constraints — Public booking constraints
    // =========================================================================
    describe('GET /api/v1/config/booking/constraints', () => {
        it('should return booking constraints without auth', async () => {
            const res = await request().get('/api/v1/config/booking/constraints');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // =========================================================================
    // PATCH /api/v1/config/:key — Update config
    // =========================================================================
    describe('PATCH /api/v1/config/:key', () => {
        it('should update the config value', async () => {
            const res = await authPatch(`/api/v1/config/${testConfigKey}`, {
                value: '99',
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // =========================================================================
    // DELETE /api/v1/config/:key — Delete config
    // =========================================================================
    describe('DELETE /api/v1/config/:key', () => {
        it('should delete the config entry', async () => {
            const res = await authDelete(`/api/v1/config/${testConfigKey}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
