"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { bookingsApi, type Booking } from "@/lib/api";

/**
 * Hook for booking check-in reminders (US 3.8)
 * Shows a toast notification 5 minutes before booking starts
 */
export function useBookingReminders() {
    const { toast } = useToast();
    const remindersSet = useRef<Set<string>>(new Set());
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const checkUpcomingBookings = async () => {
            try {
                // Fetch today's confirmed bookings
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const response = await bookingsApi.getMyBookings({
                    startDate: today.toISOString(),
                    endDate: tomorrow.toISOString(),
                    status: "CONFIRMED",
                });

                const bookings = response.data.data;

                bookings.forEach((booking: Booking) => {
                    const startTime = new Date(booking.startTime);
                    const now = new Date();
                    const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);

                    // Check if 5 minutes or less until start, but not past
                    if (minutesUntilStart > 0 && minutesUntilStart <= 5) {
                        // Only show reminder once per booking
                        if (!remindersSet.current.has(booking.id)) {
                            remindersSet.current.add(booking.id);

                            toast({
                                title: "⏰ Check-in Reminder",
                                description: `Your booking for ${booking.room?.name || 'the room'} starts in ${Math.round(minutesUntilStart)} minutes. Don't forget to check in!`,
                                duration: 10000, // 10 seconds
                            });

                            // Request browser notification permission and show notification
                            if ("Notification" in window && Notification.permission === "granted") {
                                new Notification("Check-in Reminder", {
                                    body: `Your booking for ${booking.room?.name || 'the room'} starts in ${Math.round(minutesUntilStart)} minutes.`,
                                    icon: "/favicon.ico",
                                });
                            }
                        }
                    }
                });
            } catch (error) {
                // Silently fail - non-critical feature
                console.debug("Failed to check upcoming bookings for reminders:", error);
            }
        };

        // Request notification permission on mount
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        // Check immediately and then every minute
        checkUpcomingBookings();
        intervalRef.current = setInterval(checkUpcomingBookings, 60000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [toast]);
}
