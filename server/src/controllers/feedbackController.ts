/**
 * =============================================================================
 * Campus Resource Engine - Feedback Controller (US 5.8)
 * =============================================================================
 * HTTP handlers for feedback management
 * =============================================================================
 */

import { Request, Response } from 'express';
import { feedbackService } from '../services/feedbackService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    departmentId: string;
  };
}

export const feedbackController = {
  /**
   * Get all feedback (Admin only)
   * GET /api/v1/feedback
   */
  getAllFeedback: asyncHandler(async (req: Request, res: Response) => {
    const { status, category, roomId, priority, page, limit } = req.query;

    const result = await feedbackService.getFeedback({
      status: status as any,
      category: category as any,
      roomId: roomId as string,
      priority: priority as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.feedback,
      pagination: {
        total: result.total,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        totalPages: Math.ceil(result.total / (limit ? parseInt(limit as string) : 20)),
      },
    });
  }),

  /**
   * Get feedback by ID
   * GET /api/v1/feedback/:id
   */
  getFeedbackById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const feedback = await feedbackService.getFeedbackById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: { message: 'Feedback not found' },
      });
    }

    res.json({
      success: true,
      data: feedback,
    });
  }),

  /**
   * Create feedback (Any authenticated user)
   * POST /api/v1/feedback
   */
  createFeedback: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { roomId, bookingId, category, title, description, priority } = req.body;

    const feedback = await feedbackService.createFeedback(userId, {
      roomId,
      bookingId,
      category,
      title,
      description,
      priority,
    });

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully',
    });
  }),

  /**
   * Update feedback (Admin only)
   * PATCH /api/v1/feedback/:id
   */
  updateFeedback: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user!.userId;
    const { status, priority, adminNotes } = req.body;

    const feedback = await feedbackService.updateFeedback(id, adminId, {
      status,
      priority,
      adminNotes,
    });

    res.json({
      success: true,
      data: feedback,
      message: 'Feedback updated successfully',
    });
  }),

  /**
   * Delete feedback (Admin only)
   * DELETE /api/v1/feedback/:id
   */
  deleteFeedback: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await feedbackService.deleteFeedback(id);

    res.json({
      success: true,
      message: 'Feedback deleted successfully',
    });
  }),

  /**
   * Get feedback stats (Admin only)
   * GET /api/v1/feedback/stats
   */
  getFeedbackStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await feedbackService.getFeedbackStats();

    res.json({
      success: true,
      data: stats,
    });
  }),

  /**
   * Get my feedback (Current user)
   * GET /api/v1/feedback/my
   */
  getMyFeedback: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const feedback = await feedbackService.getUserFeedback(userId);

    res.json({
      success: true,
      data: feedback,
    });
  }),
};
