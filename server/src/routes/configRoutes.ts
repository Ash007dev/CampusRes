/**
 * =============================================================================
 * Campus Resource Engine - Configuration Routes (US 5.9)
 * =============================================================================
 * API routes for system configuration management
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import { configController } from '../controllers/configController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/config:
 *   get:
 *     summary: Get all configuration settings
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, booking, notification, security]
 *     responses:
 *       200:
 *         description: Configuration list retrieved
 */
router.get('/', authenticate, configController.getAllConfig);

/**
 * @openapi
 * /api/v1/config/booking/constraints:
 *   get:
 *     summary: Get booking time constraints (public)
 *     tags: [Configuration]
 *     responses:
 *       200:
 *         description: Booking constraints retrieved
 */
router.get('/booking/constraints', configController.getBookingConstraints);

/**
 * @openapi
 * /api/v1/config/:key:
 *   get:
 *     summary: Get configuration by key
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuration value retrieved
 *       404:
 *         description: Configuration not found
 */
router.get('/:key', authenticate, configController.getConfigByKey);

/**
 * @openapi
 * /api/v1/config:
 *   post:
 *     summary: Create new configuration (Admin only)
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, value, dataType, category]
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *               dataType:
 *                 type: string
 *                 enum: [string, number, boolean, json, time]
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [general, booking, notification, security]
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Configuration created
 */
router.post('/', authenticate, authorize(['ADMIN', 'LAB_ADMIN']), configController.createConfig);

/**
 * @openapi
 * /api/v1/config/:key:
 *   patch:
 *     summary: Update configuration (Admin only)
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuration updated
 */
router.patch('/:key', authenticate, authorize(['ADMIN', 'LAB_ADMIN']), configController.updateConfig);

/**
 * @openapi
 * /api/v1/config/:key:
 *   delete:
 *     summary: Delete configuration (Admin only)
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuration deleted
 */
router.delete('/:key', authenticate, authorize(['ADMIN']), configController.deleteConfig);

/**
 * @openapi
 * /api/v1/config/cache/clear:
 *   post:
 *     summary: Clear configuration cache (Admin only)
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared
 */
router.post('/cache/clear', authenticate, authorize(['ADMIN']), configController.clearCache);

export default router;
