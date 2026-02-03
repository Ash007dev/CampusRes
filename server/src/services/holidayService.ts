/**
 * =============================================================================
 * Campus Resource Engine - Holiday Service
 * =============================================================================
 * Manages holiday/blocked dates for the booking system
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'HOLIDAY' | 'WEEKEND' | 'MAINTENANCE' | 'CUSTOM';
  description?: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export const holidayService = {
  /**
   * Get all holidays with optional filters
   */
  async getHolidays(options: {
    startDate?: string;
    endDate?: string;
    type?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ holidays: Holiday[]; total: number }> {
    const { startDate, endDate, type, page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;

    let query = supabase
      .from('holidays')
      .select('*', { count: 'exact' });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    if (type) {
      query = query.eq('type', type);
    }

    query = query.order('date', { ascending: true }).range(skip, skip + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      logger.error({ error }, 'Failed to fetch holidays');
      return { holidays: [], total: 0 };
    }

    return {
      holidays: (data || []).map((h: any) => ({
        id: h.id,
        date: h.date,
        name: h.name,
        type: h.type,
        description: h.description,
        isRecurring: h.is_recurring,
        createdAt: h.created_at,
        updatedAt: h.updated_at,
      })),
      total: count || 0,
    };
  },

  /**
   * Check if a specific date is a holiday
   */
  async isHoliday(date: string): Promise<{ isHoliday: boolean; holiday?: Holiday }> {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('date', date)
      .limit(1)
      .single();

    if (error || !data) {
      return { isHoliday: false };
    }

    return {
      isHoliday: true,
      holiday: {
        id: data.id,
        date: data.date,
        name: data.name,
        type: data.type,
        description: data.description,
        isRecurring: data.is_recurring,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  },

  /**
   * Get holidays for a date range (for calendar display)
   */
  async getHolidaysInRange(startDate: string, endDate: string): Promise<Holiday[]> {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      logger.error({ error }, 'Failed to fetch holidays in range');
      return [];
    }

    return (data || []).map((h: any) => ({
      id: h.id,
      date: h.date,
      name: h.name,
      type: h.type,
      description: h.description,
      isRecurring: h.is_recurring,
      createdAt: h.created_at,
      updatedAt: h.updated_at,
    }));
  },

  /**
   * Add a new holiday (Admin only)
   */
  async addHoliday(data: {
    date: string;
    name: string;
    type?: string;
    description?: string;
    isRecurring?: boolean;
  }): Promise<Holiday> {
    const { data: holiday, error } = await supabase
      .from('holidays')
      .insert({
        date: data.date,
        name: data.name,
        type: data.type || 'HOLIDAY',
        description: data.description,
        is_recurring: data.isRecurring || false,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to add holiday');
      throw new Error(error.message);
    }

    return {
      id: holiday.id,
      date: holiday.date,
      name: holiday.name,
      type: holiday.type,
      description: holiday.description,
      isRecurring: holiday.is_recurring,
      createdAt: holiday.created_at,
      updatedAt: holiday.updated_at,
    };
  },

  /**
   * Update a holiday (Admin only)
   */
  async updateHoliday(id: string, data: {
    date?: string;
    name?: string;
    type?: string;
    description?: string;
    isRecurring?: boolean;
  }): Promise<Holiday> {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (data.date) updateData.date = data.date;
    if (data.name) updateData.name = data.name;
    if (data.type) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isRecurring !== undefined) updateData.is_recurring = data.isRecurring;

    const { data: holiday, error } = await supabase
      .from('holidays')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to update holiday');
      throw new Error(error.message);
    }

    return {
      id: holiday.id,
      date: holiday.date,
      name: holiday.name,
      type: holiday.type,
      description: holiday.description,
      isRecurring: holiday.is_recurring,
      createdAt: holiday.created_at,
      updatedAt: holiday.updated_at,
    };
  },

  /**
   * Delete a holiday (Admin only)
   */
  async deleteHoliday(id: string): Promise<void> {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ error }, 'Failed to delete holiday');
      throw new Error(error.message);
    }
  },

  /**
   * Bulk delete holidays (Admin only)
   */
  async bulkDeleteHolidays(ids: string[]): Promise<number> {
    const { error, count } = await supabase
      .from('holidays')
      .delete()
      .in('id', ids);

    if (error) {
      logger.error({ error }, 'Failed to bulk delete holidays');
      throw new Error(error.message);
    }

    return count || 0;
  },
};
