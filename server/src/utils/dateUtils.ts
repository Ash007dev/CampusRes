/**
 * =============================================================================
 * Campus Resource Engine - Date Utilities (IST)
 * =============================================================================
 * Centralized date handling for IST (GMT+5:30) using date-fns-tz v3
 * =============================================================================
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current date/time
 * Returns a standard Date object. Note that "now" is the same in all timezones
 * when represented as a UTC timestamp.
 */
export function getCurrentIST(): Date {
    return new Date();
}

/**
 * Format a date to IST string
 */
export function formatIST(date: Date | string | number, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
    try {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        return formatInTimeZone(d, IST_TIMEZONE, formatStr);
    } catch (err) {
        return String(date);
    }
}

/**
 * Get the current hour in IST (0-23)
 */
export function getISTHour(): number {
    return parseInt(formatInTimeZone(new Date(), IST_TIMEZONE, 'H'));
}

/**
 * Convert a date to its start of day in IST
 * Returns a UTC Date representing 00:00 IST on that day
 */
export function getISTStartOfDay(date: Date = new Date()): Date {
    try {
        const dateStr = formatInTimeZone(date, IST_TIMEZONE, 'yyyy-MM-dd');
        return fromZonedTime(`${dateStr}T00:00:00`, IST_TIMEZONE);
    } catch (err) {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
    }
}

/**
 * Check if current IST time is within peak hours
 */
export function isISTPeakHour(peakStart: number, peakEnd: number): boolean {
    const hour = getISTHour();
    return hour >= peakStart && hour < peakEnd;
}

/**
 * Ensure a date is treated as IST and convert to UTC for storage
 */
export function istToUtc(dateStr: string): Date {
    if (!dateStr || typeof dateStr !== 'string') return new Date();

    // If dateStr doesn't have a timezone, assume it's IST
    if (!dateStr.includes('Z') && !dateStr.includes('+')) {
        try {
            return fromZonedTime(dateStr, IST_TIMEZONE);
        } catch (err) {
            return new Date(dateStr);
        }
    }
    return new Date(dateStr);
}

/**
 * Parse a date string from the database.
 * Since our database uses 'timestamp without time zone', we must manually
 * ensure that the date is interpreted as UTC (as stored by .toISOString()).
 */
export function parseDbDate(dateStr: string | Date): Date {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;

    if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) {
        return new Date(dateStr + 'Z');
    }
    return new Date(dateStr);
}
