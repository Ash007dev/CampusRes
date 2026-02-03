/**
 * =============================================================================
 * Campus Resource Engine - Holiday Routes
 * =============================================================================
 * API routes for holiday management (US 5.5)
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import { holidayController } from '../controllers/holidayController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/holidays:
 *   get:
 *     summary: Get all holidays
 *     tags: [Holidays]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [HOLIDAY, WEEKEND, MAINTENANCE, CUSTOM]
 *     responses:
 *       200:
 *         description: List of holidays
 */
router.get('/', holidayController.getHolidays);

/**
 * @openapi
 * /api/v1/holidays/range:
 *   get:
 *     summary: Get holidays in a date range
 *     tags: [Holidays]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of holidays in range
 */
router.get('/range', holidayController.getHolidaysInRange);

/**
 * @openapi
 * /api/v1/holidays/check/{date}:
 *   get:
 *     summary: Check if a date is a holiday
 *     tags: [Holidays]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Holiday check result
 */
router.get('/check/:date', holidayController.checkHoliday);

/**
 * @openapi
 * /api/v1/holidays:
 *   post:
 *     summary: Add a new holiday (Admin only)
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - name
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [HOLIDAY, WEEKEND, MAINTENANCE, CUSTOM]
 *               description:
 *                 type: string
 *               isRecurring:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Holiday created
 */
router.post('/', authenticate, authorize(['ADMIN']), holidayController.addHoliday);

/**
 * @openapi
 * /api/v1/holidays/{id}:
 *   patch:
 *     summary: Update a holiday (Admin only)
 *     tags: [Holidays]
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
 *         description: Holiday updated
 */
router.patch('/:id', authenticate, authorize(['ADMIN']), holidayController.updateHoliday);

/**
 * @openapi
 * /api/v1/holidays/{id}:
 *   delete:
 *     summary: Delete a holiday (Admin only)
 *     tags: [Holidays]
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
 *         description: Holiday deleted
 */
router.delete('/:id', authenticate, authorize(['ADMIN']), holidayController.deleteHoliday);

/**
 * @openapi
 * /api/v1/holidays/bulk-delete:
 *   post:
 *     summary: Bulk delete holidays (Admin only)
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Holidays deleted
 */
router.post('/bulk-delete', authenticate, authorize(['ADMIN']), holidayController.bulkDeleteHolidays);

export default router;
