/**
 * =============================================================================
 * Campus Resource Engine - Ghost Killer Cron Job
 * =============================================================================
 * The "Ghost Killer" automatically cancels bookings where users haven't 
 * checked in within the grace period.
 * Uses Supabase with snake_case table/column names
 * =============================================================================
 */

import cron from 'node-cron';
import { supabase } from '../lib/supabase.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

const SYSTEM_USER_ID = 'system-ghost-killer';

interface GhostKillerStats {
  checkedAt: Date;
  bookingsFound: number;
  bookingsCancelled: number;
  errors: number;
  duration: number;
}

/**
 * Execute Ghost Killer
 */
export async function executeGhostKiller(): Promise<GhostKillerStats> {
  const startTime = Date.now();
  const stats: GhostKillerStats = {
    checkedAt: new Date(),
    bookingsFound: 0,
    bookingsCancelled: 0,
    errors: 0,
    duration: 0,
  };

  logger.info('🔍 Ghost Killer: Starting check for no-show bookings...');

  try {
    const gracePeriodMs = config.ghostKiller.gracePeriodMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - gracePeriodMs);

    logger.debug({
      gracePeriodMinutes: config.ghostKiller.gracePeriodMinutes,
      cutoffTime: cutoffTime.toISOString(),
    }, 'Ghost Killer: Checking for bookings before cutoff time');

    // Find all ghost bookings
    const { data: ghostBookings, error } = await supabase
      .from('bookings')
      .select(`
        id, user_id, room_id, start_time, end_time, credits_charged,
        users(id, email, first_name, last_name, reputation_score),
        rooms(id, name, code)
      `)
      .eq('status', 'CONFIRMED')
      .eq('check_in_status', 'PENDING')
      .lt('start_time', cutoffTime.toISOString());

    if (error) {
      throw error;
    }

    stats.bookingsFound = ghostBookings?.length || 0;

    if (stats.bookingsFound === 0) {
      logger.info('👻 Ghost Killer: No ghost bookings found. All clear!');
      stats.duration = Date.now() - startTime;
      return stats;
    }

    logger.warn({
      count: stats.bookingsFound,
    }, '👻 Ghost Killer: Found ghost bookings to cancel');

    // Process each ghost booking
    for (const booking of ghostBookings || []) {
      try {
        await processGhostBooking(booking);
        stats.bookingsCancelled++;

        logger.info({
          bookingId: booking.id,
          userId: (booking as any).users?.id,
          userEmail: (booking as any).users?.email,
          roomCode: (booking as any).rooms?.code,
          startTime: booking.start_time,
        }, '💀 Ghost Killer: Booking marked as NO_SHOW');

      } catch (error) {
        stats.errors++;
        logger.error({
          error,
          bookingId: booking.id,
        }, 'Ghost Killer: Error processing booking');
      }
    }

    stats.duration = Date.now() - startTime;

    logger.info({
      ...stats,
      duration: `${stats.duration}ms`,
    }, '✅ Ghost Killer: Completed processing');

    return stats;

  } catch (error) {
    stats.errors++;
    stats.duration = Date.now() - startTime;

    logger.error({
      error,
    }, '❌ Ghost Killer: Fatal error during execution');

    throw error;
  }
}

/**
 * Process a single ghost booking
 */
