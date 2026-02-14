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
import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { sendBroadcastEmail } from '../services/emailService.js';

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

    /**
     * Send broadcast email to all users
     * POST /api/v1/admin/broadcast
     */
    sendBroadcast: asyncHandler(async (req: Request, res: Response) => {
        const { subject, message } = req.body;

        if (!subject || !message) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'Subject and message are required' },
            });
            return;
        }

        // Fetch all users
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, first_name, last_name');

        if (error || !users) {
            logger.error({ error }, 'Broadcast: Failed to fetch users');
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: { message: 'Failed to fetch users for broadcast' },
            });
            return;
        }

        logger.info({ userCount: users.length, subject }, '📢 Sending broadcast email to all users');

        // Deduplicate by email to avoid sending multiple emails to the same address
        const seenEmails = new Set<string>();
        const uniqueUsers = users.filter((user: any) => {
            const email = (user.email || '').toLowerCase();
            if (!email || seenEmails.has(email)) return false;
            seenEmails.add(email);
            return true;
        });

        logger.info({ uniqueCount: uniqueUsers.length, totalRows: users.length }, '📢 Deduplicated user list');

        // Send email to each user
        let successCount = 0;
        let failCount = 0;

        const emailPromises = uniqueUsers.map(async (user: any) => {
            const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
            try {
                const sent = await sendBroadcastEmail(user.email, userName, { subject, message });
                if (sent) successCount++;
                else failCount++;
            } catch (err) {
                failCount++;
                logger.error({ userId: user.id, error: err }, 'Broadcast: Failed to send to user');
            }
        });

        await Promise.all(emailPromises);

        // Audit log
        const performedBy = (req as any).user?.id;
        await supabase.from('audit_logs').insert({
            action: 'BROADCAST_SENT',
            entity_type: 'system',
            performed_by_id: performedBy,
            details: { subject, recipientCount: users.length, successCount, failCount },
        }).then(({ error: auditError }) => {
            if (auditError) logger.error({ auditError }, 'Broadcast: Failed to write audit log');
        });

        logger.info({ successCount, failCount, total: users.length }, '📢 Broadcast complete');

        res.json({
            success: true,
            data: {
                recipientCount: users.length,
                successCount,
                failCount,
            },
        });
    }),
};
