/**
 * =============================================================================
 * Campus Resource Engine - Date Utilities (IST)
 * =============================================================================
 * Centralized date handling for IST (GMT+5:30)
 * ADAPTED STRATEGY: "Fake UTC"
 * The database will store dates that LOOK like IST but are technically UTC.
 * Example: 9:00 AM IST is stored as 09:00:00Z (instead of 03:30:00Z).
 * This satisfies the user requirement to see "9:00" in the DB.
 * =============================================================================
 */

import { addMinutes, format } from 'date-fns';

const IST_OFFSET_MINUTES = 330; // 5.5 hours

/**
 * Get current date/time in IST (as a UTC Date object)
 * Returns a Date object that effectively represents IST time in UTC components.
 */
export function getCurrentIST(): Date {
    const now = new Date();
    // Shift by +5:30 to make UTC components match IST time
    return addMinutes(now, IST_OFFSET_MINUTES);
}

/**
 * Convert a Fake UTC Date (which actually holds IST time) back to real UTC Date
 * Used for comparing stored booking times against real-world elapsed time (`new Date()`)
 */
export function fakeUtcToRealUtc(fakeUtc: Date): Date {
    return addMinutes(fakeUtc, -IST_OFFSET_MINUTES);
}

/**
 * Format a date to IST string
 */
export function formatIST(date: Date | string | number, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
    try {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        // Since 'd' is already shifted (Fake UTC), we format it as UTC to see the "IST" numbers
        return format(d, formatStr);
    } catch (err) {
        return String(date);
    }
}

/**
 * Get the current hour in IST (0-23)
 */
export function getISTHour(): number {
    return getCurrentIST().getUTCHours();
}

/**
 * Convert a date to its start of day in IST
 */
export function getISTStartOfDay(date: Date = getCurrentIST()): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Check if current IST time is within peak hours
 */
export function isISTPeakHour(peakStart: number, peakEnd: number): boolean {
    const hour = getISTHour();
    return hour >= peakStart && hour < peakEnd;
}

/**
 * Parse a date string as UTC (Fake UTC strategy)
 * Input: "2023-10-27T09:00:00" (Implies 9 AM IST)
 * Output: Date(2023-10-27T09:00:00Z)
 */
export function istToUtc(dateStr: string): Date {
    if (!dateStr || typeof dateStr !== 'string') return getCurrentIST();

    // If it already has Z, assumes it's already properly formatted Fake UTC
    if (dateStr.endsWith('Z')) return new Date(dateStr);

    // If it has local offset (e.g. +05:30), strip it or handle it? 
    // Usually input is "2023-10-27T09:00:00" from client
    // We append Z to treat it as UTC
    return new Date(dateStr + 'Z');
}

/**
 * Parse a date string from the database.
 */
export function parseDbDate(dateStr: string | Date): Date {
    if (!dateStr) return getCurrentIST();
    if (dateStr instanceof Date) return dateStr;

    // Ensure it's treated as UTC
    if (!dateStr.endsWith('Z')) {
        return new Date(dateStr + 'Z');
    }
    return new Date(dateStr);
}
