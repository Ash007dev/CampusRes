/**
 * =============================================================================
 * Campus Resource Engine - Admin Controller
 * =============================================================================
 * HTTP request handlers for admin-only endpoints
 * =============================================================================
 */

import { Request, Response } from 'express';
import { adminService } from '../services/adminService.js';
import { asyncHandler } from '../middleware/index.js';
import { HTTP_STATUS } from '../config/constants.js';

export const adminController = {
    /**
     * Get dashboard statistics
     * GET /api/v1/admin/stats
     */
    getStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await adminService.getDashboardStats();

        res.json({
            success: true,
            data: stats,
        });
    }),

    /**
     * Get audit logs
     * GET /api/v1/admin/audit-logs
     */
    getAuditLogs: asyncHandler(async (req: Request, res: Response) => {
        const { page, limit, userId, action, entityType } = req.query;

        const result = await adminService.getAuditLogs({
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 20,
            userId: userId as string,
            action: action as string,
            entityType: entityType as string,
        });

        res.json({
            success: true,
            data: result.logs,
            meta: {
                total: result.total,
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 20,
                totalPages: Math.ceil(result.total / (limit ? parseInt(limit as string) : 20)),
            },
        });
    }),
};
