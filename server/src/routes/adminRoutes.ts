/**
 * =============================================================================
 * Campus Resource Engine - Admin Routes
 * =============================================================================
 * Route definitions for admin-protected endpoints
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import { adminController } from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/index.js';

const router: IRouter = Router();

// All routes here require ADMIN role
router.use(authenticate);
router.use(authorize(['ADMIN']));

/**
 * @openapi
 * /api/v1/admin/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', adminController.getStats);

/**
 * @openapi
 * /api/v1/admin/audit-logs:
 *   get:
 *     summary: Get system audit logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/audit-logs', adminController.getAuditLogs);

/**
 * @openapi
 * /api/v1/admin/broadcast:
 *   post:
 *     summary: Send broadcast email to all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/broadcast', adminController.sendBroadcast);

/**
 * @openapi
 * /api/v1/admin/demand-forecast:
 *   get:
 *     summary: Get predicted daily demand forecast (US 1)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of historical days to analyze
 */
router.get('/demand-forecast', adminController.getDemandForecast);

/**
 * @openapi
 * /api/v1/admin/underutilized-rooms:
 *   get:
 *     summary: Get underutilized rooms with trends and suggestions (US 3)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Utilization % below which a room is underutilized
 */
router.get('/underutilized-rooms', adminController.getUnderutilizedRooms);

/**
 * @openapi
 * /api/v1/admin/no-show-report:
 *   get:
 *     summary: Get no-show frequency report with escalation tiers (US 4)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/no-show-report', adminController.getNoShowReport);

/**
 * @openapi
 * /api/v1/admin/no-show-reset/{userId}:
 *   post:
 *     summary: Reset a user's no-show escalation tier (US 4)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/no-show-reset/:userId', adminController.resetNoShowTier);

/**
 * @openapi
 * /api/v1/admin/room-adjacency:
 *   post:
 *     summary: Set room adjacency for noise compatibility checks (US 5)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roomId, adjacentRoomId]
 *             properties:
 *               roomId:
 *                 type: string
 *               adjacentRoomId:
 *                 type: string
 */
router.post('/room-adjacency', adminController.setRoomAdjacency);

export default router;
