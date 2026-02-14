/**
 * =============================================================================
 * Epic 6 US 5: Booking Reminder — Unit Tests
 * =============================================================================
 * Tests for the booking reminder cron job that sends notifications
 * 5 minutes before a booking starts.
 *
 * Acceptance Criteria:
 *   Given my booking is at 10:00,
 *   When it is 9:55,
 *   Then I receive a reminder notification via email and socket.
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const mockSendReminderEmail = vi.fn().mockResolvedValue(true);
const mockSendNotification = vi.fn();

const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('../../lib/supabase.js', () => ({
    supabase: {
        from: (...args: any[]) => mockFrom(...args),
    },
}));

vi.mock('../../config/index.js', () => ({
    config: {
        reminder: {
            minutesBefore: 5,
            cronSchedule: '*/1 * * * *',
        },
    },
}));

vi.mock('../../config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/socket.js', () => ({
    sendNotification: (...args: any[]) => mockSendNotification(...args),
}));

vi.mock('../../services/emailService.js', () => ({
    sendBookingReminderEmail: (...args: any[]) => mockSendReminderEmail(...args),
}));

// ─── Import after mocks ────────────────────────────────────────────────────
import { executeBookingReminder } from '../../jobs/bookingReminder.js';

// ─── Helpers ────────────────────────────────────────────────────────────────
function createUpcomingBooking(overrides: any = {}) {
    const now = new Date();
    return {
        id: 'booking-001',
        user_id: 'user-101',
        room_id: 'room-201',
        start_time: new Date(now.getTime() + 3 * 60 * 1000).toISOString(), // 3 min from now
        end_time: new Date(now.getTime() + 63 * 60 * 1000).toISOString(),
        title: 'Team Meeting',
        reminder_sent: false,
        users: { id: 'user-101', email: 'user@campus.edu', first_name: 'Jane', last_name: 'Smith' },
        rooms: { id: 'room-201', name: 'Conference Room A', code: 'CR-A' },
        ...overrides,
    };
}

function setupQueryMock(bookings: any[]) {
    // Build the Supabase query chain: from().select().eq().eq().gte().lte().or()
    const orMock = vi.fn().mockResolvedValue({ data: bookings, error: null });

    mockFrom.mockImplementation((table: string) => {
        if (table === 'bookings') {
            // Could be the SELECT query or the UPDATE query
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            gte: vi.fn().mockReturnValue({
                                lte: vi.fn().mockReturnValue({
                                    or: orMock,
                                }),
                            }),
                        }),
                    }),
                }),
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            };
        }
        return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
    });
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('Epic 6 US 5: Booking Reminder Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Reminder Execution', () => {
        it('should send email reminder for upcoming CONFIRMED bookings', async () => {
            const booking = createUpcomingBooking();
            setupQueryMock([booking]);

            const stats = await executeBookingReminder();

            expect(mockSendReminderEmail).toHaveBeenCalledWith(
                'user@campus.edu',
                'Jane Smith',
                expect.objectContaining({
                    bookingId: 'booking-001',
                    roomName: 'Conference Room A',
                    roomCode: 'CR-A',
                    startTime: booking.start_time,
                    endTime: booking.end_time,
                })
            );
            expect(stats.remindersSent).toBe(1);
        });

        it('should send socket notification for upcoming bookings', async () => {
            const booking = createUpcomingBooking();
            setupQueryMock([booking]);

            await executeBookingReminder();

            expect(mockSendNotification).toHaveBeenCalledWith(
                'user-101',
                expect.stringContaining('starts in 5 minutes'),
                'warning'
            );
        });

        it('should send reminders for multiple upcoming bookings', async () => {
            const booking1 = createUpcomingBooking({ id: 'booking-001', user_id: 'user-101' });
            const booking2 = createUpcomingBooking({
                id: 'booking-002',
                user_id: 'user-102',
                users: { id: 'user-102', email: 'user2@campus.edu', first_name: 'Bob', last_name: 'Jones' },
                rooms: { id: 'room-202', name: 'Lab 301', code: 'LB-301' },
            });

            setupQueryMock([booking1, booking2]);

            const stats = await executeBookingReminder();

            expect(mockSendReminderEmail).toHaveBeenCalledTimes(2);
            expect(mockSendNotification).toHaveBeenCalledTimes(2);
            expect(stats.remindersSent).toBe(2);
        });
    });

    describe('No Reminders Needed', () => {
        it('should return early when no upcoming bookings found', async () => {
            setupQueryMock([]);

            const stats = await executeBookingReminder();

            expect(stats.bookingsFound).toBe(0);
            expect(stats.remindersSent).toBe(0);
            expect(mockSendReminderEmail).not.toHaveBeenCalled();
            expect(mockSendNotification).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle database query errors gracefully', async () => {
            mockFrom.mockImplementation(() => ({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            gte: vi.fn().mockReturnValue({
                                lte: vi.fn().mockReturnValue({
                                    or: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
                                }),
                            }),
                        }),
                    }),
                }),
            }));

            const stats = await executeBookingReminder();

            expect(stats.errors).toBe(1);
            expect(stats.remindersSent).toBe(0);
        });

        it('should skip bookings with missing user data', async () => {
            const booking = createUpcomingBooking({ users: null });
            setupQueryMock([booking]);

            const stats = await executeBookingReminder();

            expect(stats.remindersSent).toBe(0);
            expect(mockSendReminderEmail).not.toHaveBeenCalled();
        });

        it('should skip bookings with missing room data', async () => {
            const booking = createUpcomingBooking({ rooms: null });
            setupQueryMock([booking]);

            const stats = await executeBookingReminder();

            expect(stats.remindersSent).toBe(0);
            expect(mockSendReminderEmail).not.toHaveBeenCalled();
        });
    });

    describe('Stats Reporting', () => {
        it('should report accurate stats on successful run', async () => {
            const booking = createUpcomingBooking();
            setupQueryMock([booking]);

            const stats = await executeBookingReminder();

            expect(stats.bookingsFound).toBe(1);
            expect(stats.remindersSent).toBe(1);
            expect(stats.errors).toBe(0);
            expect(stats.duration).toBeGreaterThanOrEqual(0);
            expect(stats.checkedAt).toBeInstanceOf(Date);
        });
    });
});
