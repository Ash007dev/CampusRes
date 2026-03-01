/**
 * =============================================================================
 * Campus Resource Engine - Auth Controller
 * =============================================================================
 * HTTP request handlers for authentication endpoints
 * =============================================================================
 */

import { Request, Response } from 'express';
import { authService } from '../services/authService.js';
import { asyncHandler, type AuthenticatedRequest } from '../middleware/index.js';
import { HTTP_STATUS } from '../config/constants.js';
import type { CreateUserInput, LoginInput } from '../utils/validators.js';

/**
 * =============================================================================
 * AUTH CONTROLLER
 * =============================================================================
 */
export const authController = {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  register: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateUserInput;

    const { user, tokens } = await authService.register(input);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        user,
        tokens,
      },
      message: 'Registration successful',
    });
  }),

  /**
   * Initiate login (Step 1 of MFA)
   * POST /api/v1/auth/login
   * Returns sessionId for OTP verification step
   */
  login: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as LoginInput;

    // Extract device fingerprint and IP address
    const deviceInfo = {
      fingerprint: req.headers['x-device-fingerprint'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || req.socket.remoteAddress,
    };

    const result = await authService.initiateLogin(input, deviceInfo);

    res.json({
      success: true,
      data: result,
      message: result.message,
    });
  }),

  /**
   * Verify OTP and complete login (Step 2 of MFA)
   * POST /api/v1/auth/verify-otp
   */
  verifyOtp: asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, userId, otp } = req.body;

    // Accept either sessionId (new) or userId (backward compatibility)
    const idToUse = sessionId || userId;

    if (!idToUse || !otp) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'sessionId and otp are required', code: 'AUTH_4004' },
      });
      return;
    }

    // Extract device fingerprint and IP address
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string | undefined;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || req.socket.remoteAddress;

    const result = await authService.verifyLoginOtp({
      sessionId: idToUse,
      otp,
      deviceFingerprint,
      ipAddress,
    });

    res.json({
      success: true,
      data: result,
      message: 'Login successful',
    });
  }),

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const user = await authService.getUserById(authReq.user.userId);

    if (!user) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: { message: 'User not found', code: 'USER_5001' },
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  }),

  /**
   * Get current user's quota usage
   * GET /api/v1/auth/quota
   */
  getQuota: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const quota = await authService.getUserQuotaUsage(authReq.user.userId);

    res.json({
      success: true,
      data: quota,
    });
  }),

  /**
   * Logout (client-side token removal, optional server-side token invalidation)
   * POST /api/v1/auth/logout
   */
  logout: asyncHandler(async (req: Request, res: Response) => {
    // For JWT, logout is typically handled client-side by removing the token
    // Server-side token invalidation would require a token blacklist (Redis)

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }),

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'Current and new password are required', code: 'AUTH_4001' },
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'New password must be at least 8 characters', code: 'AUTH_4002' },
      });
      return;
    }

    await authService.changePassword(
      authReq.user.userId,
      currentPassword,
      newPassword
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  }),

  /**
   * Update preferences
   * PUT /api/v1/auth/preferences
   */
  updatePreferences: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const preferences = req.body;

    const result = await authService.updatePreferences(
      authReq.user.userId,
      preferences
    );

    res.json({
      success: true,
      data: result,
      message: 'Preferences updated successfully',
    });
  }),

  /**
   * Get all users (Admin only) - US 5.4
   * GET /api/v1/auth/users
   */
  getAllUsers: asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, role, search, departmentId } = req.query;

    console.log('=== GET ALL USERS CONTROLLER HIT ===');
    console.log('Query params:', { page, limit, role, search, departmentId });

    const result = await authService.getAllUsers({
      page: Number(page),
      limit: Number(limit),
      role: role as string,
      search: search as string,
      departmentId: departmentId as string,
    });

    console.log('Result from service:', { usersCount: result.users.length, total: result.total });

    res.json({
      success: true,
      data: result.users,
      meta: {
        total: result.total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(result.total / Number(limit)),
      },
    });
  }),

  /**
   * Create user (Admin only) - US 5.4
   * POST /api/v1/auth/users
   */
  adminCreateUser: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { email, firstName, lastName, role, departmentId, departmentCode, password } = req.body;

    if (!email || !firstName || !lastName || !role) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'Email, first name, last name, and role are required', code: 'AUTH_4004' },
      });
      return;
    }

    const result = await authService.adminCreateUser(
      { email, firstName, lastName, role, departmentId, departmentCode, password },
      authReq.user.userId
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result,
      message: 'User created successfully',
    });
  }),

  /**
   * Update user role (Admin only) - US 5.4
   * PATCH /api/v1/auth/users/:id/role
   */
  updateUserRole: asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'Role is required', code: 'AUTH_4003' },
      });
      return;
    }

    await authService.updateUserRole(id, role, authReq.user.userId);

    res.json({
      success: true,
      message: 'User role updated successfully',
    });
  }),

  /**
   * Forgot Password - Step 1: Request password reset OTP
   * POST /api/v1/auth/forgot-password
   */
  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'Email is required', code: 'AUTH_4001' },
      });
      return;
    }

    const result = await authService.forgotPassword(email);

    res.json({
      success: true,
      data: result,
      message: result.message,
    });
  }),

  /**
   * Forgot Password - Step 2: Verify OTP
   * POST /api/v1/auth/verify-reset-otp
   */
  verifyResetOtp: asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, otp } = req.body;

    if (!sessionId || !otp) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'sessionId and otp are required', code: 'AUTH_4004' },
      });
      return;
    }

    const result = await authService.verifyForgotPasswordOtp(sessionId, otp);

    res.json({
      success: true,
      data: result,
      message: result.message,
    });
  }),

  /**
   * Forgot Password - Step 3: Reset password
   * POST /api/v1/auth/reset-password
   */
  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'Reset token and new password are required', code: 'AUTH_4001' },
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'Password must be at least 8 characters', code: 'AUTH_4002' },
      });
      return;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'Passwords do not match', code: 'AUTH_4005' },
      });
      return;
    }

    await authService.resetPassword(resetToken, newPassword);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  }),
};
