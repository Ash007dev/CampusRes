/**
 * =============================================================================
 * US 5.8: Feedback Review — Integration Tests
 * =============================================================================
 * Tests: GET /feedback, POST /feedback, DELETE /feedback/:id
 *
 * Acceptance Criteria:
 *   Given students rate their booking experience,
 *   When I view the dashboard,
 *   Then I see trends in satisfaction.
 * =============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    request,
    authGet,
    authPost,
    authDelete,
    getAdminToken,
} from '../setup/testSetup.js';

let createdFeedbackId: string;
let testRoomId: string;

beforeAll(async () => {
    await getAdminToken();

    // Fetch a valid room ID for feedback
    const res = await authGet('/api/v1/rooms');
    const rooms = res.body?.data?.rooms || res.body?.data || [];
    if (Array.isArray(rooms) && rooms.length > 0) {
        testRoomId = rooms[0].id;
    }
});

afterAll(async () => {
    if (createdFeedbackId) {
        try {
            await authDelete(`/api/v1/feedback/${createdFeedbackId}`);
        } catch {
            // Ignore
        }
    }
});

describe('US 5.8: Feedback Review', () => {
    // =========================================================================
    // POST /api/v1/feedback — Submit feedback
    // =========================================================================
    describe('POST /api/v1/feedback', () => {
        it('should reject unauthenticated requests', async () => {
            const res = await request()
                .post('/api/v1/feedback')
                .send({ rating: 5, comment: 'Great room!', roomId: testRoomId });

            expect(res.status).toBe(401);
        });

        it('should submit feedback with valid data', async () => {
            const res = await authPost('/api/v1/feedback', {
                roomId: testRoomId,
                category: 'EQUIPMENT',
                title: `Test Feedback ${Date.now()}`,
                description: 'Automated test feedback entry for US 5.8.',
                priority: 'MEDIUM',
            });

            // Accept 201 (created) or 200 (ok)
            expect(res.status).toBeLessThan(300);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();

            createdFeedbackId = res.body.data.id;
        });
    });

    // =========================================================================
    // GET /api/v1/feedback — List all feedback (Admin)
    // =========================================================================
    describe('GET /api/v1/feedback', () => {
        it('should return a list of feedback for admin', async () => {
            const res = await authGet('/api/v1/feedback');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });
    });

    // =========================================================================
    // GET /api/v1/feedback/stats — Feedback statistics
    // =========================================================================
    describe('GET /api/v1/feedback/stats', () => {
        it('should return feedback statistics', async () => {
            const res = await authGet('/api/v1/feedback/stats');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // =========================================================================
    // DELETE /api/v1/feedback/:id — Delete feedback (Admin)
    // =========================================================================
    describe('DELETE /api/v1/feedback/:id', () => {
        it('should delete the feedback', async () => {
            expect(createdFeedbackId).toBeDefined();

            const res = await authDelete(`/api/v1/feedback/${createdFeedbackId}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            createdFeedbackId = ''; // Prevent double-delete in afterAll
        });
    });
});
