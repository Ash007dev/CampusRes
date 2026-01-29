/**
 * =============================================================================
 * Campus Resource Engine - Room Controller
 * =============================================================================
 * HTTP request handlers for room endpoints
 * =============================================================================
 */

import { Request, Response } from 'express';
import { roomService } from '../services/roomService.js';
import { asyncHandler, type AuthenticatedRequest } from '../middleware/index.js';
import { HTTP_STATUS } from '../config/constants.js';
import type { CreateRoomInput, RoomQueryInput } from '../utils/validators.js';

/**
 * =============================================================================
 * ROOM CONTROLLER
 * =============================================================================
 */
export const roomController = {
  /**
   * Create a new room (Admin only)
   * POST /api/v1/rooms
   */
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateRoomInput;
    
    const room = await roomService.createRoom(input);
    
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: room,
      message: 'Room created successfully',
    });
  }),

  /**
   * Get room by ID
   * GET /api/v1/rooms/:id
   */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const room = await roomService.getRoomById(id);
    
    if (!room) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: { message: 'Room not found', code: 'ROOM_3001' },
      });
      return;
    }
    
    res.json({
      success: true,
      data: room,
    });
  }),

  /**
   * Search rooms with filters
   * GET /api/v1/rooms
   */
  search: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as RoomQueryInput;
    
    const result = await roomService.searchRooms(query);
    
    res.json({
      success: true,
      data: result.rooms,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  }),

  /**
   * Find best-fit rooms for attendee count
   * GET /api/v1/rooms/best-fit
   */
  findBestFit: asyncHandler(async (req: Request, res: Response) => {
    const { attendeeCount, departmentId, amenities, date } = req.query as {
      attendeeCount: string;
      departmentId?: string;
      amenities?: string;
      date?: string;
    };
    
    const rooms = await roomService.findBestFitRooms(
      parseInt(attendeeCount, 10),
      {
        departmentId,
        amenities: amenities?.split(','),
        date,
      }
    );
    
    res.json({
      success: true,
      data: rooms,
      message: `Found ${rooms.length} rooms that can accommodate ${attendeeCount} people`,
    });
  }),

  /**
   * Update room (Admin only)
   * PATCH /api/v1/rooms/:id
   */
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const input = req.body as Partial<CreateRoomInput>;
    
    const room = await roomService.updateRoom(id, input);
    
    res.json({
      success: true,
      data: room,
      message: 'Room updated successfully',
    });
  }),

  /**
   * Set room maintenance status (Admin only)
   * PATCH /api/v1/rooms/:id/maintenance
   */
  setMaintenance: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isMaintenance } = req.body as { isMaintenance: boolean };
    
    const room = await roomService.setMaintenanceStatus(id, isMaintenance);
    
    res.json({
      success: true,
      data: room,
      message: isMaintenance 
        ? 'Room set to maintenance mode' 
        : 'Room maintenance mode disabled',
    });
  }),

  /**
   * Get rooms by building
   * GET /api/v1/rooms/by-building
   */
  getByBuilding: asyncHandler(async (_req: Request, res: Response) => {
    const roomsByBuilding = await roomService.getRoomsByBuilding();
    
    res.json({
      success: true,
      data: roomsByBuilding,
    });
  }),

  /**
   * Get department rooms
   * GET /api/v1/rooms/department/:departmentId
   */
  getDepartmentRooms: asyncHandler(async (req: Request, res: Response) => {
    const { departmentId } = req.params;
    
    const rooms = await roomService.getDepartmentRooms(departmentId);
    
    res.json({
      success: true,
      data: rooms,
    });
  }),
};
