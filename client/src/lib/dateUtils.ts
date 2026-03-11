/**
 * Date utilities for handling IST timezone
 */

/**
 * Convert UTC date string from API to IST for display
 * ADAPTED: The input IS ALREADY the correct values (in UTC wrapper).
 * Just return it.
 */
export function utcToIst(utcDateString: string): Date {
    // Return effectively as-is
    return new Date(utcDateString);
}

/**
 * Format a UTC date string or Date object as IST time string (HH:MM format)
 * ADAPTED: Treats the input UTC date as effectively containing the correct IST time values.
 * Uses timeZone: 'UTC' to display the values as is without shifting.
 */
export function formatTimeInIst(utcDate: string | Date): string {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC' // Display as-is (Fake UTC)
    });
}

/**
 * Format a UTC date string as IST date-time string
 * ADAPTED: Uses timeZone: 'UTC' to display without shifting.
 */
export function formatDateTimeInIst(utcDateString: string): string {
    const date = new Date(utcDateString);
    return date.toLocaleString('en-IN', {
        timeZone: 'UTC', // Fake UTC: the stored value IS already the correct IST time
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

/**
 * Get current time in IST (which is basically Local Time, but represented as UTC)
 */
export function getCurrentIST(): Date {
    const now = new Date();
    // Shift by 5.5 hours to get the actual IST time footprint
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    // Convert to ISO string to preserve the IST time values in UTC representation
    const iso = istTime.toISOString();
    // Strip the Z to parse as a local Date - aligns perfectly with utcToIstShifted
    return new Date(iso.replace('Z', ''));
}

/**
 * Get current hour in IST
 */
export function getISTHour(): number {
    return getCurrentIST().getHours();
}

/**
 * Converts a UTC date to a Date object that represents the IST time in local time components.
 * Useful for calendar libraries that use local time.
 */
/**
 * Converts a UTC date to a Date object that represents the IST time in local time components.
 * With Fake UTC strategy, the input "is" the local time (in UTC).
 * But this function implies we want a Date object where .getHours() returns the IST hour.
 * If input is 09:00Z (Fake), .getUTCHours() is 9. .getHours() depends on browser.
 * If browser is IST, .getHours() is 14.
 * We want a Date where .getHours() is 9.
 * So we likely want to subtract the local offset? Or just parse as "2023...T09:00" (no Z).
 * Assuming this is used for Calendar:
 */
export function utcToIstShifted(utcDateString: string | Date): Date {
    const d = new Date(utcDateString);
    // If d is 09:00Z.
    // We want a date that prints as 09:00 in Local Time.
    // new Date("...09:00") (no Z).
    const iso = d.toISOString().replace('Z', '');
    return new Date(iso);
}
