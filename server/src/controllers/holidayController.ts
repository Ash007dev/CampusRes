/**
 * =============================================================================
 * Campus Resource Engine - Holiday Controller
 * =============================================================================
 * Handles HTTP requests for holiday management
 * =============================================================================
 */

import { Request, Response } from 'express';
import { holidayService } from '../services/holidayService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { HTTP_STATUS } from '../config/constants.js';

export const holidayController = {
  /**
   * Get all holidays
   * GET /api/v1/holidays
   */
  getHolidays: asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, type, page = 1, limit = 100 } = req.query;

    const result = await holidayService.getHolidays({
      startDate: startDate as string,
      endDate: endDate as string,
      type: type as string,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: result.holidays,
      meta: {
        total: result.total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(result.total / Number(limit)),
      },
    });
  }),

  /**
   * Check if a date is a holiday
   * GET /api/v1/holidays/check/:date
   */
  checkHoliday: asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.params;

    const result = await holidayService.isHoliday(date);

    res.json({
      success: true,
      data: result,
    });
  }),

  /**
   * Get holidays in a date range
   * GET /api/v1/holidays/range
   */
  getHolidaysInRange: asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'startDate and endDate are required', code: 'HOLIDAY_001' },
      });
      return;
    }

    const holidays = await holidayService.getHolidaysInRange(
      startDate as string,
      endDate as string
    );

    res.json({
      success: true,
      data: holidays,
    });
  }),

  /**
   * Add a new holiday (Admin only)
   * POST /api/v1/holidays
   */
  addHoliday: asyncHandler(async (req: Request, res: Response) => {
    const { date, name, type, description, isRecurring } = req.body;

    if (!date || !name) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'date and name are required', code: 'HOLIDAY_002' },
      });
      return;
    }

    const holiday = await holidayService.addHoliday({
      date,
      name,
      type,
      description,
      isRecurring,
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: holiday,
      message: 'Holiday added successfully',
    });
  }),

  /**
   * Update a holiday (Admin only)
   * PATCH /api/v1/holidays/:id
   */
  updateHoliday: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { date, name, type, description, isRecurring } = req.body;

    const holiday = await holidayService.updateHoliday(id, {
      date,
      name,
      type,
      description,
      isRecurring,
    });

    res.json({
      success: true,
      data: holiday,
      message: 'Holiday updated successfully',
    });
  }),

  /**
   * Delete a holiday (Admin only)
   * DELETE /api/v1/holidays/:id
   */
  deleteHoliday: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await holidayService.deleteHoliday(id);

    res.json({
      success: true,
      message: 'Holiday deleted successfully',
    });
  }),

  /**
   * Bulk delete holidays (Admin only)
   * POST /api/v1/holidays/bulk-delete
   */
  bulkDeleteHolidays: asyncHandler(async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: { message: 'ids array is required', code: 'HOLIDAY_003' },
      });
      return;
    }

    const count = await holidayService.bulkDeleteHolidays(ids);

    res.json({
      success: true,
      message: `${count} holidays deleted successfully`,
    });
  }),
};
