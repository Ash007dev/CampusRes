/**
 * =============================================================================
 * US 3: Running Late — Unit Tests
 * =============================================================================
 * Tests for the markRunningLate service method.
 * Mocks Supabase interactions to isolate the business logic.
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
vi.mock('../configService.js', () => ({
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
vi.mock('../../lib/socket.js', () => ({
    emitBookingUpdate: vi.fn(),
    emitRoomUpdate: vi.fn(),
}));
vi.mock('../waitlistService.js', () => ({
    waitlistService: { notifyWaitlist: vi.fn() },
}));
vi.mock('../../lib/redis.js', () => ({
    getCache: vi.fn(),
    setCache: vi.fn(),
    deleteCache: vi.fn(),
}));
vi.mock('../emailService.js', () => ({
    emailService: { sendBookingStatusEmail: vi.fn() },
}));

// ─── Import after mocks ────────────────────────────────────────────────────
import { BookingService } from '../../services/bookingService.js';

// ─── Helper to build Supabase chain ─────────────────────────────────────────
function setupSupabaseMock(booking: any | null, updateResult?: any) {
    // Chain for the initial fetch: from('bookings').select(...).eq('id', ...).single()
    const fetchChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
            data: booking,
            error: booking ? null : { message: 'Not found' },
        }),
    };

    // Chain for the update: from('bookings').update(...).eq(...).select(...).single()
    const updateChain = {
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: updateResult || { ...booking, check_in_status: 'LATE' },
                        error: null,
                    }),
                }),
            }),
        }),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return fetchChain;
        return updateChain;
    });

    return { fetchChain, updateChain };
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('US 3: Running Late - BookingService.markRunningLate', () => {
    let service: BookingService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BookingService();
    });

    it('should mark a booking as running late when within grace window', async () => {
        const now = new Date();
        const realStartTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 min ago
        const startTimeFakeUtc = new Date(realStartTime.getTime() + 5.5 * 60 * 60 * 1000); // Shift for Fake UTC mock

        const booking = {
            id: 'booking-123',
            user_id: 'user-456',
            room_id: 'room-789',
            start_time: startTimeFakeUtc.toISOString(),
            end_time: new Date(startTimeFakeUtc.getTime() + 60 * 60 * 1000).toISOString(),
            status: 'CONFIRMED',
            check_in_status: 'PENDING',
            rooms: { id: 'room-789', name: 'Lab 101', code: 'LB-101' },
        };

        setupSupabaseMock(booking);

        const result = await service.markRunningLate('booking-123', 'user-456');

        expect(result).toBeDefined();
        expect(result.check_in_status).toBe('LATE');
    });

    it('should throw error when booking not found', async () => {
        setupSupabaseMock(null);

        await expect(service.markRunningLate('nonexistent', 'user-456'))
            .rejects.toThrow();
    });

    it('should throw error when user does not own the booking', async () => {
        const now = new Date();
        const realStartTime = new Date(now.getTime() - 5 * 60 * 1000);
        const startTimeFakeUtc = new Date(realStartTime.getTime() + 5.5 * 60 * 60 * 1000);
        const booking = {
            id: 'booking-123',
            user_id: 'other-user',
            room_id: 'room-789',
            start_time: startTimeFakeUtc.toISOString(),
            end_time: new Date(startTimeFakeUtc.getTime() + 60 * 60 * 1000).toISOString(),
            status: 'CONFIRMED',
            check_in_status: 'PENDING',
            rooms: { id: 'room-789', name: 'Lab 101', code: 'LB-101' },
        };

        setupSupabaseMock(booking);

        await expect(service.markRunningLate('booking-123', 'user-456'))
            .rejects.toThrow();
    });

    it('should throw error when booking is not CONFIRMED', async () => {
        const now = new Date();
        const realStartTime = new Date(now.getTime() - 5 * 60 * 1000);
        const startTimeFakeUtc = new Date(realStartTime.getTime() + 5.5 * 60 * 60 * 1000);
        const booking = {
            id: 'booking-123',
            user_id: 'user-456',
            room_id: 'room-789',
            start_time: startTimeFakeUtc.toISOString(),
            end_time: new Date(startTimeFakeUtc.getTime() + 60 * 60 * 1000).toISOString(),
            status: 'CANCELLED',
            check_in_status: 'PENDING',
            rooms: { id: 'room-789', name: 'Lab 101', code: 'LB-101' },
        };

        setupSupabaseMock(booking);

        await expect(service.markRunningLate('booking-123', 'user-456'))
            .rejects.toThrow('Running late can only be used for confirmed bookings');
    });

    it('should throw error when check_in_status is already CHECKED_IN', async () => {
        const now = new Date();
        const realStartTime = new Date(now.getTime() - 5 * 60 * 1000);
        const startTimeFakeUtc = new Date(realStartTime.getTime() + 5.5 * 60 * 60 * 1000);
        const booking = {
            id: 'booking-123',
            user_id: 'user-456',
            room_id: 'room-789',
            start_time: startTimeFakeUtc.toISOString(),
            end_time: new Date(startTimeFakeUtc.getTime() + 60 * 60 * 1000).toISOString(),
            status: 'CONFIRMED',
            check_in_status: 'CHECKED_IN',
            rooms: { id: 'room-789', name: 'Lab 101', code: 'LB-101' },
        };

        setupSupabaseMock(booking);

        await expect(service.markRunningLate('booking-123', 'user-456'))
            .rejects.toThrow('Running late can only be used for confirmed bookings');
    });

    it('should throw error when called before booking start time', async () => {
        const now = new Date();
        const realStartTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min in future
        const startTimeFakeUtc = new Date(realStartTime.getTime() + 5.5 * 60 * 60 * 1000);
        const booking = {
            id: 'booking-123',
            user_id: 'user-456',
            room_id: 'room-789',
            start_time: startTimeFakeUtc.toISOString(),
            end_time: new Date(startTimeFakeUtc.getTime() + 60 * 60 * 1000).toISOString(),
            status: 'CONFIRMED',
            check_in_status: 'PENDING',
            rooms: { id: 'room-789', name: 'Lab 101', code: 'LB-101' },
        };

        setupSupabaseMock(booking);

        await expect(service.markRunningLate('booking-123', 'user-456'))
            .rejects.toThrow('You can only mark running late after the booking start time');
    });

    it('should throw error when grace period has expired', async () => {
        const now = new Date();
        const realStartTime = new Date(now.getTime() - 20 * 60 * 1000); // 20 min ago (> 15 min grace)
        const startTimeFakeUtc = new Date(realStartTime.getTime() + 5.5 * 60 * 60 * 1000);
        const booking = {
            id: 'booking-123',
            user_id: 'user-456',
            room_id: 'room-789',
            start_time: startTimeFakeUtc.toISOString(),
            end_time: new Date(startTimeFakeUtc.getTime() + 60 * 60 * 1000).toISOString(),
            status: 'CONFIRMED',
            check_in_status: 'PENDING',
            rooms: { id: 'room-789', name: 'Lab 101', code: 'LB-101' },
        };

        setupSupabaseMock(booking);

        await expect(service.markRunningLate('booking-123', 'user-456'))
            .rejects.toThrow('The grace period has already expired');
    });
});
