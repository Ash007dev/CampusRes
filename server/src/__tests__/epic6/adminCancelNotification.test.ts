/**
 * =============================================================================
 * Epic 6 US 6: Admin Cancellation Notification — Unit Tests
 * =============================================================================
 * Tests that when an admin cancels a user's booking, the booking owner
 * receives an email notification and a real-time socket notification.
 * 
 * Acceptance Criteria:
 *   Given an admin cancels my booking,
 *   When the cancellation completes,
 *   Then I receive an email and a real-time notification with the reason.
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ───────────────────────────────────────────────────────────
const mockFrom = vi.fn();

vi.mock('../../lib/supabase.js', () => ({
    supabase: {
        from: (...args: any[]) => mockFrom(...args),
    },
}));

// ─── Mock Config ─────────────────────────────────────────────────────────────
vi.mock('../../config/index.js', () => ({
    config: {
        ghostKiller: { gracePeriodMinutes: 15, reputationPenalty: 5, cronSchedule: '*/5 * * * *' },
        booking: {
            maxWeeklyQuotaHours: 10,
            peakHoursStart: 9,
            peakHoursEnd: 17,
            peakHourCreditMultiplier: 2,
            crossDepartmentAllowedAfterHour: 0,
            maxRecurringWeeks: 10,
        },
    },
}));

// ─── Mock other dependencies ────────────────────────────────────────────────
vi.mock('../../config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/configService.js', () => ({
    configService: {
        getBookingTimeConstraints: vi.fn().mockResolvedValue({
            campusOpenTime: '06:00',
            campusCloseTime: '22:00',
            maxDurationHours: 4,
            minDurationMinutes: 30,
            bufferMinutes: 0,
        }),
        isWithinCampusHours: vi.fn().mockResolvedValue(true),
    },
}));

const mockSendNotification = vi.fn();
vi.mock('../../lib/socket.js', () => ({
    emitBookingUpdate: vi.fn(),
    emitRoomUpdate: vi.fn(),
    sendNotification: (...args: any[]) => mockSendNotification(...args),
}));
vi.mock('../../services/waitlistService.js', () => ({
    waitlistService: { notifyWaitlistedUsers: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../lib/redis.js', () => ({
    getCache: vi.fn(),
    setCache: vi.fn(),
    deleteCache: vi.fn(),
}));

const mockSendCancellationEmail = vi.fn().mockResolvedValue(true);
const mockSendBookingStatusEmail = vi.fn().mockResolvedValue(true);
vi.mock('../../services/emailService.js', () => ({
    emailService: {
        sendBookingStatusEmail: (...args: any[]) => mockSendBookingStatusEmail(...args),
        sendBookingCancellationEmail: (...args: any[]) => mockSendCancellationEmail(...args),
    },
}));

// ─── Import after mocks ────────────────────────────────────────────────────
import { BookingService } from '../../services/bookingService.js';

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('Epic 6 US 6: Admin Cancellation Notification', () => {
    let service: BookingService;
    const futureStart = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now
    const futureEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h from now

    const mockBooking = {
        id: 'booking-123',
        user_id: 'student-user-id',
        room_id: 'room-456',
        start_time: futureStart,
        end_time: futureEnd,
        status: 'CONFIRMED',
        credits_charged: 10,
        rooms: { id: 'room-456', name: 'Lab 201', code: 'LB-201' },
    };

    const mockBookingOwner = {
        email: 'student@campus.edu',
        first_name: 'John',
        last_name: 'Doe',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BookingService();
    });

    function setupAdminCancelMocks(reason?: string) {
        let callCount = 0;
        mockFrom.mockImplementation((table: string) => {
            callCount++;

            // 1. Fetch booking (from bookings)
            if (callCount === 1) {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
                };
            }
            // 2. Fetch performer role (from users) — Admin
            if (callCount === 2) {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: 'ADMIN' }, error: null }),
                };
            }
            // 3. Update booking status (from bookings)
            if (callCount === 3) {
                return {
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { ...mockBooking, status: 'CANCELLED' },
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                };
            }
            // 4. Fetch user credits_balance for refund
            if (callCount === 4) {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                        data: { credits_balance: 50 },
                        error: null,
                    }),
                };
            }
            // 5. Update user credits
            if (callCount === 5) {
                return {
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ error: null }),
                    }),
                };
            }
            // 6. Audit log insert
            if (callCount === 6) {
                return {
                    insert: vi.fn().mockResolvedValue({ error: null }),
                };
            }
            // 7. Fetch booking owner for notification (from users)
            if (callCount === 7) {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: mockBookingOwner, error: null }),
                };
            }
            // Default fallback
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
                insert: vi.fn().mockResolvedValue({ error: null }),
                update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
        });
    }

    it('should send cancellation email when admin cancels a user booking', async () => {
        setupAdminCancelMocks();
        vi.spyOn(service as any, 'invalidateAvailabilityCache').mockResolvedValue(undefined);

        await service.cancelBooking('booking-123', 'admin-user-id', 'Room maintenance');

        expect(mockSendCancellationEmail).toHaveBeenCalledWith(
            'student@campus.edu',
            'John Doe',
            expect.objectContaining({
                roomName: 'Lab 201',
                startTime: futureStart,
                endTime: futureEnd,
                reason: 'Room maintenance',
            })
        );
    });

    it('should send socket notification when admin cancels a user booking', async () => {
        setupAdminCancelMocks();
        vi.spyOn(service as any, 'invalidateAvailabilityCache').mockResolvedValue(undefined);

        await service.cancelBooking('booking-123', 'admin-user-id', 'Emergency closure');

        expect(mockSendNotification).toHaveBeenCalledWith(
            'student-user-id',
            expect.stringContaining('cancelled by an administrator'),
            'warning'
        );
    });

    it('should include reason in notification when provided', async () => {
        setupAdminCancelMocks();
        vi.spyOn(service as any, 'invalidateAvailabilityCache').mockResolvedValue(undefined);

        await service.cancelBooking('booking-123', 'admin-user-id', 'Building maintenance');

        expect(mockSendNotification).toHaveBeenCalledWith(
            'student-user-id',
            expect.stringContaining('Building maintenance'),
            'warning'
        );
    });

    it('should NOT send admin cancellation email when user cancels own booking', async () => {
        // Override the mock so user_id matches the cancelling user
        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                        data: { ...mockBooking, user_id: 'self-cancel-user' },
                        error: null,
                    }),
                };
            }
            if (callCount === 2) {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { role: 'STUDENT' }, error: null }),
                };
            }
            if (callCount === 3) {
                return {
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            select: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { ...mockBooking, status: 'CANCELLED', user_id: 'self-cancel-user' },
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (callCount === 4) {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: { credits_balance: 50 }, error: null }),
                };
            }
            if (callCount === 5) {
                return {
                    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
                };
            }
            return {
                insert: vi.fn().mockResolvedValue({ error: null }),
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
        });

        vi.spyOn(service as any, 'invalidateAvailabilityCache').mockResolvedValue(undefined);

        await service.cancelBooking('booking-123', 'self-cancel-user');

        // Should NOT have sent cancellation email since user cancelled their own booking
        expect(mockSendCancellationEmail).not.toHaveBeenCalled();
        expect(mockSendNotification).not.toHaveBeenCalled();
    });
});
