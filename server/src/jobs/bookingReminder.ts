/**
 * =============================================================================
 * Campus Resource Engine - Booking Reminder Cron Job
 * =============================================================================
 * Sends reminder notifications (email + socket) to users whose bookings
 * are about to start within the configured reminder window (default: 5 min).
 *
 * Modeled after ghostKiller.ts — runs on a cron schedule and queries
 * for upcoming CONFIRMED bookings with PENDING check-in status.
 * =============================================================================
 */

import cron from 'node-cron';
import { supabase } from '../lib/supabase.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { sendNotification } from '../lib/socket.js';
import { sendBookingReminderEmail } from '../services/emailService.js';

interface ReminderStats {
    checkedAt: Date;
    bookingsFound: number;
    remindersSent: number;
    errors: number;
    duration: number;
}

/**
 * Execute Booking Reminder check
 */
export async function executeBookingReminder(): Promise<ReminderStats> {
    const startTime = Date.now();
    const stats: ReminderStats = {
        checkedAt: new Date(),
        bookingsFound: 0,
        remindersSent: 0,
        errors: 0,
        duration: 0,
    };

    logger.trace('Booking Reminder: Checking for upcoming bookings...');

    try {
        const minutesBefore = config.reminder.minutesBefore;
        const now = new Date();
        const reminderWindow = new Date(now.getTime() + minutesBefore * 60 * 1000);

        // Find CONFIRMED bookings with PENDING check-in that start within the reminder window
        // and haven't had a reminder sent yet
        const { data: upcomingBookings, error } = await supabase
            .from('bookings')
            .select(`
        id, user_id, room_id, start_time, end_time, title, reminder_sent,
        users(id, email, first_name, last_name),
        rooms(id, name, code)
      `)
            .eq('status', 'CONFIRMED')
            .eq('check_in_status', 'PENDING')
            .gte('start_time', now.toISOString())
            .lte('start_time', reminderWindow.toISOString())
            .or('reminder_sent.is.null,reminder_sent.eq.false');

        if (error) {
            logger.error({ error }, 'Booking Reminder: Failed to query upcoming bookings');
            stats.errors++;
            stats.duration = Date.now() - startTime;
            return stats;
        }

        stats.bookingsFound = upcomingBookings?.length || 0;

        if (stats.bookingsFound === 0) {
            stats.duration = Date.now() - startTime;
            return stats;
        }

        logger.info({ count: stats.bookingsFound }, '⏰ Booking Reminder: Found bookings needing reminders');

        for (const booking of upcomingBookings || []) {
            try {
                const sent = await sendReminder(booking);
                if (sent) stats.remindersSent++;
            } catch (err) {
                stats.errors++;
                logger.error({ bookingId: booking.id, error: err }, 'Booking Reminder: Failed to send reminder');
            }
        }

    } catch (error) {
        logger.error({ error }, 'Booking Reminder: Unexpected error');
        stats.errors++;
    }

    stats.duration = Date.now() - startTime;

    if (stats.remindersSent > 0) {
        logger.info({
            ...stats,
            checkedAt: stats.checkedAt.toISOString(),
        }, '⏰ Booking Reminder: Run complete');
    }

    return stats;
}

/**
 * Send reminder for a single booking
 */
async function sendReminder(booking: any): Promise<boolean> {
    const user = booking.users;
    const room = booking.rooms;

    if (!user || !room) {
        logger.warn({ bookingId: booking.id }, 'Booking Reminder: Missing user or room data, skipping');
        return false;
    }

    const userName = `${user.first_name} ${user.last_name}`;

    // 1. Send reminder email
    await sendBookingReminderEmail(user.email, userName, {
        bookingId: booking.id,
        roomName: room.name,
        roomCode: room.code,
        startTime: booking.start_time,
        endTime: booking.end_time,
    });

    // 2. Send real-time socket notification
    sendNotification(
        booking.user_id,
        `⏰ Your booking for ${room.name} starts in ${config.reminder.minutesBefore} minutes! Remember to check in with the QR code.`,
        'warning'
    );

    // 3. Mark reminder as sent to avoid duplicates
    const { error: updateError } = await supabase
        .from('bookings')
        .update({ reminder_sent: true })
        .eq('id', booking.id);

    if (updateError) {
        logger.error({ bookingId: booking.id, error: updateError }, 'Booking Reminder: Failed to mark reminder as sent');
    }

    logger.info({
        bookingId: booking.id,
        userId: booking.user_id,
        roomName: room.name,
        startTime: booking.start_time,
    }, '⏰ Booking Reminder: Reminder sent');

    return true;
}

/**
 * Schedule the booking reminder cron job
 */
export function scheduleBookingReminder(): void {
    const schedule = config.reminder.cronSchedule;

    if (!cron.validate(schedule)) {
        logger.error({ schedule }, 'Invalid booking reminder cron schedule');
        return;
    }

    cron.schedule(schedule, async () => {
        try {
            await executeBookingReminder();
        } catch (error) {
            logger.error({ error }, 'Booking Reminder: Cron execution failed');
        }
    });

    logger.info({ schedule, minutesBefore: config.reminder.minutesBefore }, '⏰ Booking Reminder scheduled');
}
