/**
 * =============================================================================
 * Campus Resource Engine - Auth Routes
 * =============================================================================
 * Route definitions for authentication endpoints
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import { authController } from '../controllers/authController.js';
import {
  authenticate,
  authorize,
  validate,
  authRateLimiter,
} from '../middleware/index.js';
import { createUserSchema, loginSchema } from '../utils/validators.js';

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already exists
 */
router.post(
  '/register',
  authRateLimiter,
  validate(createUserSchema, 'body'),
  authController.register
);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema, 'body'),
  authController.login
);

/**
 * @openapi
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and complete login (Step 2 of MFA)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, otp]
 *             properties:
 *               userId:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', authRateLimiter, authController.verifyOtp);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @openapi
 * /api/v1/auth/quota:
 *   get:
 *     summary: Get current user's quota usage
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/quota', authenticate, authController.getQuota);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @openapi
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Current password is incorrect
 */
router.post('/change-password', authenticate, authController.changePassword);

/**
 * @openapi
 * /api/v1/auth/preferences:
 *   put:
 *     summary: Update user preferences
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailNotifications:
 *                 type: boolean
 *               smsNotifications:
 *                 type: boolean
 *               theme:
 *                 type: string
 *                 enum: [light, dark, system]
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
router.put('/preferences', authenticate, authController.updatePreferences);

/**
 * =============================================================================
 * FORGOT PASSWORD ROUTES
 * =============================================================================
 */

/**
 * @openapi
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent to email
 */
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);

/**
 * @openapi
 * /api/v1/auth/verify-reset-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, otp]
 *             properties:
 *               sessionId:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified, reset token returned
 */
router.post('/verify-reset-otp', authRateLimiter, authController.verifyResetOtp);

/**
 * @openapi
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resetToken, newPassword, confirmPassword]
 *             properties:
 *               resetToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post('/reset-password', authRateLimiter, authController.resetPassword);

/**
 * =============================================================================
 * ADMIN ROUTES - User Management (US 5.4)
 * =============================================================================
 */

/**
 * @openapi
 * /api/v1/auth/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', authenticate, authorize(['ADMIN']), authController.getAllUsers);

/**
 * @openapi
 * /api/v1/auth/users/{id}/role:
 *   patch:
 *     summary: Update user role (Admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/users/:id/role', authenticate, authorize(['ADMIN']), authController.updateUserRole);

export default router;
