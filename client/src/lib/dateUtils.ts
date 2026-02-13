/**
 * Date utilities for handling IST timezone
 */

/**
 * Convert UTC date string from API to IST for display
 * API stores times in UTC, but we want to display them in IST
 */
export function utcToIst(utcDateString: string): Date {
    // Parse the UTC date string
    const utcDate = new Date(utcDateString);

    // Return the date object - when displayed with toLocaleString with IST timezone,
    // it will show the correct IST time
    return utcDate;
}

/**
 * Format a UTC date string or Date object as IST time string (HH:MM format)
 */
export function formatTimeInIst(utcDate: string | Date): string {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    });
}

/**
 * Format a UTC date string as IST date-time string
 */
export function formatDateTimeInIst(utcDateString: string): string {
    const date = new Date(utcDateString);
    return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Convert local date and time to ISO string (for sending to API)
 * The API expects times in IST timezone, sent as ISO strings without 'Z'
 */
export function formatLocalAsISO(date: Date, timeStr: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const [hours, minutes] = timeStr.split(':');
    return `${year}-${month}-${day}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
}

/**
 * Convert Date object to ISO string for API (IST to UTC conversion handled by server)
 */
export function dateToApiFormat(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
