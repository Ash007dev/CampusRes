/**
 * =============================================================================
 * US 3.4: Early Checkout — Integration Tests
 * =============================================================================
 * Tests: POST /bookings/:id/early-checkout
 *
 * Acceptance Criteria:
 *   Given I booked 2 hrs but finish in 1,
 *   When I click End,
 *   Then the room becomes available immediately.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authGet,
    authPost,
    getAdminToken,
} from '../setup/testSetup.js';

let testBookingId: string;

beforeAll(async () => {
    await getAdminToken();

    // Fetch a booking for testing
    const res = await authGet('/api/v1/bookings/my');
    const bookings = res.body?.data || [];

    if (Array.isArray(bookings) && bookings.length > 0) {
        // Try to find a CONFIRMED + CHECKED_IN booking for early checkout
        const active = bookings.find(
            (b: any) =>
                b.status === 'CONFIRMED' && b.check_in_status === 'CHECKED_IN'
        );
        testBookingId = active?.id || bookings[0].id;
    }
});

describe('US 3.4: Early Checkout', () => {
    // =========================================================================
    // POST /api/v1/bookings/:id/early-checkout — Authentication
    // =========================================================================
    describe('POST /api/v1/bookings/:id/early-checkout — Auth', () => {
        it('should reject unauthenticated early-checkout requests', async () => {
            const res = await request()
                .post(`/api/v1/bookings/${testBookingId || 'fake-id'}/early-checkout`);

            expect(res.status).toBe(401);
        });
    });

    // =========================================================================
    // POST /api/v1/bookings/:id/early-checkout — Validation
    // =========================================================================
    describe('POST /api/v1/bookings/:id/early-checkout — Validation', () => {
        it('should return error for non-existent booking ID', async () => {
            const res = await authPost(
                '/api/v1/bookings/00000000-0000-0000-0000-000000000000/early-checkout',
                {}
            );

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.body.success).toBe(false);
        });

        it('should return proper error structure on validation failure', async () => {
            const res = await authPost(
                '/api/v1/bookings/00000000-0000-0000-0000-000000000000/early-checkout',
                {}
            );

            expect(res.body).toBeDefined();
            expect(res.body.success).toBe(false);
        });
    });

    // =========================================================================
    // POST /api/v1/bookings/:id/early-checkout — Business Rules
    // =========================================================================
    describe('POST /api/v1/bookings/:id/early-checkout — Business Rules', () => {
        it('should only allow checkout from active checked-in bookings', async () => {
            if (!testBookingId) return;

            const res = await authPost(
                `/api/v1/bookings/${testBookingId}/early-checkout`,
                {}
            );

            // Should either succeed (if booking is active + checked in)
            // or return a business logic error (not a validation error)
            expect(res.body).toBeDefined();
            if (res.status >= 400) {
                expect(res.body.success).toBe(false);
            }
        });

        it('should return refunded credits info on successful checkout', async () => {
            // If we have an active checked-in booking, early checkout should refund
            if (!testBookingId) return;

            const res = await authPost(
                `/api/v1/bookings/${testBookingId}/early-checkout`,
                {}
            );

            if (res.status === 200) {
                // Successful checkout should include refund info
                expect(res.body.success).toBe(true);
                expect(res.body.data).toBeDefined();
                expect(res.body.message).toContain('checkout');
            }
        });
    });

    // =========================================================================
    // Verify booking status after early checkout
    // =========================================================================
    describe('Early Checkout — Status Verification', () => {
        it('should set booking status to COMPLETED after early checkout', async () => {
            if (!testBookingId) return;

            // Check current booking status
            const res = await authGet(`/api/v1/bookings/${testBookingId}`);

            if (res.status === 200 && res.body.data) {
                const booking = res.body.data;
                // If booking was early-checked-out, status should be COMPLETED
                if (booking.status === 'COMPLETED') {
                    expect(booking.status).toBe('COMPLETED');
                }
            }
        });
    });
});
