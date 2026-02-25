/**
 * =============================================================================
 * Campus Resource Engine - Waitlist Service
 * =============================================================================
 * Waitlist operations using Supabase
 * Table: waitlist (snake_case columns)
 *
 * NOTIFICATION STRATEGY (Cascading):
 *   - When a slot opens, ONLY the #1 user in queue is notified
 *   - They have WAITLIST_NOTIFY_WINDOW_MINUTES to book the room
 *   - If they don't book within that window, their notification expires
 *   - The cascade job (waitlistCascade.ts) then notifies user #2, and so on
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';
import { emitWaitlistUpdate } from '../lib/socket.js';
import { istToUtc, parseDbDate } from '../utils/dateUtils.js';
import { emailService } from './emailService.js';

/** Minutes a notified user has to book before the next person is tried */
const NOTIFY_WINDOW_MINUTES = 10;

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
                id: crypto.randomUUID(),
                user_id: userId,
                room_id: roomId,
                desired_start_time: desiredStartTime.toISOString(),
                desired_end_time: desiredEndTime.toISOString(),
                is_active: true,
            })
            .select()
            .single();

        if (error || !entry) {
            logger.error({ error, userId, roomId, desiredStartTime, desiredEndTime }, '❌ Waitlist insert failed');
            throw new AppError(`Failed to join waitlist: ${error?.message || 'unknown error'}`, 500);
        }

        const position = await this.getPosition(entry.id);

        await supabase.from('audit_logs').insert({
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

    /**
     * Notify ONLY the #1 (first-in-queue) waitlisted user for an opened slot.
     *
     * Called when a booking is cancelled or early-checkout happens.
     * Sets notification_expires_at so the cascade job can move to #2 if needed.
     */
    async notifyWaitlistedUsers(
        roomId: string,
        slotStartTime: Date,
        slotEndTime: Date
    ): Promise<void> {
        // Fetch ALL active waitlist entries that overlap this slot, ordered FIFO
        const { data: entries } = await supabase
            .from('waitlist')
            .select(`
        id, user_id,
        users(id, email, first_name, last_name),
        rooms(name)
      `)
            .eq('room_id', roomId)
            .eq('is_active', true)
            .lte('desired_start_time', slotEndTime.toISOString())
            .gte('desired_end_time', slotStartTime.toISOString())
            .order('created_at', { ascending: true }); // FIFO — earliest joiner is #1

        if (!entries || entries.length === 0) {
            logger.info({ roomId }, 'No active waitlist entries for this slot');
            return;
        }

        // 🎯 Only notify the FIRST person in the queue
        const firstEntry = entries[0];
        const user = (firstEntry as any).users;
        const roomName = (firstEntry as any).rooms?.name || 'Unknown Room';

        await this.sendNotificationToEntry(firstEntry, roomName, slotStartTime, slotEndTime);

        logger.info(
            { roomId, notifiedUserId: firstEntry.user_id, totalWaiting: entries.length },
            '🔔 Waitlist: Notified #1 user only (cascade will handle the rest if needed)'
        );
    }

    /**
     * Internal helper: send notification to a single waitlist entry and
     * stamp notified_at + notification_expires_at.
     */
    private async sendNotificationToEntry(
        entry: any,
        roomName: string,
        slotStartTime: Date,
        slotEndTime: Date
    ): Promise<void> {
        const user = entry.users;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + NOTIFY_WINDOW_MINUTES * 60 * 1000);

        // 1. Real-time WebSocket push
        emitWaitlistUpdate(entry.user_id, {
            type: 'SLOT_AVAILABLE',
            roomId: entry.room_id || entry.rooms?.id,
            roomName,
            availableSlot: {
                startTime: slotStartTime.toISOString(),
                endTime: slotEndTime.toISOString(),
            },
            expiresAt: expiresAt.toISOString(),
            windowMinutes: NOTIFY_WINDOW_MINUTES,
        });

        // 2. Email notification (fire-and-forget)
        if (user?.email) {
            const userName = user.first_name
                ? `${user.first_name} ${user.last_name || ''}`.trim()
                : user.email;

            emailService.sendWaitlistNotificationEmail(
                user.email,
                userName,
                {
                    roomName,
                    availableStartTime: slotStartTime.toISOString(),
                    availableEndTime: slotEndTime.toISOString(),
                }
            ).catch(err => logger.error({ err, userId: entry.user_id }, 'Failed to send waitlist email'));
        }

        // 3. Stamp notified_at + notification_expires_at
        await supabase
            .from('waitlist')
            .update({
                notified_at: now.toISOString(),
                notification_expires_at: expiresAt.toISOString(),
            })
            .eq('id', entry.id);

        logger.info(
            { entryId: entry.id, userId: entry.user_id, expiresAt: expiresAt.toISOString() },
            '📨 Waitlist notification sent — window started'
        );
    }

    /**
     * CASCADE PROCESSOR — called by the waitlistCascade cron job every minute.
     *
     * For each waitlist entry whose notification window has EXPIRED:
     *   1. Check if the room slot is still free (no overlapping active booking)
     *   2. If still free → deactivate this entry (they missed their chance)
     *                    → notify the NEXT person in queue
     *   3. If room was already booked → just deactivate silently (no more cascade)
     */
    async processCascadeNotifications(): Promise<void> {
        const now = new Date();

        // Find all entries whose notification window has expired and are still active
        const { data: expiredEntries, error } = await supabase
            .from('waitlist')
            .select(`
        id, user_id, room_id, desired_start_time, desired_end_time,
        notification_expires_at,
        users(id, email, first_name, last_name),
        rooms(name)
      `)
            .eq('is_active', true)
            .not('notification_expires_at', 'is', null)
            .lte('notification_expires_at', now.toISOString());

        if (error) {
            logger.error({ error }, '❌ Waitlist cascade: Failed to fetch expired entries');
            return;
        }

        if (!expiredEntries || expiredEntries.length === 0) {
            return; // Nothing to process
        }

        logger.info({ count: expiredEntries.length }, '⏰ Waitlist cascade: Processing expired notifications');

        for (const entry of expiredEntries) {
            try {
                await this.cascadeToNextUser(entry, now);
            } catch (err) {
                logger.error({ err, entryId: entry.id }, 'Waitlist cascade: Error processing entry');
            }
        }
    }

    /**
     * Handle a single expired waitlist entry:
     * - Check if slot is still free
     * - If yes: deactivate this entry + notify the next person in queue
     * - If no: deactivate cleanly (room was booked, cascade ends)
     */
    private async cascadeToNextUser(entry: any, now: Date): Promise<void> {
        const slotStart = parseDbDate(entry.desired_start_time);
        const slotEnd = parseDbDate(entry.desired_end_time);

        // Check if room slot is still available
        const { data: conflicts } = await supabase
            .from('bookings')
            .select('id')
            .eq('room_id', entry.room_id)
            .not('status', 'in', '("CANCELLED","NO_SHOW")')
            .lt('start_time', slotEnd.toISOString())
            .gt('end_time', slotStart.toISOString());

        const isSlotTaken = conflicts && conflicts.length > 0;

        if (isSlotTaken) {
            // Room was booked — deactivate this entry silently, no more cascade needed
            await supabase
                .from('waitlist')
                .update({ is_active: false, notification_expires_at: null })
                .eq('id', entry.id);

            logger.info(
                { entryId: entry.id, userId: entry.user_id },
                '✅ Waitlist cascade: Room was booked — deactivating entry silently'
            );
            return;
        }

        // Room is STILL free — this user missed their window
        logger.info(
            { entryId: entry.id, userId: entry.user_id },
            '⏰ Waitlist cascade: User missed their window — cascading to next'
        );

        // Deactivate this entry (they lost their turn)
        await supabase
            .from('waitlist')
            .update({ is_active: false, notification_expires_at: null })
            .eq('id', entry.id);

        // Emit a "SLOT_EXPIRED" socket event so the UI can update
        emitWaitlistUpdate(entry.user_id, {
            type: 'SLOT_EXPIRED',
            roomId: entry.room_id,
            roomName: (entry as any).rooms?.name || 'Unknown Room',
        });

        // Find the NEXT active person in queue for this exact room+slot
        const { data: nextEntries } = await supabase
            .from('waitlist')
            .select(`
        id, user_id,
        users(id, email, first_name, last_name),
        rooms(name)
      `)
            .eq('room_id', entry.room_id)
            .eq('desired_start_time', entry.desired_start_time)
            .eq('desired_end_time', entry.desired_end_time)
            .eq('is_active', true)
            .is('notified_at', null) // Only un-notified users
            .order('created_at', { ascending: true })
            .limit(1);

        if (!nextEntries || nextEntries.length === 0) {
            logger.info(
                { roomId: entry.room_id, slotStart: entry.desired_start_time },
                '🏁 Waitlist cascade: No more users in queue — cascade ends'
            );
            return;
        }

        const nextEntry = nextEntries[0];
        const roomName = (entry as any).rooms?.name || 'Unknown Room';

        // Notify the next person
        await this.sendNotificationToEntry(nextEntry, roomName, slotStart, slotEnd);

        logger.info(
            { nextEntryId: nextEntry.id, nextUserId: nextEntry.user_id },
            '➡️ Waitlist cascade: Notified next user in queue'
        );
    }
}

export const waitlistService = new WaitlistService();
