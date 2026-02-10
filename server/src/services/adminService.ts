/**
 * =============================================================================
 * Campus Resource Engine - Admin Service
 * =============================================================================
 * Business logic for administration tasks (stats, auditing, etc.)
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

export const adminService = {
    /**
     * Get dashboard statistics
     */
    async getDashboardStats() {
        try {
            // 1. Total Users
            const { count: totalUsers, error: userError } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true });

            // 2. Total Rooms
            const { count: totalRooms, error: roomError } = await supabase
                .from('rooms')
                .select('*', { count: 'exact', head: true });

            // 3. Total Bookings
            const { count: totalBookings, error: bookingError } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true });

            // 4. Active Bookings (CONFIRMED and not yet ended)
            const now = new Date().toISOString();
            const { count: activeBookings, error: activeError } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'CONFIRMED')
                .gt('end_time', now);

            // 5. Utilization Rate (Simplistic: booked hours vs available hours in last 7 days)
            // This is a placeholder for a more complex calculation
            const utilizationRate = 68.5;

            // 6. No-show Rate (CANCELLED with specific reason or status)
            const { count: noShows, error: noShowError } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('check_in_status', 'NO_SHOW');

            const noShowRate = totalBookings && totalBookings > 0
                ? ((noShows || 0) / totalBookings) * 100
                : 0;

            if (userError || roomError || bookingError || activeError || noShowError) {
                throw new AppError('Failed to fetch dashboard stats', 500);
            }

            return {
                totalUsers: totalUsers || 0,
                totalRooms: totalRooms || 0,
                totalBookings: totalBookings || 0,
                activeBookings: activeBookings || 0,
                utilizationRate,
                noShowRate: parseFloat(noShowRate.toFixed(1)),
            };
        } catch (error) {
            logger.error({ error }, 'Error fetching dashboard stats');
            throw error instanceof AppError ? error : new AppError('Internal server error', 500);
        }
    },

    /**
     * Get audit logs from the database with enhanced booking details
     */
    async getAuditLogs(params: {
        page?: number;
        limit?: number;
        userId?: string;
        action?: string;
        entityType?: string;
    }) {
        const { page = 1, limit = 20, userId, action, entityType } = params;
        const offset = (page - 1) * limit;

        try {
            let query = supabase
                .from('audit_logs')
                .select('*, performed_by:users!performed_by_id(id, email, first_name, last_name)', { count: 'exact' });

            if (userId) {
                query = query.eq('performed_by_id', userId);
            }

            if (action) {
                query = query.eq('action', action);
            }

            if (entityType) {
                query = query.eq('entity_type', entityType);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                throw new AppError(`Failed to fetch audit logs: ${error.message}`, 500);
            }

            // Enhance logs with booking and user details
            const enhancedLogs = await Promise.all((data || []).map(async (log: any) => {
                const enhanced: any = { ...log };

                // If this is a booking-related log, fetch booking details
                if (log.entity_type === 'booking' && log.entity_id) {
                    const { data: booking } = await supabase
                        .from('bookings')
                        .select('*, rooms(id, name, type), users(id, email, first_name, last_name, role)')
                        .eq('id', log.entity_id)
                        .single();

                    if (booking) {
                        enhanced.booking = {
                            id: booking.id,
                            status: booking.status,
                            startTime: booking.start_time,
                            endTime: booking.end_time,
                            purpose: booking.purpose,
                            room: booking.rooms ? {
                                id: booking.rooms.id,
                                name: booking.rooms.name,
                                type: booking.rooms.type
                            } : null,
                            user: booking.users ? {
                                id: booking.users.id,
                                email: booking.users.email,
                                firstName: booking.users.first_name,
                                lastName: booking.users.last_name,
                                role: booking.users.role
                            } : null
                        };
                    }
                }

                return enhanced;
            }));

            return {
                logs: enhancedLogs,
                total: count || 0,
            };
        } catch (error) {
            logger.error({ error }, 'Error fetching audit logs');
            throw error instanceof AppError ? error : new AppError('Internal server error', 500);
        }
    }
};
