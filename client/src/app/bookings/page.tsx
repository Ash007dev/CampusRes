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

    // Fetch bookings from API
    const fetchBookings = useCallback(async () => {
        try {
            const response = await bookingsApi.getMyBookings();
            setBookings(response.data.data || []);
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

        if (!user) {
            router.push("/auth/login");
            return;
        }
        fetchBookings();
    }, [user, isInitialized, router, fetchBookings]);

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

    // Handle check-in using the bookings API
    const handleCheckIn = async (id: string, roomCode?: string) => {
        setCheckingInId(id);
        try {
            // Get user's location for proximity check (optional)
            let latitude: number | undefined;
            let longitude: number | undefined;

            if (navigator.geolocation) {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    latitude = position.coords.latitude;
                    longitude = position.coords.longitude;
                } catch (geoError) {
                    // Geolocation failed or denied - continue without it
                    console.log('Geolocation not available, continuing without proximity check');
                }
            }

            // Use room code as QR code (in a real app, user would scan a QR)
            const qrCode = roomCode || 'manual-checkin';

            await bookingsApi.checkIn(id, qrCode, latitude, longitude);

            toast({
                title: "Check-in Successful ✓",
                description: "You have checked in to your booking.",
            });
            await fetchBookings();
        } catch (error: any) {
            toast({
                title: "Check-in Failed",
                description: error.message || "Unable to check in. Please try again.",
                variant: "destructive",
            });
        } finally {
            setCheckingInId(null);
        }
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
        const bookingDate = new Date(booking.startTime);
        const isUpcoming = bookingDate >= new Date();
        const matchesTab =
            activeTab === "all" ||
            (activeTab === "upcoming" && isUpcoming) ||
            (activeTab === "past" && !isUpcoming);
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
                                <div className="text-2xl font-bold text-blue-500">
                                    {bookings.filter(b => b.status === "COMPLETED").length}
                                </div>
                                <p className="text-xs text-muted-foreground">Completed</p>
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
                                    const startTime = new Date(booking.startTime);
                                    const endTime = new Date(booking.endTime);
                                    const roomName = booking.room?.name || booking.title || "Room";
                                    const building = booking.room?.building || "Building";
                                    const floor = booking.room?.floor || "1";
                                    const isUpcoming = startTime >= new Date();
                                    const canCancel = isUpcoming && booking.status === "CONFIRMED";
                                    const canCheckIn = isUpcoming && booking.status === "CONFIRMED";

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
                                                    {booking.description || booking.title || "Booking"}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-4 w-4" />
                                                        {format(startTime, "PPP")}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-4 w-4" />
                                                        {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="h-4 w-4" />
                                                        {building}, Floor {floor}
                                                    </div>
                                                </div>
                                                {(canCancel || canCheckIn) && (
                                                    <div className="mt-4 flex gap-2">
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
        </div>
    );
}
