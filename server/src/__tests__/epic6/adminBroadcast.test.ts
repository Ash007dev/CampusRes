/**
 * =============================================================================
 * Epic 6 US 2: Admin Broadcast Email — Unit Tests
 * =============================================================================
 * Tests that admins can send a broadcast email to all users in the database.
 *
 * Acceptance Criteria:
 *   Given an admin triggers a broadcast,
 *   When they provide a subject and message,
 *   Then all unique users receive a single email with that content.
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// ─── Mock Supabase ───────────────────────────────────────────────────────────
const mockFrom = vi.fn();

vi.mock('../../lib/supabase.js', () => ({
    supabase: {
        from: (...args: any[]) => mockFrom(...args),
    },
}));

// ─── Mock Logger ─────────────────────────────────────────────────────────────
vi.mock('../../config/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Mock Email Service ──────────────────────────────────────────────────────
const mockSendBroadcastEmail = vi.fn().mockResolvedValue(true);

vi.mock('../../services/emailService.js', () => ({
    sendBroadcastEmail: (...args: any[]) => mockSendBroadcastEmail(...args),
}));

// ─── Mock Config Constants ──────────────────────────────────────────────────
vi.mock('../../config/constants.js', () => ({
    HTTP_STATUS: {
        OK: 200,
        BAD_REQUEST: 400,
        INTERNAL_SERVER_ERROR: 500,
    },
}));

// ─── Mock Admin Service ─────────────────────────────────────────────────────
vi.mock('../../services/adminService.js', () => ({
    adminService: {
        getDashboardStats: vi.fn(),
        getAuditLogs: vi.fn(),
    },
}));

// ─── Mock Middleware ─────────────────────────────────────────────────────────
vi.mock('../../middleware/index.js', () => ({
    asyncHandler: (fn: any) => (req: any, res: any, next: any = () => { }) => fn(req, res, next),
}));

// ─── Import after mocks ────────────────────────────────────────────────────
import { adminController } from '../../controllers/adminController.js';

// ─── Helpers ────────────────────────────────────────────────────────────────
function createMockReq(body: any = {}, user: any = { id: 'admin-1' }): Partial<Request> {
    return { body, user } as any;
}

function createMockRes(): Partial<Response> & { _statusCode: number; _json: any } {
    const res: any = {
        _statusCode: 200,
        _json: null,
        status(code: number) { res._statusCode = code; return res; },
        json(data: any) { res._json = data; return res; },
    };
    return res;
}

// ─── Tests ──────────────────────────────────────────────────────────────────
const mockNext: NextFunction = vi.fn();

describe('Epic 6 US 2: Admin Broadcast Email', () => {
    const mockUsers = [
        { id: 'u1', email: 'alice@campus.edu', first_name: 'Alice', last_name: 'Smith' },
        { id: 'u2', email: 'bob@campus.edu', first_name: 'Bob', last_name: 'Jones' },
        { id: 'u3', email: 'charlie@campus.edu', first_name: 'Charlie', last_name: 'Brown' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    function setupUsersFetchMock(users: any[], fetchError: any = null) {
        let callCount = 0;
        mockFrom.mockImplementation((table: string) => {
            callCount++;
            if (table === 'users') {
                return {
                    select: vi.fn().mockResolvedValue({ data: fetchError ? null : users, error: fetchError }),
                };
            }
            // audit_logs insert
            if (table === 'audit_logs') {
                return {
                    insert: vi.fn().mockResolvedValue({ error: null }),
                };
            }
            return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        });
    }

    it('should send broadcast email to all users', async () => {
        setupUsersFetchMock(mockUsers);

        const req = createMockReq({ subject: 'Campus Closure', message: 'Campus is closed tomorrow.' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        expect(res._json.success).toBe(true);
        expect(res._json.data.recipientCount).toBe(3);
        expect(res._json.data.successCount).toBe(3);
        expect(res._json.data.failCount).toBe(0);

        // Verify each user got one email
        expect(mockSendBroadcastEmail).toHaveBeenCalledTimes(3);
        expect(mockSendBroadcastEmail).toHaveBeenCalledWith(
            'alice@campus.edu',
            'Alice Smith',
            { subject: 'Campus Closure', message: 'Campus is closed tomorrow.' }
        );
        expect(mockSendBroadcastEmail).toHaveBeenCalledWith(
            'bob@campus.edu',
            'Bob Jones',
            { subject: 'Campus Closure', message: 'Campus is closed tomorrow.' }
        );
    });

    it('should return 400 if subject is missing', async () => {
        const req = createMockReq({ message: 'Some message' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        expect(res._statusCode).toBe(400);
        expect(res._json.success).toBe(false);
        expect(mockSendBroadcastEmail).not.toHaveBeenCalled();
    });

    it('should return 400 if message is missing', async () => {
        const req = createMockReq({ subject: 'Test Subject' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        expect(res._statusCode).toBe(400);
        expect(res._json.success).toBe(false);
        expect(mockSendBroadcastEmail).not.toHaveBeenCalled();
    });

    it('should return 500 if fetching users fails', async () => {
        setupUsersFetchMock([], { message: 'DB error' });

        const req = createMockReq({ subject: 'Test', message: 'Test msg' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        expect(res._statusCode).toBe(500);
        expect(res._json.success).toBe(false);
        expect(mockSendBroadcastEmail).not.toHaveBeenCalled();
    });

    it('should deduplicate users by email (same email appears multiple times)', async () => {
        const usersWithDuplicates = [
            { id: 'u1', email: 'admin@campus.edu', first_name: 'Admin', last_name: 'One' },
            { id: 'u2', email: 'admin@campus.edu', first_name: 'Admin', last_name: 'Duplicate' },
            { id: 'u3', email: 'ADMIN@campus.edu', first_name: 'Admin', last_name: 'UpperCase' },
            { id: 'u4', email: 'student@campus.edu', first_name: 'Student', last_name: 'X' },
        ];
        setupUsersFetchMock(usersWithDuplicates);

        const req = createMockReq({ subject: 'Notice', message: 'Dedup test' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        // Only 2 unique emails: admin@campus.edu and student@campus.edu
        expect(mockSendBroadcastEmail).toHaveBeenCalledTimes(2);
        expect(res._json.data.successCount).toBe(2);
    });

    it('should handle partial email failures gracefully', async () => {
        setupUsersFetchMock(mockUsers);

        // Make the second email fail
        mockSendBroadcastEmail
            .mockResolvedValueOnce(true)   // alice succeeds
            .mockResolvedValueOnce(false)  // bob fails
            .mockResolvedValueOnce(true);  // charlie succeeds

        const req = createMockReq({ subject: 'Test', message: 'Partial fail' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        expect(res._json.success).toBe(true);
        expect(res._json.data.successCount).toBe(2);
        expect(res._json.data.failCount).toBe(1);
    });

    it('should handle email send exceptions gracefully', async () => {
        setupUsersFetchMock(mockUsers);

        // Make the second email throw an error
        mockSendBroadcastEmail
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('SMTP timeout'))
            .mockResolvedValueOnce(true);

        const req = createMockReq({ subject: 'Test', message: 'Exception test' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        expect(res._json.success).toBe(true);
        expect(res._json.data.successCount).toBe(2);
        expect(res._json.data.failCount).toBe(1);
    });

    it('should write an audit log entry after sending', async () => {
        setupUsersFetchMock(mockUsers);

        const req = createMockReq({ subject: 'Audit Test', message: 'Check audit' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        // Verify audit_logs insert was called
        expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    });

    it('should use fallback name "User" when first_name and last_name are empty', async () => {
        const usersNoName = [
            { id: 'u1', email: 'noname@campus.edu', first_name: '', last_name: '' },
        ];
        setupUsersFetchMock(usersNoName);

        const req = createMockReq({ subject: 'Test', message: 'Name fallback' });
        const res = createMockRes();

        await adminController.sendBroadcast(req as Request, res as Response, mockNext);

        expect(mockSendBroadcastEmail).toHaveBeenCalledWith(
            'noname@campus.edu',
            'User',
            expect.objectContaining({ subject: 'Test' })
        );
    });
});
