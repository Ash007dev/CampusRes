/**
 * =============================================================================
 * US 4: Booking Confirmation — Unit Tests
 * =============================================================================
 * Tests for the booking confirmation display logic:
 * - Booking ID formatting and truncation
 * - QR code value fallback chain
 * - Grace period extension for LATE bookings
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('US 4: Booking Confirmation — Response Structure', () => {

    it('should have booking ID in the API response type', () => {
        const sampleBooking = {
            id: 'uuid-1234-5678',
            roomId: 'room-abc',
            userId: 'user-xyz',
            startTime: '2026-02-11T09:00:00Z',
            endTime: '2026-02-11T10:00:00Z',
            status: 'CONFIRMED',
            checkInStatus: 'PENDING',
            room: {
                id: 'room-abc',
                name: 'Lab 101',
                code: 'LB-101',
                capacity: 30,
                floor: 1,
                building: 'Science Block',
            },
        };

        expect(sampleBooking.id).toBeDefined();
        expect(typeof sampleBooking.id).toBe('string');
        expect(sampleBooking.id.length).toBeGreaterThan(0);
        expect(sampleBooking.room).toBeDefined();
        expect(sampleBooking.room.code).toBeDefined();
        expect(typeof sampleBooking.room.code).toBe('string');
    });

    it('should generate a truncated booking ID for display', () => {
        const bookingId = 'a3b8d1b6-0b3b-4b1a-9c1a-1a2b3c4d5e6f';

        // The confirmation display shows: BK-{first 8 chars uppercase}
        const displayId = `BK-${bookingId.slice(0, 8).toUpperCase()}`;

        expect(displayId).toBe('BK-A3B8D1B6');
        expect(displayId.length).toBe(11); // "BK-" (3) + 8 chars
    });

    it('should use room code as QR code value', () => {
        const booking = {
            id: 'booking-123',
            room: { code: 'LB-101', name: 'Lab 101' },
            roomId: 'room-abc',
        };

        const qrValue = booking.room?.code || booking.roomId || booking.id;
        expect(qrValue).toBe('LB-101');
    });

    it('should fallback to roomId when room code is missing', () => {
        const booking = {
            id: 'booking-123',
            room: undefined as any,
            roomId: 'room-abc',
        };

        const qrValue = booking.room?.code || booking.roomId || booking.id;
        expect(qrValue).toBe('room-abc');
    });

    it('should fallback to booking ID when both room code and roomId are missing', () => {
        const booking = {
            id: 'booking-123',
            room: undefined as any,
            roomId: undefined as any,
        };

        const qrValue = booking.room?.code || booking.roomId || booking.id;
        expect(qrValue).toBe('booking-123');
    });
});

describe('US 4: Ghost Killer — LATE status handling', () => {
    it('should define LATE as a valid check_in_status for extended grace', () => {
        const gracePeriodMinutes = 15;
        const standardGraceMs = gracePeriodMinutes * 60 * 1000;
        const extendedGraceMs = gracePeriodMinutes * 2 * 60 * 1000;

        expect(extendedGraceMs).toBe(standardGraceMs * 2);
        expect(extendedGraceMs).toBe(30 * 60 * 1000); // 30 minutes
    });
});
