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
 * /api/v1/admin/emergency-override:
 *   post:
 *     summary: Emergency override - cancel bookings for rooms/date range
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/emergency-override', adminController.emergencyOverride);

/**
 * @openapi
 * /api/v1/admin/emergency-overrides:
 *   get:
 *     summary: Get emergency override records for calendar display
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/emergency-overrides', adminController.getEmergencyOverrides);

export default router;
