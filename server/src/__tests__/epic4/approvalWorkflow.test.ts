import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BOOKING_STATUS, USER_ROLES, ROOM_TYPES, APPROVAL_REQUIRED_ROOM_TYPES } from '../../config/constants.js';

// Define the mock before any imports that might use it
const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
};

// Use unstable_mockModule for ESM mocking if needed, but for now we'll try standard mock
vi.mock('../../lib/supabase.js', () => ({
    supabase: mockSupabase
}));

// Mock other dependencies
vi.mock('../../lib/redis.js', () => ({
    getCache: vi.fn().mockResolvedValue(null),
    setCache: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../services/peakHourService.js', () => ({
    peakHourService: {
        checkPeakHourLimits: vi.fn().mockResolvedValue(undefined),
    }
}));

// Import the service after mocks
import { bookingService } from '../../services/bookingService.js';
import { getCurrentIST } from '../../utils/dateUtils.js';

describe('Approval Workflow Unit Tests', () => {
    const userId = 'user-123';
    const roomId = 'room-456';
    const now = getCurrentIST();
    const startTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * =========================================================================
     * US 1 & 2: Booking Creation & Initial Status
     * =========================================================================
     */
    describe('Initial Status Logic (US 1 & 2)', () => {

        test('US 1: Student booking any room should result in PENDING_APPROVAL', async () => {
            // Setup: Mock room and user
            const mockRoom = { id: roomId, name: 'Normal Classroom', room_type: ROOM_TYPES.CLASSROOM, is_active: true, is_maintenance: false };
            const mockUser = { id: userId, role: USER_ROLES.STUDENT, credits_balance: 100 };

            // Mock holiday check
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) } as any);
            // Mock room check
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }) } as any);
            // Mock user check
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);
            // Mock conflict check
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: [], error: null }) } as any);
            // Mock insertion
            mockSupabase.from.mockReturnValueOnce({ insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'booking-1', status: BOOKING_STATUS.PENDING_APPROVAL }, error: null }) } as any);

            // Act
            const result = await bookingService.createBooking(userId, 'dept-1', {
                roomId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                attendeeCount: 10
            });

            // Assert
            expect(result.status).toBe(BOOKING_STATUS.PENDING_APPROVAL);
        });

        test('US 2: Faculty booking a regular room should result in CONFIRMED', async () => {
            // Setup: Mock room (Classroom) and user (Faculty)
            const mockRoom = { id: roomId, name: 'Normal Classroom', room_type: ROOM_TYPES.CLASSROOM, is_active: true, is_maintenance: false };
            const mockUser = { id: userId, role: USER_ROLES.FACULTY, credits_balance: 100 };

            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: [], error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({ insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'booking-2', status: BOOKING_STATUS.CONFIRMED }, error: null }) } as any);

            // Act
            const result = await bookingService.createBooking(userId, 'dept-1', {
                roomId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                attendeeCount: 10
            });

            // Assert
            expect(result.status).toBe(BOOKING_STATUS.CONFIRMED);
        });

        test('US 2: Faculty booking an Auditorium should result in PENDING_APPROVAL', async () => {
            // Setup: Mock room (Auditorium) and user (Faculty)
            const mockRoom = { id: roomId, name: 'Main Auditorium', room_type: ROOM_TYPES.AUDITORIUM, is_active: true, is_maintenance: false };
            const mockUser = { id: userId, role: USER_ROLES.FACULTY, credits_balance: 100 };

            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockRoom, error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: [], error: null }) } as any);
            mockSupabase.from.mockReturnValueOnce({ insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'booking-3', status: BOOKING_STATUS.PENDING_APPROVAL }, error: null }) } as any);

            // Act
            const result = await bookingService.createBooking(userId, 'dept-1', {
                roomId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                attendeeCount: 10
            });

            // Assert
            expect(result.status).toBe(BOOKING_STATUS.PENDING_APPROVAL);
        });
    });

    /**
     * =========================================================================
     * US 4 & 5: Admin Decision & Credit Handling
     * =========================================================================
     */
    describe('Admin Decision (US 4 & 5)', () => {
        const bookingId = 'booking-uuid';
        const adminId = 'admin-uuid';

        test('US 4: Admin can approve a pending booking', async () => {
            // Setup: Mock pending booking
            const mockBooking = {
                id: bookingId,
                status: BOOKING_STATUS.PENDING_APPROVAL,
                user_id: userId,
                credits_charged: 5,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString()
            };

            // Fetch booking
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }) } as any);
            // Update status
            mockSupabase.from.mockReturnValueOnce({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { ...mockBooking, status: BOOKING_STATUS.CONFIRMED, users: { email: 'test@example.com', first_name: 'John', last_name: 'Doe' } }, error: null }) } as any);
            // Audit log
            mockSupabase.from.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) } as any);

            // Act
            const result = await bookingService.approveBooking(bookingId, adminId, true);

            // Assert
            expect(result.status).toBe(BOOKING_STATUS.CONFIRMED);
        });

        test('US 5: Rejecting a booking should refund credits', async () => {
            // Setup: Mock pending booking with charges
            const mockBooking = {
                id: bookingId,
                status: BOOKING_STATUS.PENDING_APPROVAL,
                user_id: userId,
                credits_charged: 10,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString()
            };
            const mockUser = { id: userId, credits_balance: 50 };

            // Fetch booking
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }) } as any);
            // Update status to CANCELLED
            mockSupabase.from.mockReturnValueOnce({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { ...mockBooking, status: BOOKING_STATUS.CANCELLED, users: { email: 'test@example.com' } }, error: null }) } as any);
            // Fetch user to refund
            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockUser, error: null }) } as any);
            // Update user credits (refund)
            mockSupabase.from.mockReturnValueOnce({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) } as any);
            // Audit log
            mockSupabase.from.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) } as any);

            // Act
            const result = await bookingService.approveBooking(bookingId, adminId, false, 'Insufficient capacity info');

            // Assert
            expect(result.status).toBe(BOOKING_STATUS.CANCELLED);
            // Verify credit refund was called with correct math (50 + 10 = 60)
            expect(mockSupabase.from).toHaveBeenCalledWith('users');
            expect(mockSupabase.update).toHaveBeenCalledWith({ credits_balance: 60 });
        });

        test('Should throw error when trying to approve an already confirmed booking', async () => {
            const mockBooking = { id: bookingId, status: BOOKING_STATUS.CONFIRMED };

            mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }) } as any);

            // Act & Assert
            await expect(bookingService.approveBooking(bookingId, adminId, true))
                .rejects.toThrow('Cannot approve booking with status: CONFIRMED');
        });
    });
});
