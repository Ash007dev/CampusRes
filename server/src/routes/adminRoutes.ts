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

export default router;
