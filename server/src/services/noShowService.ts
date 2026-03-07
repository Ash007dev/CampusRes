/**
 * =============================================================================
 * Campus Resource Engine - No-Show Service (US 4.5 / Escalation)
 * =============================================================================
 * Tracks no-show frequency and applies escalating restrictions on repeat
 * offenders to prevent resource monopolization.
 *
 * Escalation Tiers:
 *   Tier 0 → 1: 1st no-show  → Warning only
 *   Tier 1 → 2: 2nd no-show  → Block 3 days
 *   Tier 2 → 3: 3rd no-show  → Block 7 days
 *   Tier 3 → 4: 4th+ no-show → Block 30 days
 *
 * Tier resets after 60 days of no further no-shows.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface EscalationResult {
    userId: string;
    previousTier: number;
    newTier: number;
    action: string;
    blockedUntil: string | null;
}

interface NoShowReportEntry {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    noShowCount: number;
    noShowTier: number;
    blockedUntil: string | null;
    lastNoShowAt: string | null;
    reputationScore: number;
}

const TIER_BLOCK_DAYS: Record<number, number> = {
    0: 0,   // Warning only
    1: 0,   // Warning only
    2: 3,   // 3-day block
    3: 7,   // 7-day block
    4: 30,  // 30-day block
};

const TIER_ACTION_LABELS: Record<number, string> = {
    1: 'Warning issued — next no-show will result in a 3-day block',
    2: 'Blocked for 3 days due to repeated no-shows',
    3: 'Blocked for 7 days due to repeated no-shows',
    4: 'Blocked for 30 days due to repeated no-shows',
};

const TIER_RESET_DAYS = 60; // Reset tier after 60 clean days

export const noShowService = {
    /**
     * Escalate no-show penalty for a user. Called by the Ghost Killer
     * when a booking is marked as NO_SHOW.
     */
    async escalateNoShowPenalty(userId: string, reputationPenalty: number): Promise<EscalationResult> {
        try {
            // Get current user state
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, no_show_count, no_show_tier, no_show_tier_updated_at, reputation_score, blocked_until')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                throw new AppError(`User ${userId} not found`, 404);
            }

            let currentTier = user.no_show_tier || 0;
            const currentNoShowCount = (user.no_show_count || 0) + 1;

            // Check if tier should be reset (60 days clean)
            if (user.no_show_tier_updated_at) {
                const lastUpdate = new Date(user.no_show_tier_updated_at);
                const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceUpdate >= TIER_RESET_DAYS) {
                    currentTier = 0;
                    logger.info({ userId, daysSinceUpdate }, 'No-show tier reset due to clean behavior');
                }
            }

            // Escalate tier (max tier = 4)
            const newTier = Math.min(currentTier + 1, 4);
            const blockDays = TIER_BLOCK_DAYS[newTier] || 0;
            const blockedUntil = blockDays > 0
                ? new Date(Date.now() + blockDays * 24 * 60 * 60 * 1000).toISOString()
                : null;

            const newReputationScore = Math.max(0, (user.reputation_score || 100) - reputationPenalty);
            const action = TIER_ACTION_LABELS[newTier] || 'No-show recorded';

            // Update user
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    no_show_count: currentNoShowCount,
                    no_show_tier: newTier,
                    no_show_tier_updated_at: new Date().toISOString(),
                    reputation_score: newReputationScore,
                    blocked_until: blockedUntil,
                })
                .eq('id', userId);

            if (updateError) {
                logger.error({ error: updateError }, 'Failed to update user no-show escalation');
                throw new AppError('Failed to update no-show tier', 500);
            }

            logger.info({
                userId,
                previousTier: currentTier,
                newTier,
                blockedUntil,
                noShowCount: currentNoShowCount,
            }, `🚫 No-show escalation: Tier ${currentTier} → ${newTier}`);

            return {
                userId,
                previousTier: currentTier,
                newTier,
                action,
                blockedUntil,
            };
        } catch (error) {
            logger.error({ error, userId }, 'Error escalating no-show penalty');
            throw error instanceof AppError ? error : new AppError('Failed to escalate no-show penalty', 500);
        }
    },

    /**
     * Get a report of all users with no-show history for admin review.
     */
    async getNoShowReport(): Promise<NoShowReportEntry[]> {
        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, no_show_count, no_show_tier, blocked_until, reputation_score, no_show_tier_updated_at')
                .gt('no_show_count', 0)
                .order('no_show_count', { ascending: false });

            if (error) {
                throw new AppError(`Failed to fetch no-show report: ${error.message}`, 500);
            }

            return (users || []).map((user: any) => ({
                userId: user.id,
                email: user.email,
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                noShowCount: user.no_show_count || 0,
                noShowTier: user.no_show_tier || 0,
                blockedUntil: user.blocked_until,
                lastNoShowAt: user.no_show_tier_updated_at,
                reputationScore: user.reputation_score || 0,
            }));
        } catch (error) {
            logger.error({ error }, 'Error fetching no-show report');
            throw error instanceof AppError ? error : new AppError('Failed to get no-show report', 500);
        }
    },

    /**
     * Admin manually resets a user's no-show tier.
     */
    async resetNoShowTier(userId: string): Promise<void> {
        const { error } = await supabase
            .from('users')
            .update({
                no_show_tier: 0,
                no_show_tier_updated_at: new Date().toISOString(),
                blocked_until: null,
            })
            .eq('id', userId);

        if (error) {
            throw new AppError(`Failed to reset no-show tier: ${error.message}`, 500);
        }

        logger.info({ userId }, '✅ No-show tier manually reset by admin');
    },
};
