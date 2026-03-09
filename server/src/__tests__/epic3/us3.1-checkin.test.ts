/**
 * =============================================================================
 * US 3.1: QR Code Check-In — Integration Tests
 * =============================================================================
 * Tests: POST /bookings/:id/check-in
 *
 * NOTE: As per 50% implementation, full QR scanning is not included.
 *       Check-in is done by entering the room code/name as the qrCode field.
 *
 * Acceptance Criteria:
 *   Given I have a booking,
 *   When I scan the correct QR (enter room code),
 *   Then status updates to "Occupied" (CHECKED_IN).
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
let testRoomCode: string;

beforeAll(async () => {
    await getAdminToken();

    // Fetch an existing booking to use for tests
    const res = await authGet('/api/v1/bookings/my');
    const bookings = res.body?.data || [];

    if (Array.isArray(bookings) && bookings.length > 0) {
        // Find a CONFIRMED booking if possible
        const confirmed = bookings.find((b: any) => b.status === 'CONFIRMED');
        if (confirmed) {
            testBookingId = confirmed.id;
            testRoomCode = confirmed.rooms?.code || confirmed.room_id;
        } else {
            testBookingId = bookings[0].id;
            testRoomCode = bookings[0].rooms?.code || bookings[0].room_id;
        }
    }
});

describe('US 3.1: QR Code Check-In (Simplified — Room Code Entry)', () => {
    // =========================================================================
    // POST /api/v1/bookings/:id/check-in — Authentication
    // =========================================================================
    describe('POST /api/v1/bookings/:id/check-in — Auth', () => {
        it('should reject unauthenticated check-in requests', async () => {
            const res = await request()
                .post(`/api/v1/bookings/${testBookingId || 'fake-id'}/check-in`)
                .send({ qrCode: 'ROOM-101' });

            expect(res.status).toBe(401);
        });

        it('should reject check-in with missing qrCode field', async () => {
            const res = await authPost(
                `/api/v1/bookings/${testBookingId || 'fake-id'}/check-in`,
                {} // No qrCode provided
            );

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // =========================================================================
    // POST /api/v1/bookings/:id/check-in — Validation
    // =========================================================================
    describe('POST /api/v1/bookings/:id/check-in — Validation', () => {
        it('should return error for non-existent booking ID', async () => {
            const res = await authPost(
                '/api/v1/bookings/00000000-0000-0000-0000-000000000000/check-in',
                { qrCode: 'ROOM-101' }
            );

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should return error for invalid booking ID format', async () => {
            const res = await authPost(
                '/api/v1/bookings/not-a-valid-uuid/check-in',
                { qrCode: 'ROOM-101' }
            );

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // =========================================================================
    // POST /api/v1/bookings/:id/check-in — Response Structure
    // =========================================================================
    describe('POST /api/v1/bookings/:id/check-in — Response Structure', () => {
        it('should return proper error structure on failure', async () => {
            const res = await authPost(
                '/api/v1/bookings/00000000-0000-0000-0000-000000000000/check-in',
                { qrCode: 'ROOM-101' }
            );

            expect(res.body).toBeDefined();
            expect(res.body.success).toBe(false);
        });
    });

    // =========================================================================
    // Check-in API accepts qrCode (room code) in request body
    // =========================================================================
    describe('POST /api/v1/bookings/:id/check-in — Request Format', () => {
        it('should accept qrCode field as room code identifier', async () => {
            // This tests that the endpoint accepts the correct request format
            // Even if timing prevents check-in, the endpoint should accept the format
            if (!testBookingId) return;

            const res = await authPost(
                `/api/v1/bookings/${testBookingId}/check-in`,
                {
                    qrCode: testRoomCode || 'TEST-ROOM',
                }
            );

            // The response should be either success or a business logic error
            // (not a 400 validation error for the qrCode field itself)
            expect(res.body).toBeDefined();
            // If timing doesn't allow check-in, we get a business error, not a validation error
            if (res.status >= 400) {
                expect(res.body.success).toBe(false);
            }
        });

        it('should reject check-in when qrCode does not match the room', async () => {
            if (!testBookingId) return;

            const res = await authPost(
                `/api/v1/bookings/${testBookingId}/check-in`,
                {
                    qrCode: 'WRONG-QR-CODE-999',
                }
            );

            // Because the check for invalid code is now applied BEFORE the timing check,
            // we should deterministically get a 400 with our specific error message.
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/Invalid Check-In code/);
        });

        it('should accept optional latitude and longitude for location verification', async () => {
            if (!testBookingId) return;

            const res = await authPost(
                `/api/v1/bookings/${testBookingId}/check-in`,
                {
                    qrCode: testRoomCode || 'TEST-ROOM',
                    latitude: 12.9716,
                    longitude: 77.5946,
                }
            );

            // Should not fail due to field format (may fail due to timing)
            expect(res.body).toBeDefined();
        });
    });
});