async function processGhostBooking(booking: any): Promise<void> {
  const reputationPenalty = config.ghostKiller.reputationPenalty;

  // 1. Update booking status to NO_SHOW
  await supabase
    .from('bookings')
    .update({
      status: 'NO_SHOW',
      check_in_status: 'MISSED',
      cancelled_at: new Date().toISOString(),
      cancelled_by: SYSTEM_USER_ID,
      cancellation_reason: `Automatic cancellation: No check-in within ${config.ghostKiller.gracePeriodMinutes} minute grace period`,
    })
    .eq('id', booking.id);

  // 2. Get current user data
  const { data: currentUser } = await supabase
    .from('users')
    .select('reputation_score, no_show_count')
    .eq('id', booking.user_id)
    .single();

  const currentNoShowCount = ((currentUser?.no_show_count) || 0) + 1;
  const newReputationScore = Math.max(0, (currentUser?.reputation_score || 100) - reputationPenalty);

  // 3. Check if user should be blocked (3 or more no-shows)
  const shouldBlock = currentNoShowCount >= 3;
  const blockedUntil = shouldBlock
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    : null;

  // 4. Update user reputation and no-show count
  await supabase
    .from('users')
    .update({
      reputation_score: newReputationScore,
      no_show_count: shouldBlock ? 0 : currentNoShowCount,
      blocked_until: blockedUntil,
    })
    .eq('id', booking.user_id);

  // 5. Create audit log entry
  await supabase.from('audit_logs').insert({
    action: 'GHOST_KILL',
    entity_type: 'booking',
    entity_id: booking.id,
    performed_by_id: booking.user_id,
    previous_state: {
      status: 'CONFIRMED',
      check_in_status: 'PENDING',
      reputation_score: booking.users?.reputation_score,
      no_show_count: currentNoShowCount - 1,
    },
    new_state: {
      status: 'NO_SHOW',
      check_in_status: 'MISSED',
      reputation_score: newReputationScore,
      reputation_penalty: reputationPenalty,
      no_show_count: shouldBlock ? 0 : currentNoShowCount,
      blocked: shouldBlock,
      blocked_until: blockedUntil,
    },
    metadata: {
      automatedBy: 'ghost-killer-cron',
      room_code: booking.rooms?.code,
      room_name: booking.rooms?.name,
      grace_period_minutes: config.ghostKiller.gracePeriodMinutes,
      scheduled_start: booking.start_time,
      cancelled_at: new Date().toISOString(),
    },
  });

  if (shouldBlock) {
    logger.warn({
      userId: booking.user_id,
      userEmail: booking.users?.email,
      blockedUntil,
      noShowCount: currentNoShowCount,
    }, '🚫 Ghost Killer: USER BLOCKED for 7 days due to repeated no-shows');
  }

  logger.debug({
    userId: booking.user_id,
    userEmail: booking.users?.email,
    oldReputation: booking.users?.reputation_score,
    newReputation: newReputationScore,
    penalty: reputationPenalty,
  }, 'Ghost Killer: Applied reputation penalty');
}

/**
 * Schedule Ghost Killer cron job
 */
export function scheduleGhostKiller(): cron.ScheduledTask {
  const schedule = config.ghostKiller.cronSchedule;

  logger.info({
    schedule,
    gracePeriodMinutes: config.ghostKiller.gracePeriodMinutes,
    reputationPenalty: config.ghostKiller.reputationPenalty,
  }, '⏰ Ghost Killer: Scheduling cron job');

  const task = cron.schedule(schedule, async () => {
    try {
      await executeGhostKiller();
    } catch (error) {
      logger.error({ error }, 'Ghost Killer: Cron job iteration failed');
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  logger.info('👻 Ghost Killer: Cron job scheduled successfully');

  return task;
}

/**
 * Manual trigger (for Admin API)
 */
export async function manualGhostKillerTrigger(): Promise<GhostKillerStats> {
  logger.info('🔧 Ghost Killer: Manual trigger initiated');
  return executeGhostKiller();
}

/**
 * Get Ghost Killer stats
 */
export async function getGhostKillerStats(
  days: number = 7
): Promise<{
  totalNoShows: number;
  byDay: Array<{ date: string; count: number }>;
  topOffenders: Array<{ userId: string; email: string; count: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get total no-shows in period
  const { count: totalNoShows } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'NO_SHOW')
    .gte('updated_at', startDate.toISOString());

  // Get no-shows for stats
  const { data: noShowBookings } = await supabase
    .from('bookings')
    .select('user_id, updated_at')
    .eq('status', 'NO_SHOW')
    .gte('updated_at', startDate.toISOString());

  // Aggregate by date string
  const byDayMap = new Map<string, number>();
  const userCountMap = new Map<string, number>();

  for (const booking of noShowBookings || []) {
    const dateStr = new Date(booking.updated_at).toISOString().split('T')[0];
    byDayMap.set(dateStr, (byDayMap.get(dateStr) || 0) + 1);
    userCountMap.set(booking.user_id, (userCountMap.get(booking.user_id) || 0) + 1);
  }

  const byDay = Array.from(byDayMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  // Get top offenders
  const sortedOffenders = Array.from(userCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topOffenders = await Promise.all(
    sortedOffenders.map(async ([userId, count]) => {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();
      return {
        userId,
        email: user?.email || 'Unknown',
        count,
      };
    })
  );

  return {
    totalNoShows: totalNoShows || 0,
    byDay,
    topOffenders,
  };
}
