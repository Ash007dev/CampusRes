/**
 * =============================================================================
 * Campus Resource Engine - Room Routes
 * =============================================================================
 * Route definitions for room endpoints
 * =============================================================================
 */

import { Router, type IRouter } from 'express';
import { roomController } from '../controllers/roomController.js';
import {
  authenticate,
  authorize,
  validate,
} from '../middleware/index.js';
import { createRoomSchema, updateRoomSchema, roomQuerySchema } from '../utils/validators.js';

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/rooms:
 *   get:
 *     summary: Search rooms with filters
 *     tags: [Rooms]
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
 *         name: departmentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: minCapacity
 *         schema:
 *           type: integer
 *       - in: query
 *         name: amenities
 *         schema:
 *           type: string
 *         description: Comma-separated list of amenities
 */
router.get(
  '/',
  validate(roomQuerySchema, 'query'),
  roomController.search
);

/**
 * @openapi
 * /api/v1/rooms/available-now:
 *   get:
 *     summary: Get rooms with real-time availability status (US 3.3)
 *     tags: [Rooms]
 *     description: Returns rooms with availability state (AVAILABLE, PENDING_CHECKIN, or OCCUPIED)
 */
router.get('/available-now', roomController.getAvailableNow);

/**
 * @openapi
 * /api/v1/rooms/best-fit:
 *   get:
 *     summary: Find best-fit rooms for attendee count
 *     tags: [Rooms]
 */
router.get('/best-fit', roomController.findBestFit);

/**
 * @openapi
 * /api/v1/rooms/by-building:
 *   get:
 *     summary: Get rooms grouped by building
 *     tags: [Rooms]
 */
router.get('/by-building', roomController.getByBuilding);

/**
 * @openapi
 * /api/v1/rooms/department/{departmentId}:
 *   get:
 *     summary: Get rooms for a department
 *     tags: [Rooms]
 */
router.get('/department/:departmentId', roomController.getDepartmentRooms);

/**
 * @openapi
 * /api/v1/rooms/{id}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 */
router.get('/:id', roomController.getById);

/**
 * @openapi
 * /api/v1/rooms:
 *   post:
 *     summary: Create a new room (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  authenticate,
  authorize(['ADMIN']),
  validate(createRoomSchema, 'body'),
  roomController.create
);

/**
 * @openapi
 * /api/v1/rooms/{id}:
 *   patch:
 *     summary: Update room (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  validate(updateRoomSchema, 'body'),
  roomController.update
);

/**
 * @openapi
 * /api/v1/rooms/{id}/maintenance:
 *   patch:
 *     summary: Set room maintenance status (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id/maintenance',
  authenticate,
  authorize(['ADMIN']),
  roomController.setMaintenance
);

export default router;
