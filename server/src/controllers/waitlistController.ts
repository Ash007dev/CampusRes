/**
 * =============================================================================
 * Campus Resource Engine - Waitlist Controller
 * =============================================================================
 * HTTP handlers for waitlist endpoints (US 3.7)
 * =============================================================================
 */

import { Response } from 'express';
import { waitlistService } from '../services/waitlistService.js';
import { asyncHandler, type AuthenticatedRequest } from '../middleware/index.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Waitlist Controller
 */
export const waitlistController = {
    /**
     * Join waitlist for a room slot
     * POST /api/v1/waitlist
     */
    join: asyncHandler(async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        const { roomId, startTime, endTime } = req.body;

        if (!roomId || !startTime || !endTime) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'roomId, startTime, and endTime are required', code: 'WAITLIST_4001' },
            });
            return;
        }

        const result = await waitlistService.joinWaitlist(
            authReq.user.userId,
            roomId,
            new Date(startTime),
            new Date(endTime)
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result,
            message: `Added to waitlist at position ${result.position}`,
        });
    }),

    /**
     * Leave waitlist
     * DELETE /api/v1/waitlist/:id
     */
    leave: asyncHandler(async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        const { id } = req.params;

        await waitlistService.leaveWaitlist(id, authReq.user.userId);

        res.json({
            success: true,
            message: 'Removed from waitlist',
        });
    }),

    /**
     * Get user's waitlist entries
     * GET /api/v1/waitlist/my
     */
    getMyEntries: asyncHandler(async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;

        const entries = await waitlistService.getUserWaitlistEntries(authReq.user.userId);

        res.json({
            success: true,
            data: entries,
        });
    }),

    /**
     * Get position for a specific entry
     * GET /api/v1/waitlist/:id/position
     */
    getPosition: asyncHandler(async (req, res: Response) => {
        const { id } = req.params;

        const position = await waitlistService.getPosition(id);

        res.json({
            success: true,
            data: { position },
        });
    }),
};
