/**
 * =============================================================================
 * Campus Resource Engine - Feedback Service (US 5.8)
 * =============================================================================
 * Service for managing room feedback and issue reports
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';

export type FeedbackCategory = 'AC_ISSUE' | 'CLEANLINESS' | 'EQUIPMENT' | 'NOISE' | 'LIGHTING' | 'OTHER';
export type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface Feedback {
  id: string;
  roomId: string;
  userId: string;
  bookingId?: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  status: FeedbackStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  adminNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  room?: {
    id: string;
    name: string;
    code: string;
    building: string;
  };
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateFeedbackInput {
  roomId: string;
  bookingId?: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface UpdateFeedbackInput {
  status?: FeedbackStatus;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  adminNotes?: string;
}

export const feedbackService = {
  /**
   * Get all feedback with filters
   */
  async getFeedback(params: {
    status?: FeedbackStatus;
    category?: FeedbackCategory;
    roomId?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }): Promise<{ feedback: Feedback[]; total: number }> {
    const { status, category, roomId, priority, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('feedback')
      .select(`
        *,
        rooms:room_id (id, name, code, building),
        users:user_id (id, email, first_name, last_name)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (roomId) {
      query = query.eq('room_id', roomId);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.warn('Feedback table does not exist yet. Run the migration first.');
        return { feedback: [], total: 0 };
      }
      logger.error({ error }, 'Failed to fetch feedback');
      throw new Error('Failed to fetch feedback');
    }

    // Transform snake_case to camelCase
    const feedback = (data || []).map((f: any) => ({
      id: f.id,
      roomId: f.room_id,
      userId: f.user_id,
      bookingId: f.booking_id,
      category: f.category,
      title: f.title,
      description: f.description,
      status: f.status,
      priority: f.priority,
      adminNotes: f.admin_notes,
      resolvedAt: f.resolved_at,
      resolvedBy: f.resolved_by,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      room: f.rooms ? {
        id: f.rooms.id,
        name: f.rooms.name,
        code: f.rooms.code,
        building: f.rooms.building,
      } : undefined,
      user: f.users ? {
        id: f.users.id,
        email: f.users.email,
        firstName: f.users.first_name,
        lastName: f.users.last_name,
      } : undefined,
    }));

    return { feedback, total: count || 0 };
  },

  /**
   * Get feedback by ID
   */
  async getFeedbackById(id: string): Promise<Feedback | null> {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        *,
        rooms:room_id (id, name, code, building),
        users:user_id (id, email, first_name, last_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      roomId: data.room_id,
      userId: data.user_id,
      bookingId: data.booking_id,
      category: data.category,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      adminNotes: data.admin_notes,
      resolvedAt: data.resolved_at,
      resolvedBy: data.resolved_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      room: data.rooms ? {
        id: data.rooms.id,
        name: data.rooms.name,
        code: data.rooms.code,
        building: data.rooms.building,
      } : undefined,
      user: data.users ? {
        id: data.users.id,
        email: data.users.email,
        firstName: data.users.first_name,
        lastName: data.users.last_name,
      } : undefined,
    };
  },

  /**
   * Create new feedback (by user)
   */
  async createFeedback(userId: string, input: CreateFeedbackInput): Promise<Feedback> {
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        room_id: input.roomId,
        user_id: userId,
        booking_id: input.bookingId || null,
        category: input.category,
        title: input.title,
        description: input.description,
        priority: input.priority || 'MEDIUM',
        status: 'OPEN',
      })
      .select()
      .single();

    if (error || !data) {
      // If table doesn't exist, throw a helpful error
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        logger.error('Feedback table does not exist. Run the migration first.');
        throw new Error('Feedback system not configured. Please contact admin.');
      }
      logger.error({ error, input }, 'Failed to create feedback');
      throw new Error('Failed to create feedback');
    }

    logger.info({ feedbackId: data.id, roomId: input.roomId, userId }, 'Feedback created');

    return {
      id: data.id,
      roomId: data.room_id,
      userId: data.user_id,
      bookingId: data.booking_id,
      category: data.category,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      adminNotes: data.admin_notes,
      resolvedAt: data.resolved_at,
      resolvedBy: data.resolved_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Update feedback (admin only)
   */
  async updateFeedback(id: string, adminId: string, input: UpdateFeedbackInput): Promise<Feedback> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.status) {
      updateData.status = input.status;
      if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = adminId;
      }
    }
    if (input.priority) {
      updateData.priority = input.priority;
    }
    if (input.adminNotes !== undefined) {
      updateData.admin_notes = input.adminNotes;
    }

    const { data, error } = await supabase
      .from('feedback')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      logger.error({ error, id, input }, 'Failed to update feedback');
      throw new Error('Failed to update feedback');
    }

    logger.info({ feedbackId: id, adminId, status: input.status }, 'Feedback updated');

    return {
      id: data.id,
      roomId: data.room_id,
      userId: data.user_id,
      bookingId: data.booking_id,
      category: data.category,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      adminNotes: data.admin_notes,
      resolvedAt: data.resolved_at,
      resolvedBy: data.resolved_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Delete feedback
   */
  async deleteFeedback(id: string): Promise<void> {
    const { error } = await supabase
      .from('feedback')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ error, id }, 'Failed to delete feedback');
      throw new Error('Failed to delete feedback');
    }

    logger.info({ feedbackId: id }, 'Feedback deleted');
  },

  /**
   * Get feedback stats for dashboard
   */
  async getFeedbackStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const { data, error } = await supabase
      .from('feedback')
      .select('status, category, priority');

    if (error) {
      // If table doesn't exist, return empty stats
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.warn('Feedback table does not exist yet. Run the migration first.');
        return {
          total: 0,
          open: 0,
          inProgress: 0,
          resolved: 0,
          byCategory: {},
          byPriority: {},
        };
      }
      logger.error({ error }, 'Failed to fetch feedback stats');
      throw new Error('Failed to fetch feedback stats');
    }

    const stats = {
      total: data?.length || 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      byCategory: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
    };

    (data || []).forEach((f: any) => {
      // Count by status
      if (f.status === 'OPEN') stats.open++;
      else if (f.status === 'IN_PROGRESS') stats.inProgress++;
      else if (f.status === 'RESOLVED' || f.status === 'CLOSED') stats.resolved++;

      // Count by category
      stats.byCategory[f.category] = (stats.byCategory[f.category] || 0) + 1;

      // Count by priority
      stats.byPriority[f.priority] = (stats.byPriority[f.priority] || 0) + 1;
    });

    return stats;
  },

  /**
   * Get user's own feedback
   */
  async getUserFeedback(userId: string): Promise<Feedback[]> {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        *,
        rooms:room_id (id, name, code, building)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.warn('Feedback table does not exist yet. Run the migration first.');
        return [];
      }
      logger.error({ error, userId }, 'Failed to fetch user feedback');
      throw new Error('Failed to fetch user feedback');
    }

    return (data || []).map((f: any) => ({
      id: f.id,
      roomId: f.room_id,
      userId: f.user_id,
      bookingId: f.booking_id,
      category: f.category,
      title: f.title,
      description: f.description,
      status: f.status,
      priority: f.priority,
      adminNotes: f.admin_notes,
      resolvedAt: f.resolved_at,
      resolvedBy: f.resolved_by,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      room: f.rooms ? {
        id: f.rooms.id,
        name: f.rooms.name,
        code: f.rooms.code,
        building: f.rooms.building,
      } : undefined,
    }));
  },
};
