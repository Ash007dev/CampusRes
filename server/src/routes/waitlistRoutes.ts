/**
 * =============================================================================
 * Campus Resource Engine - Waitlist Routes
 * =============================================================================
 * Route definitions for waitlist endpoints (US 3.7)
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import { waitlistController } from '../controllers/waitlistController.js';
import { authenticate } from '../middleware/index.js';

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/waitlist:
 *   post:
 *     summary: Join waitlist for a time slot
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roomId, startTime, endTime]
 *             properties:
 *               roomId:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Added to waitlist
 *       400:
 *         description: Already on waitlist
 */
router.post('/', authenticate, waitlistController.join);

/**
 * @openapi
 * /api/v1/waitlist/my:
 *   get:
 *     summary: Get current user's waitlist entries
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my', authenticate, waitlistController.getMyEntries);

/**
 * @openapi
 * /api/v1/waitlist/{id}:
 *   delete:
 *     summary: Leave waitlist
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, waitlistController.leave);

/**
 * @openapi
 * /api/v1/waitlist/{id}/position:
 *   get:
 *     summary: Get position in waitlist
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/position', authenticate, waitlistController.getPosition);

export default router;
