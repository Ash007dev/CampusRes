"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
    Calendar,
    Clock,
    MapPin,
    Filter,
    Search,
    XCircle,
    CheckCircle,
    AlertCircle,
    ChevronLeft,
    RefreshCw,
    Loader2,
    PlusCircle,
    AlarmClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsApi, type Booking } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { QRScanner } from "@/components/booking/QRScanner";
import { RescheduleModal } from "@/components/booking/RescheduleModal";
import { formatTimeInIst, formatDateTimeInIst, utcToIstShifted } from "@/lib/dateUtils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const STATUS_COLORS: Record<string, string> = {
    CONFIRMED: "bg-green-500",
    PENDING: "bg-yellow-500",
    COMPLETED: "bg-blue-500",
    CANCELLED: "bg-red-500",
    NO_SHOW: "bg-gray-500",
    CHECKED_IN: "bg-emerald-500",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
    CONFIRMED: CheckCircle,
    PENDING: AlertCircle,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle,
    NO_SHOW: XCircle,
    CHECKED_IN: CheckCircle,
};

export default function BookingsPage() {
    const router = useRouter();
    const { user, isLoading: authLoading, isInitialized } = useAuth();
    const { toast } = useToast();

    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [activeTab, setActiveTab] = useState("upcoming");
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [checkingInId, setCheckingInId] = useState<string | null>(null);
    const [earlyCheckoutId, setEarlyCheckoutId] = useState<string | null>(null);
    const [extendingId, setExtendingId] = useState<string | null>(null);
    const [runningLateId, setRunningLateId] = useState<string | null>(null);
    const [qrScannerOpen, setQrScannerOpen] = useState(false);
    const [selectedBookingForCheckIn, setSelectedBookingForCheckIn] = useState<{ id: string, roomCode?: string } | null>(null);
    const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
    const [selectedBookingForReschedule, setSelectedBookingForReschedule] = useState<Booking | null>(null);

    // Fetch bookings from API
    const fetchBookings = useCallback(async () => {
        try {
            const response = await bookingsApi.getMyBookings();
            const bookingsData = response.data.data || [];

            // Debug: Log the first booking's time data
            if (bookingsData.length > 0) {
                console.log('[DEBUG] First booking raw data:', {
                    startTime: bookingsData[0].startTime,
                    endTime: bookingsData[0].endTime,
                    parsedStart: new Date(bookingsData[0].startTime),
                    parsedEnd: new Date(bookingsData[0].endTime),
                });
            }

            setBookings(bookingsData);
        } catch (error) {
            console.error("Failed to fetch bookings:", error);
            toast({
                title: "Error",
                description: "Failed to load bookings. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        // Wait for auth to be initialized before redirecting
        if (!isInitialized) return;

        // Don't redirect while auth is still loading
        if (authLoading) return;

        if (!user) {
            router.push("/auth/login");
            return;
        }
        fetchBookings();
    }, [user, isInitialized, authLoading, router, fetchBookings]);

    // Handle refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchBookings();
    };

    // Handle cancel booking
    const handleCancel = async (id: string) => {
        setCancellingId(id);
        try {
            await bookingsApi.cancel(id, "Cancelled by user");
            toast({
                title: "Booking Cancelled",
                description: "Your booking has been cancelled successfully.",
            });
            await fetchBookings();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to cancel booking. Please try again.",
                variant: "destructive",
            });
        } finally {
            setCancellingId(null);
        }
    };

    // Handle check-in - open QR scanner modal
    const handleCheckIn = (id: string, roomCode?: string) => {
        const booking = bookings.find(b => b.id === id);
        if (!booking) return;

        const roomName = booking.room?.name || '';
        const regexMatch = roomName.match(/([A-Z]+-\d+)/)?.[0];
        const extractedCode = roomCode || regexMatch || booking.room?.code || booking.roomId || booking.id;

        setSelectedBookingForCheckIn({ id, roomCode: extractedCode });
        setQrScannerOpen(true);
    };

    // Handle successful check-in from QR scanner
    const handleCheckInSuccess = async () => {
        setQrScannerOpen(false);
        setSelectedBookingForCheckIn(null);
        await fetchBookings();
    };

    // Handle early checkout (US 3.4) - End booking early and get credit refund
    const handleEarlyCheckout = async (id: string) => {
        setEarlyCheckoutId(id);
        try {
            const response = await bookingsApi.earlyCheckout(id);
            const refundedCredits = (response.data?.data as any)?.refundedCredits || 0;
            toast({
                title: "Early Checkout Successful ✓",
                description: refundedCredits > 0
                    ? `You ended your booking early. ${refundedCredits} credits refunded!`
                    : "You have ended your booking early.",
            });
            await fetchBookings();
        } catch (error: any) {
            toast({
                title: "Early Checkout Failed",
                description: error.message || "Unable to end booking early. Please try again.",
                variant: "destructive",
            });
        } finally {
            setEarlyCheckoutId(null);
        }
    };

    // Handle extend booking (US 3.5) - Extend active booking by 15 minutes
    const handleExtend = async (id: string) => {
        setExtendingId(id);
        try {
            await bookingsApi.extendBooking(id, 15); // Extend by 15 minutes
            toast({
                title: "Booking Extended ✓",
                description: "Your booking has been extended by 15 minutes.",
            });
            await fetchBookings();
        } catch (error: any) {
            toast({
                title: "Extension Failed",
                description: error.message || "Unable to extend booking. The room may be booked after your slot.",
                variant: "destructive",
            });
        } finally {
            setExtendingId(null);
        }
    };

    // Handle reschedule booking (US 1.7)
    const handleReschedule = async (bookingId: string, newStartTime: string, newEndTime: string) => {
        try {
            await bookingsApi.reschedule(bookingId, newStartTime, newEndTime);
            toast({
                title: "Booking Rescheduled ✓",
                description: "Your booking has been rescheduled successfully.",
            });
            await fetchBookings();
        } catch (error: any) {
            toast({
                title: "Reschedule Failed",
                description: error.message || "Unable to reschedule booking. Please try again.",
                variant: "destructive",
            });
            throw error;
        }
    };

    // US 3: Handle running late
    const handleRunningLate = async (id: string) => {
        setRunningLateId(id);
        try {
            await bookingsApi.runningLate(id);
            toast({
                title: "Running Late Notified ✓",
                description: "Your grace period has been extended by 15 minutes.",
            });
            await fetchBookings();
        } catch (error: any) {
            toast({
                title: "Failed",
                description: error.message || "Unable to mark as running late.",
                variant: "destructive",
            });
        } finally {
            setRunningLateId(null);
        }
    };

    // Open reschedule modal
    const openRescheduleModal = (booking: Booking) => {
        setSelectedBookingForReschedule(booking);
        setRescheduleModalOpen(true);
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading your bookings...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    // Filter bookings
    const filteredBookings = bookings.filter((booking) => {
        const roomName = booking.room?.name || booking.title || "";
        const matchesSearch =
            roomName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (booking.description || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
            statusFilter === "all" || booking.status === statusFilter;
        const bookingEndTime = utcToIstShifted(booking.endTime);
        const now = new Date();
        // A booking is "upcoming/active" until its END time passes (not start time)
        // This keeps active bookings in the Upcoming tab where users can check-in, extend, etc.
        const isUpcomingOrActive = bookingEndTime.getTime() > now.getTime();
        const matchesTab =
            activeTab === "all" ||
            (activeTab === "upcoming" && isUpcomingOrActive) ||
            (activeTab === "past" && !isUpcomingOrActive);
        return matchesSearch && matchesStatus && matchesTab;
    });

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Dashboard
                        </Button>
                    </div>
                    <h1 className="text-xl font-semibold">My Bookings</h1>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                        <Button onClick={() => router.push("/dashboard")}>
                            New Booking
                        </Button>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-5xl px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    {/* Filters */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex flex-col gap-4 sm:flex-row">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search bookings..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-48">
                                        <Filter className="mr-2 h-4 w-4" />
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                        <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold">{bookings.length}</div>
                                <p className="text-xs text-muted-foreground">Total Bookings</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-green-500">
                                    {bookings.filter(b => b.status === "CONFIRMED").length}
                                </div>
                                <p className="text-xs text-muted-foreground">Confirmed</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-yellow-500">
                                    {bookings.filter(b => b.status === "PENDING").length}
                                </div>
                                <p className="text-xs text-muted-foreground">Pending</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-emerald-500">
                                    {bookings.filter(b => {
                                        const now = new Date();
                                        const start = utcToIstShifted(b.startTime);
                                        const end = utcToIstShifted(b.endTime);
                                        return b.checkInStatus === "CHECKED_IN" && start <= now && end > now;
                                    }).length}
                                </div>
                                <p className="text-xs text-muted-foreground">Active Now</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                            <TabsTrigger value="past">Past</TabsTrigger>
                            <TabsTrigger value="all">All</TabsTrigger>
                        </TabsList>

                        <TabsContent value={activeTab} className="mt-4 space-y-4">
                            {filteredBookings.length === 0 ? (
                                <Card>
                                    <CardContent className="flex flex-col items-center justify-center py-12">
                                        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-semibold">No bookings found</h3>
                                        <p className="text-muted-foreground text-center">
                                            {activeTab === "upcoming"
                                                ? "You don't have any upcoming bookings"
                                                : searchQuery
                                                    ? "No bookings match your search"
                                                    : "No bookings match your filters"}
                                        </p>
                                        <Button
                                            className="mt-4"
                                            onClick={() => router.push("/dashboard")}
                                        >
                                            Book a Room
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                filteredBookings.map((booking) => {
                                    const StatusIcon = STATUS_ICONS[booking.status] || AlertCircle;
                                    const startTime = booking.startTime ? utcToIstShifted(booking.startTime) : null;
                                    const endTime = booking.endTime ? utcToIstShifted(booking.endTime) : null;
                                    const isValidDate = startTime && !isNaN(startTime.getTime()) && endTime && !isNaN(endTime.getTime());
                                    const roomName = booking.room?.name || booking.title || "Room";
                                    const building = booking.room?.building || "Building";
                                    const floor = booking.room?.floor || "1";
                                    const now = new Date();
                                    const isUpcoming = isValidDate && startTime >= now;
                                    const canCancel = isUpcoming && (booking.status === "CONFIRMED" || booking.status === "PENDING") && booking.checkInStatus !== "CHECKED_IN";

                                    // US 3.2: Check-in window - 15 min before start until end of booking
                                    const checkInWindowStart = isValidDate ? new Date(startTime.getTime() - 15 * 60 * 1000) : null;
                                    const inCheckInWindow = isValidDate &&
                                        checkInWindowStart &&
                                        now >= checkInWindowStart &&
                                        now < endTime;
                                    const canCheckIn = inCheckInWindow &&
                                        booking.status === "CONFIRMED" &&
                                        booking.checkInStatus !== "CHECKED_IN";

                                    // US 3.4: Early checkout - booking is active if checked in and currently in progress
                                    const isActiveBooking = isValidDate &&
                                        booking.checkInStatus === "CHECKED_IN" &&
                                        now < endTime;
                                    const canEarlyCheckout = isActiveBooking;
                                    // US 3.5: Extend meeting - can extend active bookings by 15 minutes
                                    const canExtend = isActiveBooking;

                                    // US 3: Running Late - available when booking is confirmed, check-in pending, and within grace window
                                    const gracePeriodMs = 15 * 60 * 1000; // 15 minutes
                                    const canRunLate = isValidDate &&
                                        booking.status === "CONFIRMED" &&
                                        booking.checkInStatus === "PENDING" &&
                                        now >= startTime &&
                                        now <= new Date(startTime.getTime() + gracePeriodMs);

                                    return (
                                        <Card key={booking.id} className="overflow-hidden">
                                            <div
                                                className={`h-1 ${STATUS_COLORS[booking.status] || "bg-gray-500"}`}
                                            />
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-lg">{roomName}</CardTitle>
                                                    <Badge
                                                        variant="outline"
                                                        className="flex items-center gap-1"
                                                    >
                                                        <StatusIcon className="h-3 w-3" />
                                                        {booking.status}
                                                    </Badge>
                                                </div>
                                                <CardDescription>
                                                    <span className="font-mono text-xs text-muted-foreground">ID: {booking.id.slice(0, 8).toUpperCase()}</span>
                                                    {' · '}
                                                    {booking.description || booking.title || "Booking"}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-4 w-4" />
                                                        {isValidDate ? formatDateTimeInIst(booking.startTime) : "Invalid date"}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-4 w-4" />
                                                        {isValidDate ? `${formatTimeInIst(booking.startTime)} - ${formatTimeInIst(booking.endTime)}` : "--:-- - --:--"}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="h-4 w-4" />
                                                        {building}, Floor {floor}
                                                    </div>
                                                </div>
                                                {(canCancel || canCheckIn || canEarlyCheckout || canExtend || canRunLate) && (
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {canCancel && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openRescheduleModal(booking)}
                                                                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                                            >
                                                                <Clock className="mr-2 h-4 w-4" />
                                                                Reschedule
                                                            </Button>
                                                        )}
                                                        {canCheckIn && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleCheckIn(booking.id)}
                                                                disabled={checkingInId === booking.id}
                                                            >
                                                                {checkingInId === booking.id ? (
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                ) : null}
                                                                Check In
                                                            </Button>
                                                        )}
                                                        {canRunLate && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleRunningLate(booking.id)}
                                                                disabled={runningLateId === booking.id}
                                                                className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                                                            >
                                                                {runningLateId === booking.id ? (
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <AlarmClock className="mr-2 h-4 w-4" />
                                                                )}
                                                                Running Late
                                                            </Button>
                                                        )}
                                                        {canEarlyCheckout && (
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => handleEarlyCheckout(booking.id)}
                                                                disabled={earlyCheckoutId === booking.id}
                                                                className="bg-orange-500 hover:bg-orange-600 text-white"
                                                            >
                                                                {earlyCheckoutId === booking.id ? (
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                ) : null}
                                                                End Now
                                                            </Button>
                                                        )}
                                                        {canExtend && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleExtend(booking.id)}
                                                                disabled={extendingId === booking.id}
                                                                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                                            >
                                                                {extendingId === booking.id ? (
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <PlusCircle className="mr-2 h-4 w-4" />
                                                                )}
                                                                +15 Mins
                                                            </Button>
                                                        )}
                                                        {canCancel && (
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleCancel(booking.id)}
                                                                disabled={cancellingId === booking.id}
                                                            >
                                                                {cancellingId === booking.id ? (
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                ) : null}
                                                                Cancel
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </TabsContent>
                    </Tabs>
                </motion.div>
            </main>

            {/* QR Scanner Modal for Check-in */}
            {selectedBookingForCheckIn && (
                <QRScanner
                    isOpen={qrScannerOpen}
                    bookingId={selectedBookingForCheckIn.id}
                    roomCode={selectedBookingForCheckIn.roomCode}
                    onSuccess={handleCheckInSuccess}
                    onClose={() => {
                        setQrScannerOpen(false);
                        setSelectedBookingForCheckIn(null);
                    }}
                />
            )}

            {/* Reschedule Modal */}
            <RescheduleModal
                isOpen={rescheduleModalOpen}
                onClose={() => {
                    setRescheduleModalOpen(false);
                    setSelectedBookingForReschedule(null);
                }}
                booking={selectedBookingForReschedule}
                onReschedule={handleReschedule}
            />
        </div>
    );
}
