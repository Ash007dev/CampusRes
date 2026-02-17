/**
 * =============================================================================
 * Campus Resource Engine - Waitlist Service
 * =============================================================================
 * Waitlist operations using Supabase
 * Table: waitlist (snake_case columns)
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logAudit } from '../utils/auditLogger.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';
import { emitWaitlistUpdate } from '../lib/socket.js';
import { istToUtc, parseDbDate } from '../utils/dateUtils.js';

export class WaitlistService {
    async joinWaitlist(
        userId: string,
        roomId: string,
        desiredStartTimeStr: string,
        desiredEndTimeStr: string
    ): Promise<{ id: string; position: number }> {
        const desiredStartTime = istToUtc(desiredStartTimeStr);
        const desiredEndTime = istToUtc(desiredEndTimeStr);
        logger.info({ userId, roomId, desiredStartTime, desiredEndTime }, 'Joining waitlist');

        const { data: existing } = await supabase
            .from('waitlist')
            .select('id')
            .eq('user_id', userId)
            .eq('room_id', roomId)
            .eq('desired_start_time', desiredStartTime.toISOString())
            .eq('desired_end_time', desiredEndTime.toISOString())
            .eq('is_active', true)
            .single();

        if (existing) {
            throw new AppError('Already on waitlist for this time slot', 400);
        }

        const { data: entry, error } = await supabase
            .from('waitlist')
            .insert({
                user_id: userId,
                room_id: roomId,
                desired_start_time: desiredStartTime.toISOString(),
                desired_end_time: desiredEndTime.toISOString(),
            })
            .select()
            .single();

        if (error || !entry) {
            throw new AppError('Failed to join waitlist', 500);
        }

        const position = await this.getPosition(entry.id);

        await logAudit({
            action: 'CREATE',
            entity_type: 'waitlist',
            entity_id: entry.id,
            performed_by_id: userId,
            metadata: { room_id: roomId, desired_start_time: desiredStartTime, desired_end_time: desiredEndTime },
        });

        logger.info({ entryId: entry.id, position }, 'Joined waitlist');

        return { id: entry.id, position };
    }

    async leaveWaitlist(entryId: string, userId: string): Promise<void> {
        const { data: entry } = await supabase
            .from('waitlist')
            .select('id, user_id')
            .eq('id', entryId)
            .single();

        if (!entry) {
            throw new AppError('Waitlist entry not found', 404);
        }

        if (entry.user_id !== userId) {
            throw new AppError('Cannot remove another user from waitlist', 403);
        }

        await supabase
            .from('waitlist')
            .update({ is_active: false })
            .eq('id', entryId);

        logger.info({ entryId }, 'Left waitlist');
    }

    async getPosition(entryId: string): Promise<number> {
        const { data: entry } = await supabase
            .from('waitlist')
            .select('id, room_id, desired_start_time, desired_end_time, created_at')
            .eq('id', entryId)
            .single();

        if (!entry) {
            throw new AppError('Waitlist entry not found', 404);
        }

        const { count } = await supabase
            .from('waitlist')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', entry.room_id)
            .eq('desired_start_time', entry.desired_start_time)
            .eq('desired_end_time', entry.desired_end_time)
            .eq('is_active', true)
            .lte('created_at', entry.created_at);

        return count || 1;
    }

    async getUserWaitlistEntries(userId: string): Promise<Array<{
        id: string;
        roomId: string;
        roomName: string;
        desiredStartTime: Date;
        desiredEndTime: Date;
        position: number;
        createdAt: Date;
    }>> {
        const { data: entries } = await supabase
            .from('waitlist')
            .select(`
        id, room_id, desired_start_time, desired_end_time, created_at,
        rooms(name)
      `)
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (!entries) {
            return [];
        }

        const withPositions = await Promise.all(
            entries.map(async (e: any) => ({
                id: e.id,
                roomId: e.room_id,
                roomName: e.rooms?.name || 'Unknown',
                desiredStartTime: parseDbDate(e.desired_start_time),
                desiredEndTime: parseDbDate(e.desired_end_time),
                position: await this.getPosition(e.id),
                createdAt: parseDbDate(e.created_at),
            }))
        );

        return withPositions;
    }

    async notifyWaitlistedUsers(
        roomId: string,
        slotStartTime: Date,
        slotEndTime: Date
    ): Promise<void> {
        const { data: entries } = await supabase
            .from('waitlist')
            .select(`
        id, user_id,
        users(id, email, first_name),
        rooms(name)
      `)
            .eq('room_id', roomId)
            .eq('is_active', true)
            .lte('desired_start_time', slotEndTime.toISOString())
            .gte('desired_end_time', slotStartTime.toISOString())
            .order('created_at', { ascending: true });

        if (!entries) {
            return;
        }

        for (const entry of entries) {
            emitWaitlistUpdate(entry.user_id, {
                type: 'SLOT_AVAILABLE',
                roomId,
                roomName: (entry as any).rooms?.name || 'Unknown',
                availableSlot: {
                    startTime: slotStartTime.toISOString(),
                    endTime: slotEndTime.toISOString(),
                },
            });

            await supabase
                .from('waitlist')
                .update({ notified_at: new Date().toISOString() })
                .eq('id', entry.id);
        }

        logger.info({ roomId, entriesNotified: entries.length }, 'Notified waitlisted users');
    }
}

export const waitlistService = new WaitlistService();
