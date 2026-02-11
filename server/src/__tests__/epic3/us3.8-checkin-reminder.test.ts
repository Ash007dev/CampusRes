/**
 * =============================================================================
 * US 3.8: Check-In Reminder — Integration Tests
 * =============================================================================
 * Tests: Reminder scheduling and booking data for reminders
 *
 * The reminder is a scheduled job (BullMQ) that runs at Start_Time - 5 mins.
 * Integration tests verify that booking data supports reminder functionality.
 *
 * Acceptance Criteria:
 *   Given my booking is at 10:00,
 *   When it is 9:55,
 *   Then my phone vibrates with reminder.
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

describe('US 3.8: Check-In Reminder', () => {
    // =========================================================================
    // Booking data supports reminder scheduling
    // =========================================================================
    describe('Booking Data for Reminder Scheduling', () => {
        it('should include start_time in booking data for scheduling reminders', async () => {
            const res = await authGet('/api/v1/bookings/my');

            expect(res.status).toBe(200);
            const bookings = res.body.data || [];

            if (Array.isArray(bookings) && bookings.length > 0) {
                const booking = bookings[0];
                expect(booking).toHaveProperty('start_time');
                // start_time should be a valid ISO datetime
                expect(new Date(booking.start_time).getTime()).not.toBeNaN();
            }
        });

        it('should include user_id for directing reminder to correct user', async () => {
            const res = await authGet('/api/v1/bookings/my');

            expect(res.status).toBe(200);
            const bookings = res.body.data || [];

            if (Array.isArray(bookings) && bookings.length > 0) {
                const booking = bookings[0];
                expect(booking).toHaveProperty('user_id');
            }
        });

        it('should include room details for reminder message content', async () => {
            const res = await authGet('/api/v1/bookings/my');

            expect(res.status).toBe(200);
            const bookings = res.body.data || [];

            if (Array.isArray(bookings) && bookings.length > 0) {
                const booking = bookings[0];
                // Room info should be available for "Scan QR in 5 mins to keep slot" message
                expect(booking.room_id || booking.rooms).toBeDefined();
            }
        });
    });

    // =========================================================================
    // CONFIRMED bookings with PENDING check-in are reminder candidates
    // =========================================================================
    describe('Reminder Candidate Identification', () => {
        it('should identify CONFIRMED + PENDING bookings as reminder candidates', async () => {
            const res = await authGet('/api/v1/bookings/my');

            expect(res.status).toBe(200);
            const bookings = res.body.data || [];

            if (Array.isArray(bookings)) {
                const reminderCandidates = bookings.filter(
                    (b: any) =>
                        b.status === 'CONFIRMED' &&
                        b.check_in_status === 'PENDING'
                );

                // Each candidate should have the fields needed to schedule a reminder
                for (const b of reminderCandidates) {
                    expect(b.start_time).toBeDefined();
                    expect(b.user_id).toBeDefined();
                    expect(b.id).toBeDefined();

                    // Verify reminder can be calculated: start_time - 5 minutes
                    const reminderTime = new Date(
                        new Date(b.start_time).getTime() - 5 * 60 * 1000
                    );
                    expect(reminderTime.getTime()).not.toBeNaN();
                    expect(reminderTime < new Date(b.start_time)).toBe(true);
                }
            }
        });
    });

    // =========================================================================
    // GET /api/v1/bookings/:id — Individual booking has reminder-needed data
    // =========================================================================
    describe('Individual Booking Reminder Data', () => {
        it('should return full booking details needed for reminder via GET', async () => {
            const listRes = await authGet('/api/v1/bookings/my');

            if (listRes.body.data && listRes.body.data.length > 0) {
                const bookingId = listRes.body.data[0].id;
                const res = await authGet(`/api/v1/bookings/${bookingId}`);

                expect(res.status).toBe(200);
                expect(res.body.success).toBe(true);
                expect(res.body.data).toBeDefined();
                expect(res.body.data.start_time).toBeDefined();
                expect(res.body.data.status).toBeDefined();
                expect(res.body.data.check_in_status).toBeDefined();
            }
        });
    });
});
