import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time to readable string
 */
export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Calculate duration between two dates in hours
 */
export function calculateDuration(start: Date | string, end: Date | string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return (endTime - startTime) / (1000 * 60 * 60);
}

/**
 * Format duration as human-readable string
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  if (hours === 1) {
    return '1 hour';
  }
  return `${hours} hours`;
}

/**
 * Get booking status color class
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-500',
    CONFIRMED: 'bg-green-500',
    CANCELLED: 'bg-gray-500',
    COMPLETED: 'bg-blue-500',
    PENDING_APPROVAL: 'bg-orange-500',
    NO_SHOW: 'bg-red-500',
  };
  return colors[status] || 'bg-gray-500';
}

/**
 * Get booking status text
 */
export function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed',
    PENDING_APPROVAL: 'Awaiting Approval',
    NO_SHOW: 'No Show',
  };
  return texts[status] || status;
}
