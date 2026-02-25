/**
 * =============================================================================
 * Campus Resource Engine - Waitlist Cascade Cron Job
 * =============================================================================
 * Runs every minute to cascade waitlist notifications:
 *   - If user #1 didn't book within NOTIFY_WINDOW_MINUTES, their chance expires
 *   - The next user in line (#2) then gets notified, and so on
 * =============================================================================
 */

import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { waitlistService } from '../services/waitlistService.js';

/**
 * Execute one pass of the cascade processor
 */
export async function executeWaitlistCascade(): Promise<void> {
    try {
        await waitlistService.processCascadeNotifications();
    } catch (error) {
        logger.error({ error }, '❌ Waitlist Cascade: Unhandled error during execution');
    }
}

/**
 * Schedule the cascade cron job — runs every minute
 */
export function scheduleWaitlistCascade(): cron.ScheduledTask {
    // Run every minute: "* * * * *"
    const task = cron.schedule('* * * * *', async () => {
        await executeWaitlistCascade();
    }, {
        scheduled: true,
        timezone: 'UTC',
    });

    logger.info('⏰ Waitlist Cascade: Cron job scheduled (every 1 minute)');

    return task;
}
