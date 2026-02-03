/**
 * =============================================================================
 * Campus Resource Engine - Feedback Routes (US 5.8)
 * =============================================================================
 * API routes for feedback management
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import { feedbackController } from '../controllers/feedbackController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/feedback:
 *   get:
 *     summary: Get all feedback (Admin only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [AC_ISSUE, CLEANLINESS, EQUIPMENT, NOISE, LIGHTING, OTHER]
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of feedback
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  feedbackController.getAllFeedback
);

/**
 * @openapi
 * /api/v1/feedback/stats:
 *   get:
 *     summary: Get feedback statistics (Admin only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback statistics
 */
router.get(
  '/stats',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  feedbackController.getFeedbackStats
);

/**
 * @openapi
 * /api/v1/feedback/my:
 *   get:
 *     summary: Get current user's feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's feedback list
 */
router.get(
  '/my',
  authenticate,
  feedbackController.getMyFeedback
);

/**
 * @openapi
 * /api/v1/feedback/{id}:
 *   get:
 *     summary: Get feedback by ID
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback details
 */
router.get(
  '/:id',
  authenticate,
  feedbackController.getFeedbackById
);

/**
 * @openapi
 * /api/v1/feedback:
 *   post:
 *     summary: Submit feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *               - category
 *               - title
 *               - description
 *             properties:
 *               roomId:
 *                 type: string
 *               bookingId:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [AC_ISSUE, CLEANLINESS, EQUIPMENT, NOISE, LIGHTING, OTHER]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *     responses:
 *       201:
 *         description: Feedback created
 */
router.post(
  '/',
  authenticate,
  feedbackController.createFeedback
);

/**
 * @openapi
 * /api/v1/feedback/{id}:
 *   patch:
 *     summary: Update feedback (Admin only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feedback updated
 */
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  feedbackController.updateFeedback
);

/**
 * @openapi
 * /api/v1/feedback/{id}:
 *   delete:
 *     summary: Delete feedback (Admin only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback deleted
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  feedbackController.deleteFeedback
);

export default router;
