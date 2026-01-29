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
   * Login user
   * POST /api/v1/auth/login
   */
  login: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as LoginInput;

    const { user, tokens } = await authService.login(input);

    res.json({
      success: true,
      data: {
        user,
        tokens,
      },
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
};
