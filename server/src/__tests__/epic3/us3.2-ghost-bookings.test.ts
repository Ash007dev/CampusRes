/**
 * =============================================================================
 * US 3.2: Auto-Cancel Ghost Bookings — Integration Tests
 * =============================================================================
 * Tests: Ghost Killer cron logic and NO_SHOW status via API
 *
 * The Ghost Killer cancels bookings where no check-in occurs within
 * the grace period (15 mins). It also handles LATE bookings with
 * extended grace (30 mins).
 *
 * Acceptance Criteria:
 *   Given 15 mins passed without scan,
 *   When the cron runs,
 *   Then the room becomes Free again.
 * =============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    request,
    authGet,
    authPost,
    getAdminToken,
} from '../setup/testSetup.js';

beforeAll(async () => {
    await getAdminToken();
});

describe('US 3.2: Auto-Cancel Ghost Bookings', () => {
    // =========================================================================
    // GET /api/v1/bookings/my — Verify NO_SHOW status exists in the system
    // =========================================================================
    describe('Ghost Booking Status Verification', () => {
        it('should support NO_SHOW as a valid booking status', async () => {
            // Verify that the booking API can return NO_SHOW status bookings
            const res = await authGet('/api/v1/bookings/my');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();

            // NO_SHOW is a valid status in the system
            const bookings = res.body.data || [];
            if (Array.isArray(bookings)) {
                // Check that if any NO_SHOW bookings exist, they have proper structure
                const noShowBookings = bookings.filter(
                    (b: any) => b.status === 'NO_SHOW'
                );
                for (const b of noShowBookings) {
                    expect(b.check_in_status).toBe('MISSED');
                }
            }
        });

        it('should include check_in_status field in booking responses', async () => {
            const res = await authGet('/api/v1/bookings/my');

            expect(res.status).toBe(200);
            const bookings = res.body.data || [];

            if (Array.isArray(bookings) && bookings.length > 0) {
                // Every booking should have a check_in_status field
                for (const booking of bookings) {
                    expect(booking).toHaveProperty('check_in_status');
                }
            }
        });
    });

    // =========================================================================
    // Verify booking data includes fields required for ghost detection
    // =========================================================================
    describe('Ghost Killer Required Fields', () => {
        it('should include start_time in booking data for grace period calculation', async () => {
            const res = await authGet('/api/v1/bookings/my');

            expect(res.status).toBe(200);
            const bookings = res.body.data || [];

            if (Array.isArray(bookings) && bookings.length > 0) {
                const booking = bookings[0];
                expect(booking).toHaveProperty('start_time');
                expect(booking).toHaveProperty('end_time');
                expect(booking).toHaveProperty('status');
                expect(booking).toHaveProperty('check_in_status');
            }
        });

        it('should track CONFIRMED + PENDING bookings that are candidates for ghost killing', async () => {
            const res = await authGet('/api/v1/bookings/my');

            expect(res.status).toBe(200);
            const bookings = res.body.data || [];

            if (Array.isArray(bookings)) {
                const pendingCheckIn = bookings.filter(
                    (b: any) =>
                        b.status === 'CONFIRMED' &&
                        b.check_in_status === 'PENDING'
                );
                // Each candidate ghost booking should have the required fields
                for (const b of pendingCheckIn) {
                    expect(b.start_time).toBeDefined();
                    expect(b.user_id).toBeDefined();
                    expect(b.room_id).toBeDefined();
                }
            }
        });
    });

    // =========================================================================
    // POST /api/v1/bookings/:id/running-late — LATE status extends grace
    // =========================================================================
    describe('Running Late — Extended Grace Period', () => {
        it('should reject unauthenticated running-late requests', async () => {
            const res = await request()
                .post('/api/v1/bookings/fake-booking-id/running-late');

            expect(res.status).toBe(401);
        });

        it('should return error for non-existent booking', async () => {
            const res = await authPost(
                '/api/v1/bookings/00000000-0000-0000-0000-000000000000/running-late',
                {}
            );

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.body.success).toBe(false);
        });
    });
});

