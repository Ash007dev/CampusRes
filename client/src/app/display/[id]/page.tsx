"use client";

/**
 * =============================================================================
 * Meeting Room Display Mode (US 3.6)
 * =============================================================================
 * Kiosk mode for tablets mounted outside meeting rooms
 * Auto-refreshes every 60 seconds to show current and next booking
 * =============================================================================
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { format, isAfter, isBefore, addMinutes } from "date-fns";
import { Clock, Users, Calendar, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { roomsApi, bookingsApi, type Room, type Booking } from "@/lib/api";
import { formatTimeInIst } from "@/lib/dateUtils";

interface DisplayBooking {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    userName: string;
    status: string;
}

export default function DisplayModePage() {
    const params = useParams();
    const roomId = params.id as string;

    const [room, setRoom] = useState<Room | null>(null);
    const [currentBooking, setCurrentBooking] = useState<DisplayBooking | null>(null);
    const [nextBooking, setNextBooking] = useState<DisplayBooking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [error, setError] = useState<string | null>(null);

    // Fetch room and booking data
    const fetchData = useCallback(async () => {
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const formatFakeUTC = (d: Date) => {
                const yr = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const dy = String(d.getDate()).padStart(2, '0');
                const hr = String(d.getHours()).padStart(2, '0');
                const mn = String(d.getMinutes()).padStart(2, '0');
                const sc = String(d.getSeconds()).padStart(2, '0');
                return `${yr}-${mo}-${dy}T${hr}:${mn}:${sc}`;
            };

            const [roomResponse, bookingsResponse] = await Promise.all([
                roomsApi.getById(roomId),
                bookingsApi.getCalendarBookings({
                    startDate: formatFakeUTC(now),
                    endDate: formatFakeUTC(tomorrow),
                }),
            ]);

            setRoom(roomResponse.data.data);

            const allBookings = bookingsResponse.data.data || [];
            const roomBookings = allBookings
                .filter((b: Booking) => b.roomId === roomId && b.status !== 'CANCELLED')
                .map((b: Booking) => ({
                    id: b.id,
                    title: b.title || 'Meeting',
                    startTime: new Date(b.startTime),
                    endTime: new Date(b.endTime),
                    userName: b.user?.firstName ? `${b.user.firstName} ${b.user.lastName}` : 'Reserved',
                    status: b.status,
                }))
                .sort((a: DisplayBooking, b: DisplayBooking) => a.startTime.getTime() - b.startTime.getTime());

            const now = new Date();

            // Find current booking (now is between start and end)
            const current = roomBookings.find(
                (b: DisplayBooking) => isBefore(b.startTime, now) && isAfter(b.endTime, now)
            );
            setCurrentBooking(current || null);

            // Find next booking (starts after now)
            const next = roomBookings.find(
                (b: DisplayBooking) => isAfter(b.startTime, now)
            );
            setNextBooking(next || null);

            setError(null);
        } catch (err) {
            console.error("Failed to fetch display data:", err);
            setError("Failed to load room data");
        } finally {
            setIsLoading(false);
        }
    }, [roomId]);

    // Initial fetch and auto-refresh every 60 seconds
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-white" />
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className="min-h-screen bg-red-900 flex items-center justify-center text-white">
                <div className="text-center">
                    <XCircle className="h-24 w-24 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold">Room Not Found</h1>
                    <p className="mt-2 text-xl opacity-80">{error}</p>
                </div>
            </div>
        );
    }

    const isOccupied = !!currentBooking;
    const timeUntilFree = currentBooking
        ? Math.max(0, Math.ceil((currentBooking.endTime.getTime() - currentTime.getTime()) / 60000))
        : 0;
    const timeUntilNext = nextBooking
        ? Math.max(0, Math.ceil((nextBooking.startTime.getTime() - currentTime.getTime()) / 60000))
        : 0;

    return (
        <div
            className={`min-h-screen flex flex-col ${isOccupied
                ? 'bg-gradient-to-br from-red-600 to-red-900'
                : 'bg-gradient-to-br from-green-600 to-green-900'
                } text-white p-8`}
        >
            {/* Header */}
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-5xl font-bold">{room.name}</h1>
                    <p className="text-2xl opacity-80 mt-2">
                        {room.building} • Floor {room.floor}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-6xl font-mono font-bold">
                        {format(currentTime, 'HH:mm')}
                    </div>
                    <div className="text-xl opacity-80 mt-1">
                        {format(currentTime, 'EEEE, MMMM d')}
                    </div>
                </div>
            </header>

            {/* Main Status */}
            <main className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    {isOccupied ? (
                        <>
                            <XCircle className="h-32 w-32 mx-auto mb-6" />
                            <h2 className="text-7xl font-bold mb-4">OCCUPIED</h2>
                            <p className="text-4xl mb-2">Until {formatTimeInIst(currentBooking!.endTime)}</p>
                            <p className="text-3xl opacity-80">
                                Free in {timeUntilFree} minute{timeUntilFree !== 1 ? 's' : ''}
                            </p>
                        </>
                    ) : (
                        <>
                            <CheckCircle className="h-32 w-32 mx-auto mb-6" />
                            <h2 className="text-7xl font-bold mb-4">AVAILABLE</h2>
                            {nextBooking ? (
                                <p className="text-3xl opacity-80">
                                    Free for {timeUntilNext} minute{timeUntilNext !== 1 ? 's' : ''}
                                </p>
                            ) : (
                                <p className="text-3xl opacity-80">No upcoming bookings today</p>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Current/Next Booking Info */}
            <footer className="mt-auto">
                {isOccupied && currentBooking && (
                    <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-4">
                        <div className="flex items-center gap-4 text-2xl">
                            <Calendar className="h-8 w-8" />
                            <div>
                                <p className="font-semibold">{currentBooking.title}</p>
                                <p className="opacity-80">
                                    {formatTimeInIst(currentBooking.startTime)} - {formatTimeInIst(currentBooking.endTime)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mt-4 text-xl opacity-80">
                            <Users className="h-6 w-6" />
                            <span>{currentBooking.userName}</span>
                        </div>
                    </div>
                )}

                {nextBooking && (
                    <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
                        <h3 className="text-lg uppercase tracking-wide opacity-60 mb-3">
                            Next Booking
                        </h3>
                        <div className="flex items-center gap-4 text-xl">
                            <Clock className="h-6 w-6" />
                            <div>
                                <p className="font-semibold">{nextBooking.title}</p>
                                <p className="opacity-80">
                                    {formatTimeInIst(nextBooking.startTime)} - {formatTimeInIst(nextBooking.endTime)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Room Info Footer */}
                <div className="flex items-center justify-center gap-6 mt-6 text-lg opacity-60">
                    <span className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Capacity: {room.capacity}
                    </span>
                    <span>•</span>
                    <span>Room Code: {room.code || room.id.slice(0, 8)}</span>
                </div>
            </footer>
        </div>
    );
}
