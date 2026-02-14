import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { BOOKING_STATUS, USER_ROLES, ROOM_TYPES } from '../../config/constants.js';

// --- Mocks ---
const { mockSupabase } = vi.hoisted(() => {
    const m = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
    };
    return { mockSupabase: m };
});

vi.mock('../../lib/supabase.js', () => ({
    supabase: mockSupabase
}));

vi.mock('../../lib/redis.js', () => ({
    getCache: vi.fn().mockResolvedValue(null),
    setCache: vi.fn().mockResolvedValue(undefined),
    deleteCache: vi.fn().mockResolvedValue(undefined),
    deleteCachePattern: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    }
}));

vi.mock('../../services/emailService.js', () => ({
    emailService: {
        sendBookingStatusEmail: vi.fn().mockResolvedValue(true),
    }
}));

vi.mock('../../services/configService.js', () => ({
    configService: {
        getBookingTimeConstraints: vi.fn().mockResolvedValue({
            campusOpenTime: '08:00',
            campusCloseTime: '22:00',
            maxDurationHours: 4,
            minDurationMinutes: 30,
        }),
        isWithinCampusHours: vi.fn().mockResolvedValue(true),
    }
}));

// We need to import constants and helper types
import { QuotaExceededError } from '../../utils/errors.js';
import { bookingService } from '../../services/bookingService.js';

