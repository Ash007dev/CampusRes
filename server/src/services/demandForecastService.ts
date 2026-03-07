/**
 * =============================================================================
 * Campus Resource Engine - Demand Forecast Service (US 2.1)
 * =============================================================================
 * Aggregates historical booking data to predict daily demand patterns.
 * Admins use this to proactively schedule staff and open/close facilities.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface HourlyDemand {
    hour: number;
    avgBookings: number;
    peakLabel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface DayForecast {
    dayOfWeek: number;
    dayName: string;
    hourlyDemand: HourlyDemand[];
}

interface DemandForecastResult {
    forecast: DayForecast[];
    totalBookingsAnalyzed: number;
    periodDays: number;
    generatedAt: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const demandForecastService = {
    /**
     * Generate demand forecast from historical booking data.
     * Aggregates bookings into a 7-day × 24-hour matrix showing average
     * booking counts per hour for each day of the week.
     *
     * @param days - Number of historical days to analyze (default 30)
     */
    async getDemandForecast(days: number = 30): Promise<DemandForecastResult> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Fetch all non-cancelled bookings in the analysis window
            const { data: bookings, error } = await supabase
                .from('bookings')
                .select('start_time, end_time')
                .in('status', ['CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW'])
                .gte('start_time', startDate.toISOString());

            if (error) {
                throw new AppError(`Failed to fetch bookings for forecast: ${error.message}`, 500);
            }

            // Build a 7×24 accumulator: counts[dayOfWeek][hour] = total bookings
            const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
            // Track how many distinct weeks each day appeared (for averaging)
            const weeksSeen = new Set<string>();

            for (const booking of bookings || []) {
                const start = new Date(booking.start_time);
                const end = new Date(booking.end_time);
                const dayOfWeek = start.getUTCDay();

                // Track the week for averaging
                const weekKey = `${start.getUTCFullYear()}-W${Math.ceil((start.getUTCDate()) / 7)}`;
                weeksSeen.add(weekKey);

                // Count booking for each hour it spans
                const startHour = start.getUTCHours();
                const endHour = end.getUTCHours() + (end.getUTCMinutes() > 0 ? 1 : 0);
                const finalEndHour = Math.min(endHour, 24);

                for (let h = startHour; h < finalEndHour; h++) {
                    counts[dayOfWeek][h]++;
                }
            }

            // Number of weeks in our window for averaging
            const totalWeeks = Math.max(1, Math.ceil(days / 7));

            // Find maximum average for peak labeling
            let maxAvg = 0;
            for (let d = 0; d < 7; d++) {
                for (let h = 0; h < 24; h++) {
                    const avg = counts[d][h] / totalWeeks;
                    if (avg > maxAvg) maxAvg = avg;
                }
            }

            // Build forecast
            const forecast: DayForecast[] = [];
            for (let d = 0; d < 7; d++) {
                const hourlyDemand: HourlyDemand[] = [];
                for (let h = 0; h < 24; h++) {
                    const avgBookings = parseFloat((counts[d][h] / totalWeeks).toFixed(2));
                    const ratio = maxAvg > 0 ? avgBookings / maxAvg : 0;

                    let peakLabel: 'LOW' | 'MEDIUM' | 'HIGH';
                    if (ratio <= 0.33) peakLabel = 'LOW';
                    else if (ratio <= 0.66) peakLabel = 'MEDIUM';
                    else peakLabel = 'HIGH';

                    hourlyDemand.push({ hour: h, avgBookings, peakLabel });
                }

                forecast.push({
                    dayOfWeek: d,
                    dayName: DAY_NAMES[d],
                    hourlyDemand,
                });
            }

            return {
                forecast,
                totalBookingsAnalyzed: (bookings || []).length,
                periodDays: days,
                generatedAt: new Date().toISOString(),
            };
        } catch (error) {
            logger.error({ error }, 'Error generating demand forecast');
            throw error instanceof AppError ? error : new AppError('Failed to generate demand forecast', 500);
        }
    },
};
