/**
 * =============================================================================
 * Campus Resource Engine - Admin Controller
 * =============================================================================
 * HTTP request handlers for admin-only endpoints
 * =============================================================================
 */

import { Request, Response } from 'express';
import { adminService } from '../services/adminService.js';
import { bookingService } from '../services/bookingService.js';
import { asyncHandler } from '../middleware/index.js';
import { HTTP_STATUS } from '../config/constants.js';
import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { sendBroadcastEmail } from '../services/emailService.js';
import { logAudit } from '../utils/auditLogger.js';

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

        // Helper to ensure UTC
        const formatTimestamp = (ts: string | null | undefined) => {
            if (!ts) return ts;
            return ts.endsWith('Z') ? ts : `${ts}Z`;
        };

        const formattedLogs = result.logs.map((log: any) => {
            const formattedLog: any = {
                id: log.id,
                action: log.action,
                entityType: log.entity_type,
                entityId: log.entity_id,
                performedBy: log.performed_by,
                createdAt: formatTimestamp(log.created_at),
                previousState: log.previous_state,
                newState: log.new_state,
                oldState: log.previous_state,
                new_state: log.new_state,
                previous_state: log.previous_state,
                metadata: log.metadata,
                ipAddress: log.ip_address,
                userAgent: log.user_agent,
            };

            if (log.booking) {
                formattedLog.booking = {
                    ...log.booking,
                    startTime: formatTimestamp(log.booking.startTime),
                    endTime: formatTimestamp(log.booking.endTime),
                };
            }
            return formattedLog;
        });

        res.json({
            success: true,
            data: formattedLogs,
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
        await logAudit({
            action: 'BROADCAST_SENT',
            entity_type: 'system',
            entity_id: 'broadcast',
            performed_by_id: performedBy,
            details: { subject, recipientCount: users.length, successCount, failCount },
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

    /**
     * Emergency override: cancel all bookings for selected rooms and date range
     * POST /api/v1/admin/emergency-override
     */
    emergencyOverride: asyncHandler(async (req: Request, res: Response) => {
        const { rooms, startDate, endDate, reason } = req.body;
        const adminUserId = (req as any).user?.id;

        if (!rooms || !Array.isArray(rooms) || rooms.length === 0 || !startDate || !endDate) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'rooms (array), startDate, and endDate are required' },
            });
            return;
        }

        logger.info({ adminUserId, rooms, startDate, endDate, reason }, '🚨 Emergency override initiated');

        const result = await bookingService.emergencyOverrideBookings({
            startDate,
            endDate,
            roomIds: rooms,
            adminUserId,
            reason,
        });

        // Store the override record for calendar display
        const { data: overrideRecord, error: insertError } = await supabase
            .from('emergency_overrides')
            .insert({
                start_time: startDate,
                end_time: endDate,
                reason: reason || 'Emergency override',
                created_by: adminUserId,
                cancelled_count: result.cancelled,
            })
            .select('id')
            .single();

        if (!insertError && overrideRecord) {
            const roomRows = rooms.map((roomId: string) => ({
                override_id: overrideRecord.id,
                room_id: roomId,
            }));
            await supabase.from('emergency_override_rooms').insert(roomRows);
        }

        // Audit log
        await logAudit({
            action: 'EMERGENCY_OVERRIDE',
            entity_type: 'booking',
            entity_id: 'emergency-override',
            performed_by_id: adminUserId,
            details: { rooms, startDate, endDate, reason, cancelledCount: result.cancelled },
        });

        const affectedUsers = result.affected.map((b: any) => b.users?.email).filter(Boolean);
        const uniqueUsers = [...new Set(affectedUsers)];

        res.json({
            success: true,
            data: {
                cancelledCount: result.cancelled,
                affectedUsers: uniqueUsers,
                message: `${result.cancelled} bookings cancelled. ${uniqueUsers.length} users notified.`,
            },
        });
    }),

    /**
     * Get emergency overrides for calendar display
     * GET /api/v1/admin/emergency-overrides
     */
    getEmergencyOverrides: asyncHandler(async (req: Request, res: Response) => {
        const { startDate, endDate } = req.query;

        let query = supabase
            .from('emergency_overrides')
            .select('*, emergency_override_rooms(room_id, rooms:room_id(id, name))')
            .order('created_at', { ascending: false });

        if (startDate) {
            query = query.gte('end_time', startDate as string);
        }
        if (endDate) {
            query = query.lte('start_time', endDate as string);
        }

        const { data, error } = await query;

        if (error) {
            logger.error({ error }, 'Failed to fetch emergency overrides');
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: { message: 'Failed to fetch emergency overrides' },
            });
            return;
        }

        res.json({
            success: true,
            data: data || [],
        });
    }),
};
