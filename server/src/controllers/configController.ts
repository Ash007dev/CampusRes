/**
 * =============================================================================
 * Campus Resource Engine - Configuration Controller (US 5.9)
 * =============================================================================
 * HTTP handlers for system configuration management
 * =============================================================================
 */

import { Request, Response } from 'express';
import { configService } from '../services/configService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const configController = {
  /**
   * Get all configuration settings (admin gets all, users get public only)
   * GET /api/v1/config
   */
  getAllConfig: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { category } = req.query;
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'LAB_ADMIN';

    const config = await configService.getAllConfig({
      category: category as any,
      isPublic: isAdmin ? undefined : true, // Non-admins only see public config
    });

    res.json({
      success: true,
      data: config,
    });
  }),

  /**
   * Get configuration by key
   * GET /api/v1/config/:key
   */
  getConfigByKey: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { key } = req.params;

    // First check if config exists and is public or user is admin
    const allConfig = await configService.getAllConfig({});
    const configItem = allConfig.find(c => c.key === key);

    if (!configItem) {
      return res.status(404).json({
        success: false,
        error: { message: 'Configuration not found' },
      });
    }

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'LAB_ADMIN';
    if (!configItem.isPublic && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied to this configuration' },
      });
    }

    const value = await configService.getConfig(key);

    res.json({
      success: true,
      data: {
        key,
        value,
        dataType: configItem.dataType,
        description: configItem.description,
      },
    });
  }),

  /**
   * Update configuration (Admin only)
   * PATCH /api/v1/config/:key
   */
  updateConfig: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { key } = req.params;
    const adminId = req.user!.userId;
    const { value, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: 'Value is required' },
      });
    }

    const config = await configService.updateConfig(key, adminId, {
      value: String(value),
      description,
    });

    res.json({
      success: true,
      data: config,
      message: 'Configuration updated successfully',
    });
  }),

  /**
   * Create new configuration (Admin only)
   * POST /api/v1/config
   */
  createConfig: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user!.userId;
    const { key, value, dataType, description, category, isPublic } = req.body;

    if (!key || !value || !dataType || !category) {
      return res.status(400).json({
        success: false,
        error: { message: 'Key, value, dataType, and category are required' },
      });
    }

    const config = await configService.createConfig(adminId, {
      key,
      value: String(value),
      dataType,
      description,
      category,
      isPublic,
    });

    res.status(201).json({
      success: true,
      data: config,
      message: 'Configuration created successfully',
    });
  }),

  /**
   * Delete configuration (Admin only)
   * DELETE /api/v1/config/:key
   */
  deleteConfig: asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;

    await configService.deleteConfig(key);

    res.json({
      success: true,
      message: 'Configuration deleted successfully',
    });
  }),

  /**
   * Get booking time constraints (public endpoint)
   * GET /api/v1/config/booking/constraints
   */
  getBookingConstraints: asyncHandler(async (_req: Request, res: Response) => {
    const constraints = await configService.getBookingTimeConstraints();

    res.json({
      success: true,
      data: constraints,
    });
  }),

  /**
   * Clear config cache (Admin only, for testing/debugging)
   * POST /api/v1/config/cache/clear
   */
  clearCache: asyncHandler(async (_req: Request, res: Response) => {
    configService.clearCache();

    res.json({
      success: true,
      message: 'Configuration cache cleared',
    });
  }),
};
