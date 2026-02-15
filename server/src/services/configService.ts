/**
 * =============================================================================
 * Campus Resource Engine - Configuration Service (US 5.9)
 * =============================================================================
 * Service for managing dynamic system configuration
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';

export type ConfigDataType = 'string' | 'number' | 'boolean' | 'json' | 'time';
export type ConfigCategory = 'general' | 'booking' | 'notification' | 'security';

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  dataType: ConfigDataType;
  description?: string;
  category: ConfigCategory;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface UpdateConfigInput {
  value: string;
  description?: string;
}

// In-memory cache for frequently accessed config (optional, can use Redis)
const configCache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const configService = {
  /**
   * Get all configuration settings
   */
  async getAllConfig(params: {
    category?: ConfigCategory;
    isPublic?: boolean;
  }): Promise<SystemConfig[]> {
    const { category, isPublic } = params;

    let query = supabase
      .from('system_config')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }
    if (isPublic !== undefined) {
      query = query.eq('is_public', isPublic);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, 'Failed to fetch system config');
      throw new Error('Failed to fetch system config');
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      key: c.key,
      value: c.value,
      dataType: c.data_type,
      description: c.description,
      category: c.category,
      isPublic: c.is_public,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      updatedBy: c.updated_by,
    }));
  },

  /**
   * Get configuration by key with caching
   */
  async getConfig(key: string): Promise<any> {
    // Check cache first
    const cached = configCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }

    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', key)
      .single();

    if (error || !data) {
      logger.warn({ key }, 'Config key not found');
      return null;
    }

    // Parse value based on data type
    let parsedValue: any = data.value;
    switch (data.data_type) {
      case 'number':
        parsedValue = parseFloat(data.value);
        break;
      case 'boolean':
        parsedValue = data.value === 'true';
        break;
      case 'json':
        try {
          parsedValue = JSON.parse(data.value);
        } catch {
          logger.error({ key, value: data.value }, 'Failed to parse JSON config');
        }
        break;
      case 'time':
      case 'string':
      default:
        parsedValue = data.value;
    }

    // Update cache
    configCache.set(key, { value: parsedValue, timestamp: Date.now() });

    return parsedValue;
  },

  /**
   * Get multiple config values at once
   */
  async getMultipleConfig(keys: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const key of keys) {
      result[key] = await this.getConfig(key);
    }

    return result;
  },

  /**
   * Update configuration value (admin only)
   */
  async updateConfig(key: string, adminId: string, input: UpdateConfigInput): Promise<SystemConfig> {
    const updateData: any = {
      value: input.value,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    };

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    const { data, error } = await supabase
      .from('system_config')
      .update(updateData)
      .eq('key', key)
      .select()
      .single();

    if (error || !data) {
      logger.error({ error, key, input }, 'Failed to update config');
      throw new Error('Failed to update config');
    }

    // Invalidate cache
    configCache.delete(key);

    logger.info({ key, adminId }, 'Config updated');

    return {
      id: data.id,
      key: data.key,
      value: data.value,
      dataType: data.data_type,
      description: data.description,
      category: data.category,
      isPublic: data.is_public,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  },

  /**
   * Create new configuration (admin only)
   */
  async createConfig(adminId: string, config: {
    key: string;
    value: string;
    dataType: ConfigDataType;
    description?: string;
    category: ConfigCategory;
    isPublic?: boolean;
  }): Promise<SystemConfig> {
    const { data, error } = await supabase
      .from('system_config')
      .insert({
        key: config.key,
        value: config.value,
        data_type: config.dataType,
        description: config.description,
        category: config.category,
        is_public: config.isPublic ?? false,
        updated_by: adminId,
      })
      .select()
      .single();

    if (error || !data) {
      logger.error({ error, config }, 'Failed to create config');
      throw new Error('Failed to create config');
    }

    logger.info({ key: config.key, adminId }, 'Config created');

    return {
      id: data.id,
      key: data.key,
      value: data.value,
      dataType: data.data_type,
      description: data.description,
      category: data.category,
      isPublic: data.is_public,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  },

  /**
   * Delete configuration (admin only)
   */
  async deleteConfig(key: string): Promise<void> {
    const { error } = await supabase
      .from('system_config')
      .delete()
      .eq('key', key);

    if (error) {
      logger.error({ error, key }, 'Failed to delete config');
      throw new Error('Failed to delete config');
    }

    // Invalidate cache
    configCache.delete(key);

    logger.info({ key }, 'Config deleted');
  },

  /**
   * Clear config cache (useful for testing or after bulk updates)
   */
  clearCache(): void {
    configCache.clear();
    logger.info('Config cache cleared');
  },

  /**
   * Get booking time constraints
   */
  async getBookingTimeConstraints(): Promise<{
    campusOpenTime: string;
    campusCloseTime: string;
    maxDurationHours: number;
    minDurationMinutes: number;
    bufferMinutes: number;
  }> {
    const config = await this.getMultipleConfig([
      'campus_open_time',
      'campus_close_time',
      'max_booking_duration_hours',
      'min_booking_duration_minutes',
      'booking_buffer_minutes',
    ]);

    return {
      campusOpenTime: config.campus_open_time || '08:00',
      campusCloseTime: config.campus_close_time || '20:00',
      maxDurationHours: config.max_booking_duration_hours || 4,
      minDurationMinutes: config.min_booking_duration_minutes || 30,
      bufferMinutes: config.booking_buffer_minutes || 15,
    };
  },

  /**
   * Check if booking time is within campus hours
   */
  async isWithinCampusHours(startTime: Date, endTime: Date): Promise<boolean> {
    const constraints = await this.getBookingTimeConstraints();

    // ADAPTED strategy: "Fake UTC"
    // The dates passed in (startTime, endTime) are already shifted so that their UTC components
    // match the IST time. E.g. 15:00 IST is represented as 15:00 Z.
    // So we just read the UTC components directly. DO NOT shift again to Asia/Kolkata.

    const getMinutes = (date: Date) => {
      const h = date.getUTCHours();
      const m = date.getUTCMinutes();
      return h * 60 + m;
    };

    const startMinutes = getMinutes(startTime);
    const endMinutes = getMinutes(endTime);

    const [openHour, openMinute] = constraints.campusOpenTime.split(':').map(Number);
    const [closeHour, closeMinute] = constraints.campusCloseTime.split(':').map(Number);

    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    return startMinutes >= openMinutes && endMinutes <= closeMinutes;
  },
};