describe('Epic 4: Governance, Fairness & Approval Workflows', () => {
    const userId = 'user-uuid';
    const roomId = 'room-uuid';
    const now = new Date('2024-05-20T10:00:00Z'); // A Monday
    const startTime = new Date('2024-05-20T14:00:00Z');
    const endTime = new Date('2024-05-20T15:00:00Z'); // 1 hour

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(now);
        // Default mock behavior for common queries
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
        mockSupabase.single.mockResolvedValue({ data: null, error: null });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * US 4.1: Weekly Quota Limit
     * "Limit Students to 4 hours/week"
     */
    describe('US 4.1: Weekly Quota Limit', () => {
        test('Should block student booking if it exceeds 4 hour quota', async () => {
            // Mock user with 4h quota limit
            const mockUser = { id: userId, role: USER_ROLES.STUDENT, quota_limit_hours: 4 };
            // User has already used 3.5 hours this week
            const mockExistingBookings = [
                { start_time: '2024-05-20T08:00:00Z', end_time: '2024-05-20T11:30:00Z' } // 3.5 hours
            ];

            // Setup call sequence for checkWeeklyQuota
            // 1. User fetch
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);
            // 2. Bookings fetch (Chain: from.select.eq.gte.lte.not)
            mockSupabase.from.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                not: vi.fn().mockResolvedValue({ data: mockExistingBookings, error: null })
            } as any);

            // Attempt to book 1 more hour (3.5 + 1 = 4.5 > 4)
            await expect(bookingService['checkWeeklyQuota'](userId, startTime, endTime))
                .rejects.toThrow(QuotaExceededError);
        });

        test('Should allow student booking if within 4 hour quota', async () => {
            const mockUser = { id: userId, role: USER_ROLES.STUDENT, quota_limit_hours: 4 };
            const mockExistingBookings = [
                { start_time: '2024-05-20T08:00:00Z', end_time: '2024-05-20T10:00:00Z' } // 2 hours
            ];

            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                not: vi.fn().mockResolvedValue({ data: mockExistingBookings, error: null })
            } as any);

            // Attempt to book 1 more hour (2 + 1 = 3 < 4)
            await expect(bookingService['checkWeeklyQuota'](userId, startTime, endTime))
                .resolves.not.toThrow();
        });
    });

    /**
     * US 4.7: Faculty Unlimited Access
     * "Exempt Faculty from quotas"
     */
    describe('US 4.7: Faculty Unlimited Access', () => {
        test('Should allow Faculty to book even if they exceed normal quotas', async () => {
            // Mock user is Faculty
            const mockUser = { id: userId, role: USER_ROLES.FACULTY, quota_limit_hours: 4 };

            // Setup: checkWeeklyQuota only fetches user and returns early if Faculty
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);

            // Even if logically they would exceed quota, it should resolve successfully
            await expect(bookingService['checkWeeklyQuota'](userId, startTime, endTime))
                .resolves.not.toThrow();

            // Verify it didn't even fetch existing bookings
            expect(mockSupabase.from).not.toHaveBeenCalledWith('bookings');
        });
    });

    /**
     * US 4.2 & 4.3: Approval Workflow
     */
    describe('US 4.2 & 4.3: Approval Workflow', () => {
        test('US 4.2: Student booking an Auditorium should result in PENDING_APPROVAL', async () => {
            // Mock dependencies for createBooking
            const mockRoom = { id: roomId, name: 'Main Auditorium', room_type: ROOM_TYPES.AUDITORIUM, is_active: true, is_maintenance: false, department_id: 'dept-1' };
            const mockUser = { id: userId, role: USER_ROLES.STUDENT, credits_balance: 100 };

            vi.spyOn(bookingService as any, 'checkWeeklyQuota').mockResolvedValue(undefined);
            vi.spyOn(bookingService as any, 'calculateCredits').mockReturnValue({ creditsRequired: 10, isPeakHours: false });
            vi.spyOn(bookingService as any, 'invalidateAvailabilityCache').mockResolvedValue(undefined);

            // Supabase calls in sequence for createBooking:
            // 1. User check (L77)
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { is_active: true, blocked_until: null }, error: null }) } as any);
            // 2. Holiday check (L97)
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) } as any);
            // 3. Room check (L111)
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }) } as any);
            // 4. User check for credits/role (L136)
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);
            // 5. Conflict check (L154)
            mockSupabase.from.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                not: vi.fn().mockReturnThis(),
                lt: vi.fn().mockReturnThis(),
                gt: vi.fn().mockResolvedValue({ data: [], error: null })
            } as any);
            // 6. Insert booking (L183)
            mockSupabase.from.mockReturnValueOnce({ insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'new-b-id', status: BOOKING_STATUS.PENDING_APPROVAL, room_id: roomId, start_time: startTime.toISOString(), end_time: endTime.toISOString() }, error: null }) } as any);
            // 7. Update user credits (L222)
            mockSupabase.from.mockReturnValueOnce({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) } as any);
            // 8. Audit log (L228)
            mockSupabase.from.mockReturnValueOnce({ insert: mockSupabase.insert.mockResolvedValue({ error: null }) } as any);

            const result = await bookingService.createBooking(userId, 'dept-1', {
                roomId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                attendeeCount: 100,
                title: 'Test'
            });

            expect(result.status).toBe(BOOKING_STATUS.PENDING_APPROVAL);
            // Verify audit log
            expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                action: 'CREATE',
                entity_type: 'booking'
            }));
        });

        test('US 4.3: Admin can approve a pending request', async () => {
            const bookingId = 'pending-b-123';
            const adminId = 'admin-007';
            const mockBooking = {
                id: bookingId,
                status: BOOKING_STATUS.PENDING_APPROVAL,
                user_id: userId,
                room_id: roomId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                credits_charged: 10,
                rooms: { name: 'Auditorium' }
            };

            // 1. Fetch booking
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }) } as any);
            // 2. Update status
            mockSupabase.from.mockReturnValueOnce({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { ...mockBooking, status: BOOKING_STATUS.CONFIRMED, users: { email: 'student@edu.com', first_name: 'S', last_name: 'Y' } }, error: null }) } as any);
            // 3. Audit log
            mockSupabase.from.mockReturnValueOnce({ insert: mockSupabase.insert.mockResolvedValue({ error: null }) } as any);

            const result = await bookingService.approveBooking(bookingId, adminId, true);

            expect(result.status).toBe(BOOKING_STATUS.CONFIRMED);
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                action: 'APPROVE',
                new_state: expect.objectContaining({ status: 'CONFIRMED' })
            }));
        });
    });

    /**
     * US 4.8: Guest Booking
     */
    describe('US 4.8: Guest Booking', () => {
        test('Should store guest name and phone in metadata when provided', async () => {
            const mockRoom = { id: roomId, name: 'Conference Hall', room_type: ROOM_TYPES.CLASSROOM, is_active: true, is_maintenance: false, department_id: 'dept-1' };
            const mockUser = { id: userId, role: USER_ROLES.ADMIN, credits_balance: 1000 };
            const guestInfo = { guestName: 'Dr. Speaker', guestPhone: '1234567890' };

            vi.spyOn(bookingService as any, 'checkWeeklyQuota').mockResolvedValue(undefined);
            vi.spyOn(bookingService as any, 'calculateCredits').mockReturnValue({ creditsRequired: 0, isPeakHours: false });
            vi.spyOn(bookingService as any, 'invalidateAvailabilityCache').mockResolvedValue(undefined);

            // 1. User check (L77)
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { is_active: true, blocked_until: null }, error: null }) } as any);
            // 2. Holiday check
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) } as any);
            // 3. Room check
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }) } as any);
            // 4. User check
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);
            // 5. Conflict check
            mockSupabase.from.mockReturnValueOnce({
                select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
                gt: vi.fn().mockResolvedValue({ data: [], error: null })
            } as any);

            // 6. Insert booking (Capture the insertion data)
            const insertSpy = vi.fn().mockReturnThis();
            mockSupabase.from.mockReturnValueOnce({
                insert: insertSpy,
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'guest-b-1', status: BOOKING_STATUS.CONFIRMED, room_id: roomId }, error: null })
            } as any);
            // 7. Audit log (No credits deducted as cost is 0)
            mockSupabase.from.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) } as any);

            await bookingService.createBooking(userId, 'dept-1', {
                roomId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                attendeeCount: 1,
                ...guestInfo
            });

            expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
                metadata: expect.objectContaining({
                    guestName: 'Dr. Speaker',
                    guestPhone: '1234567890'
                })
            }));
        });
    });

    /**
     * US 4.9: Audit Logs (Implicitly tested above, but adding focused test)
     */
    describe('US 4.9: Audit Logs for Cancellation', () => {
        test('Admin cancelling a user booking should be logged with the admin as performer', async () => {
            const bookingId = 'b-to-cancel';
            const mockBooking = { id: bookingId, user_id: 'original-user', status: 'CONFIRMED', room_id: roomId, start_time: startTime.toISOString(), end_time: endTime.toISOString() };

            // 1. Fetch booking
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }) } as any);
            // 2. Fetch performer role (Admin)
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { role: 'ADMIN' }, error: null }) } as any);
            // 3. Update status
            mockSupabase.from.mockReturnValueOnce({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { ...mockBooking, status: 'CANCELLED' }, error: null }) } as any);
            // 4. Audit log
            const auditInsertSpy = vi.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockReturnValueOnce({ insert: auditInsertSpy } as any);

            vi.spyOn(bookingService as any, 'invalidateAvailabilityCache').mockResolvedValue(undefined);

            await bookingService.cancelBooking(bookingId, 'admin-1', 'Policy violation');

            expect(auditInsertSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'CANCEL',
                performed_by_id: 'admin-1',
                entity_id: bookingId
            }));
        });
    });
});
